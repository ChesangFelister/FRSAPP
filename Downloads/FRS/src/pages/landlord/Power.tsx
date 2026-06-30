import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { Zap, Plus, Pencil, Settings, TrendingUp, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";

type BillStatus = "draft" | "approved" | "sent" | "paid" | "disputed";

interface Property { id: string; name: string }
interface Unit     { id: string; label: string; property_id: string }
interface Tenant   { id: string; full_name: string; unit_id: string | null; property_id: string | null }

interface MeterReading {
  id: string;
  property_id: string;
  unit_id: string | null;
  tenant_id: string | null;
  meter_number: string | null;
  period_month: number;
  period_year: number;
  previous_reading: number;
  current_reading: number;
  units_consumed: number;
  read_at: string;
  notes: string | null;
  utility_bill_id: string | null;
}

interface UtilityBill {
  id: string;
  tenant_id: string;
  property_id: string | null;
  unit_id: string | null;
  period_month: number;
  period_year: number;
  units_consumed: number;
  rate_per_unit: number;
  fixed_charge: number;
  amount_due: number;
  amount_paid: number;
  status: BillStatus;
  due_date: string | null;
  notes: string | null;
}

interface UtilityRate {
  id: string;
  property_id: string;
  utility_type: string;
  rate_per_unit: number;
  fixed_charge: number;
  unit_label: string;
  effective_from: string;
  notes: string | null;
}

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const statusConfig: Record<BillStatus, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "bg-gray-100 text-gray-700 border-gray-200" },
  approved:  { label: "Approved",  cls: "bg-blue-100 text-blue-700 border-blue-200" },
  sent:      { label: "Sent",      cls: "bg-purple-100 text-purple-700 border-purple-200" },
  paid:      { label: "Paid",      cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  disputed:  { label: "Disputed",  cls: "bg-red-100 text-red-700 border-red-200" },
};

const today = new Date();

export default function Power() {
  const { user } = useAuth();

  // Data state
  const [properties, setProperties]   = useState<Property[]>([]);
  const [units, setUnits]             = useState<Unit[]>([]);
  const [tenants, setTenants]         = useState<Tenant[]>([]);
  const [readings, setReadings]       = useState<MeterReading[]>([]);
  const [bills, setBills]             = useState<UtilityBill[]>([]);
  const [rates, setRates]             = useState<UtilityRate[]>([]);
  const [loading, setLoading]         = useState(true);

  // Filters
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterMonth, setFilterMonth]       = useState(today.getMonth() + 1);
  const [filterYear, setFilterYear]         = useState(today.getFullYear());

  // Reading form
  const [readingOpen, setReadingOpen] = useState(false);
  const [readingForm, setReadingForm] = useState({
    property_id: "", unit_id: "", tenant_id: "",
    period_month: today.getMonth() + 1, period_year: today.getFullYear(),
    previous_reading: 0, current_reading: 0,
    meter_number: "", notes: "",
  });
  const [readingSaving, setReadingSaving] = useState(false);

  // Rate form
  const [rateOpen, setRateOpen]   = useState(false);
  const [editRate, setEditRate]   = useState<UtilityRate | null>(null);
  const [rateForm, setRateForm]   = useState({
    property_id: "", rate_per_unit: 0, fixed_charge: 0,
    unit_label: "kWh", effective_from: today.toISOString().slice(0,10), notes: "",
  });
  const [rateSaving, setRateSaving] = useState(false);

  // Bill detail dialog
  const [activeBill, setActiveBill]   = useState<UtilityBill | null>(null);
  const [billNote, setBillNote]       = useState("");
  const [billSaving, setBillSaving]   = useState(false);

  // -------------------------------------------------------------------------
  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [propRes, unitRes, tenRes, readRes, billRes, rateRes] = await Promise.all([
      supabase.from("properties").select("id,name").eq("owner_id", user.id).order("name"),
      supabase.from("units").select("id,label,property_id").eq("owner_id", user.id),
      supabase.from("tenants").select("id,full_name,unit_id,property_id").eq("owner_id", user.id).eq("status","active"),
      supabase.from("power_meter_readings").select("*").eq("owner_id", user.id).order("period_year,period_month,created_at"),
      supabase.from("utility_bills").select("*").eq("owner_id", user.id).eq("utility_type","power").order("period_year,period_month"),
      supabase.from("utility_rates").select("*").eq("owner_id", user.id).eq("utility_type","power").order("effective_from"),
    ]);
    setProperties(propRes.data ?? []);
    setUnits(unitRes.data ?? []);
    setTenants(tenRes.data ?? []);
    setReadings(readRes.data ?? []);
    setBills(billRes.data ?? []);
    setRates(rateRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // -------------------------------------------------------------------------
  // Derived data for charts
  const chartData = useMemo(() => {
    const map: Record<string, { month: string; consumed: number; billed: number }> = {};
    readings.forEach(r => {
      const key = `${r.period_year}-${String(r.period_month).padStart(2,"0")}`;
      if (!map[key]) map[key] = { month: `${months[r.period_month-1]} ${r.period_year}`, consumed: 0, billed: 0 };
      map[key].consumed += r.units_consumed;
    });
    bills.forEach(b => {
      const key = `${b.period_year}-${String(b.period_month).padStart(2,"0")}`;
      if (!map[key]) map[key] = { month: `${months[b.period_month-1]} ${b.period_year}`, consumed: 0, billed: 0 };
      map[key].billed += b.amount_due;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [readings, bills]);

  const filteredReadings = useMemo(() => readings.filter(r =>
    (filterProperty === "all" || r.property_id === filterProperty) &&
    r.period_month === filterMonth && r.period_year === filterYear
  ), [readings, filterProperty, filterMonth, filterYear]);

  const filteredBills = useMemo(() => bills.filter(b =>
    (filterProperty === "all" || b.property_id === filterProperty) &&
    b.period_month === filterMonth && b.period_year === filterYear
  ), [bills, filterProperty, filterMonth, filterYear]);

  // Summary stats
  const totalBilled   = filteredBills.reduce((s,b) => s + b.amount_due, 0);
  const totalPaid     = filteredBills.reduce((s,b) => s + b.amount_paid, 0);
  const totalConsumed = filteredReadings.reduce((s,r) => s + r.units_consumed, 0);

  // Lookup helpers
  const unitMap   = useMemo(() => Object.fromEntries(units.map(u => [u.id, u.label])), [units]);
  const tenantMap = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t.full_name])), [tenants]);
  const propMap   = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p.name])), [properties]);

  const unitsForProperty = (pid: string) => units.filter(u => u.property_id === pid);
  const tenantForUnit    = (uid: string) => tenants.find(t => t.unit_id === uid) ?? null;

  // -------------------------------------------------------------------------
  const handleReadingFormChange = (k: string, v: string | number) => {
    setReadingForm(f => {
      const next = { ...f, [k]: v };
      if (k === "unit_id") {
        const t = tenantForUnit(v as string);
        next.tenant_id = t?.id ?? "";
      }
      return next;
    });
  };

  const submitReading = async () => {
    if (!user || !readingForm.property_id || !readingForm.unit_id) {
      toast.error("Select a property and unit."); return;
    }
    if (readingForm.current_reading < readingForm.previous_reading) {
      toast.error("Current reading cannot be less than previous reading."); return;
    }
    setReadingSaving(true);
    const { error } = await supabase.rpc("capture_power_reading", {
      _owner_id:     user.id,
      _property_id:  readingForm.property_id,
      _unit_id:      readingForm.unit_id,
      _tenant_id:    readingForm.tenant_id || null,
      _period_month: readingForm.period_month,
      _period_year:  readingForm.period_year,
      _previous:     readingForm.previous_reading,
      _current:      readingForm.current_reading,
      _meter_number: readingForm.meter_number || null,
      _notes:        readingForm.notes || null,
    });
    setReadingSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Meter reading saved and bill generated.");
    setReadingOpen(false);
    load();
  };

  const saveRate = async () => {
    if (!user || !rateForm.property_id) { toast.error("Select a property."); return; }
    setRateSaving(true);
    const payload = {
      owner_id:       user.id,
      property_id:    rateForm.property_id,
      utility_type:   "power",
      rate_per_unit:  rateForm.rate_per_unit,
      fixed_charge:   rateForm.fixed_charge,
      unit_label:     rateForm.unit_label,
      effective_from: rateForm.effective_from,
      notes:          rateForm.notes || null,
    };
    const { error } = editRate
      ? await supabase.from("utility_rates").update(payload).eq("id", editRate.id)
      : await supabase.from("utility_rates").insert(payload);
    setRateSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Rate saved.");
    setRateOpen(false); setEditRate(null);
    load();
  };

  const approveBill = async (billId: string) => {
    const { error } = await supabase.rpc("approve_utility_bill", { _bill_id: billId });
    if (error) { toast.error(error.message); return; }
    toast.success("Bill approved.");
    load();
  };

  const saveBillNote = async () => {
    if (!activeBill) return;
    setBillSaving(true);
    const { error } = await supabase.from("utility_bills")
      .update({ notes: billNote }).eq("id", activeBill.id);
    setBillSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Note saved.");
    setActiveBill(null);
    load();
  };

  // -------------------------------------------------------------------------
  return (
    <LandlordLayout title="Power Management" action={
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setRateOpen(true); setEditRate(null); setRateForm({ property_id:"", rate_per_unit:0, fixed_charge:0, unit_label:"kWh", effective_from:today.toISOString().slice(0,10), notes:"" }); }}>
          <Settings className="h-4 w-4 mr-1" /> Rates
        </Button>
        <Button size="sm" onClick={() => { setReadingOpen(true); setReadingForm({ property_id:"", unit_id:"", tenant_id:"", period_month:today.getMonth()+1, period_year:today.getFullYear(), previous_reading:0, current_reading:0, meter_number:"", notes:"" }); }}>
          <Plus className="h-4 w-4 mr-1" /> Record Reading
        </Button>
      </div>
    }>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All properties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[2024,2025,2026,2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Units Consumed", value: `${totalConsumed.toLocaleString()} kWh`, icon: Zap, color: "text-amber-500" },
          { label: "Total Billed",   value: formatKsh(totalBilled),   icon: TrendingUp, color: "text-blue-500" },
          { label: "Total Collected",value: formatKsh(totalPaid),      icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Outstanding",    value: formatKsh(totalBilled - totalPaid), icon: AlertTriangle, color: "text-red-500" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-xl font-semibold">{stat.value}</p>
                </div>
                <stat.icon className={`h-5 w-5 mt-0.5 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="readings">
        <TabsList className="mb-4">
          <TabsTrigger value="readings">Meter Readings</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="rates">Tariff Rates</TabsTrigger>
        </TabsList>

        {/* READINGS TAB */}
        <TabsContent value="readings">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Meter No.</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Consumed (kWh)</TableHead>
                    <TableHead>Read At</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filteredReadings.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No readings for this period.</TableCell></TableRow>
                  ) : filteredReadings.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.unit_id ? unitMap[r.unit_id] ?? "—" : "—"}</TableCell>
                      <TableCell>{r.tenant_id ? tenantMap[r.tenant_id] ?? "—" : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{propMap[r.property_id] ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.meter_number ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.previous_reading.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.current_reading.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">{r.units_consumed.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.read_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{r.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILLS TAB */}
        <TabsContent value="bills">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Fixed</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filteredBills.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No bills for this period.</TableCell></TableRow>
                  ) : filteredBills.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{tenantMap[b.tenant_id] ?? "—"}</TableCell>
                      <TableCell>{b.unit_id ? unitMap[b.unit_id] ?? "—" : "—"}</TableCell>
                      <TableCell className="text-right">{b.units_consumed}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatKsh(b.rate_per_unit,{decimals:2})}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatKsh(b.fixed_charge)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatKsh(b.amount_due)}</TableCell>
                      <TableCell className="text-right">{formatKsh(b.amount_paid)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusConfig[b.status].cls}`}>
                          {statusConfig[b.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {b.status === "draft" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approveBill(b.id)}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setActiveBill(b); setBillNote(b.notes ?? ""); }}>
                            <Pencil className="h-3 w-3 mr-1" /> Note
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Monthly Consumption (kWh)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="consumed" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="kWh" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Monthly Billing (KSh)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatKsh(v)} />
                    <Legend />
                    <Bar dataKey="billed" fill="#3b82f6" name="Billed (KSh)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RATES TAB */}
        <TabsContent value="rates">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Rate / kWh</TableHead>
                    <TableHead className="text-right">Fixed Charge</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No rates configured. Add one above.</TableCell></TableRow>
                  ) : rates.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{propMap[r.property_id] ?? r.property_id}</TableCell>
                      <TableCell className="text-right">{formatKsh(r.rate_per_unit,{decimals:2})}</TableCell>
                      <TableCell className="text-right">{formatKsh(r.fixed_charge)}</TableCell>
                      <TableCell>{new Date(r.effective_from).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => {
                          setEditRate(r);
                          setRateForm({ property_id: r.property_id, rate_per_unit: r.rate_per_unit, fixed_charge: r.fixed_charge, unit_label: r.unit_label, effective_from: r.effective_from, notes: r.notes ?? "" });
                          setRateOpen(true);
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Record Reading Dialog ─── */}
      <Dialog open={readingOpen} onOpenChange={setReadingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Meter Reading</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Property</Label>
                <Select value={readingForm.property_id} onValueChange={v => handleReadingFormChange("property_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={readingForm.unit_id} onValueChange={v => handleReadingFormChange("unit_id", v)} disabled={!readingForm.property_id}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{unitsForProperty(readingForm.property_id).map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Period Month</Label>
                <Select value={String(readingForm.period_month)} onValueChange={v => handleReadingFormChange("period_month", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{months.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period Year</Label>
                <Input type="number" value={readingForm.period_year} onChange={e => handleReadingFormChange("period_year", Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Previous Reading (kWh)</Label>
                <Input type="number" min={0} value={readingForm.previous_reading} onChange={e => handleReadingFormChange("previous_reading", Number(e.target.value))} />
              </div>
              <div>
                <Label>Current Reading (kWh)</Label>
                <Input type="number" min={0} value={readingForm.current_reading} onChange={e => handleReadingFormChange("current_reading", Number(e.target.value))} />
              </div>
            </div>
            {readingForm.current_reading >= readingForm.previous_reading && (
              <p className="text-sm text-muted-foreground bg-amber-50 border border-amber-100 rounded-sm px-3 py-2">
                <Zap className="inline h-3.5 w-3.5 text-amber-500 mr-1" />
                Units consumed: <strong>{(readingForm.current_reading - readingForm.previous_reading).toLocaleString()} kWh</strong>
              </p>
            )}
            <div>
              <Label>Meter Number (optional)</Label>
              <Input value={readingForm.meter_number} onChange={e => handleReadingFormChange("meter_number", e.target.value)} placeholder="e.g. MET-0012" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={readingForm.notes} onChange={e => handleReadingFormChange("notes", e.target.value)} rows={2} placeholder="Any remarks…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReadingOpen(false)}>Cancel</Button>
            <Button onClick={submitReading} disabled={readingSaving}>{readingSaving ? "Saving…" : "Save & Generate Bill"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Rate Dialog ─── */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editRate ? "Edit Electricity Rate" : "Add Electricity Rate"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Property</Label>
              <Select value={rateForm.property_id} onValueChange={v => setRateForm(f => ({...f, property_id:v}))}>
                <SelectTrigger><SelectValue placeholder="Select property…" /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rate per kWh (KSh)</Label>
                <Input type="number" min={0} step={0.01} value={rateForm.rate_per_unit} onChange={e => setRateForm(f => ({...f, rate_per_unit:Number(e.target.value)}))} />
              </div>
              <div>
                <Label>Fixed Charge (KSh)</Label>
                <Input type="number" min={0} value={rateForm.fixed_charge} onChange={e => setRateForm(f => ({...f, fixed_charge:Number(e.target.value)}))} />
              </div>
            </div>
            <div>
              <Label>Effective From</Label>
              <Input type="date" value={rateForm.effective_from} onChange={e => setRateForm(f => ({...f, effective_from:e.target.value}))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={rateForm.notes} onChange={e => setRateForm(f => ({...f, notes:e.target.value}))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRateOpen(false); setEditRate(null); }}>Cancel</Button>
            <Button onClick={saveRate} disabled={rateSaving}>{rateSaving ? "Saving…" : "Save Rate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bill Note Dialog ─── */}
      <Dialog open={!!activeBill} onOpenChange={open => !open && setActiveBill(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bill Note / Explanation</DialogTitle>
          </DialogHeader>
          {activeBill && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground">
                {tenantMap[activeBill.tenant_id]} — {months[activeBill.period_month-1]} {activeBill.period_year} — {formatKsh(activeBill.amount_due)}
              </p>
              <div>
                <Label>Explanation for tenant (shown on bill)</Label>
                <Textarea value={billNote} onChange={e => setBillNote(e.target.value)} rows={4} placeholder="e.g. Unusually high consumption due to water heater fault…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveBill(null)}>Cancel</Button>
            <Button onClick={saveBillNote} disabled={billSaving}>{billSaving ? "Saving…" : "Save Note"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}
