import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKsh } from "@/lib/currency";
import { toast } from "sonner";
import { Plus, Gauge, Zap, Droplets } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid } from "recharts";

type UtilityType = "power" | "water";

interface Meter {
  id: string;
  property_id: string;
  unit_id: string | null;
  identifier: string;
  rate_per_unit: number;
  unit_label: string;
  active: boolean;
}
interface Property { id: string; name: string }
interface Unit { id: string; label: string; property_id: string }
interface Tenant { id: string; full_name: string; unit_id: string | null; property_id: string }
interface Reading { id: string; meter_id: string; reading_date: string; value: number; notes: string | null; created_at: string }
interface Bill {
  id: string; meter_id: string | null; tenant_id: string | null; utility_type: string;
  period_month: number; period_year: number;
  prev_reading: number | null; curr_reading: number | null;
  consumption: number | null; rate: number;
  amount_due: number; amount_paid: number; status: string; notes: string | null;
  approved_at: string | null; published_at: string | null;
}

const titleMap = {
  power: { title: "Power Management", unit: "kWh", icon: Zap },
  water: { title: "Water Management", unit: "m³", icon: Droplets },
} as const;

export default function UtilityModule({ type }: { type: UtilityType }) {
  const { user } = useAuth();
  const meta = titleMap[type];
  const Icon = meta.icon;

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [meterDlg, setMeterDlg] = useState(false);
  const [readingDlg, setReadingDlg] = useState(false);
  const [billDlg, setBillDlg] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);

  // forms
  const [mForm, setMForm] = useState<{ property_id: string; unit_id: string; identifier: string; rate_per_unit: string; unit_label: string }>({ property_id: "", unit_id: "none", identifier: "", rate_per_unit: "0", unit_label: meta.unit });
  const [rForm, setRForm] = useState({ meter_id: "", value: "", notes: "" });
  const [bForm, setBForm] = useState({ meter_id: "", tenant_id: "none", prev_reading: "", curr_reading: "", rate: "0", notes: "", due_date: "" });

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: p }, { data: u }, { data: t }, { data: m }, { data: b }] = await Promise.all([
      supabase.from("properties").select("id,name").eq("owner_id", user.id).order("created_at"),
      supabase.from("units").select("id,label,property_id").eq("owner_id", user.id),
      supabase.from("tenants").select("id,full_name,unit_id,property_id").eq("owner_id", user.id).eq("status", "active"),
      (supabase as any).from("utility_meters").select("*").eq("owner_id", user.id).eq("utility_type", type).order("created_at"),
      (supabase as any).from("utility_bills").select("*").eq("owner_id", user.id).eq("utility_type", type).order("period_year", { ascending: false }).order("period_month", { ascending: false }),
    ]);
    setProperties((p as Property[]) ?? []);
    setUnits((u as Unit[]) ?? []);
    setTenants((t as Tenant[]) ?? []);
    setMeters((m as Meter[]) ?? []);
    setBills((b as Bill[]) ?? []);
    const meterIds = ((m as Meter[]) ?? []).map((x) => x.id);
    if (meterIds.length) {
      const { data: r } = await (supabase as any).from("utility_readings").select("*").in("meter_id", meterIds).order("reading_date", { ascending: false });
      setReadings((r as Reading[]) ?? []);
    } else {
      setReadings([]);
    }
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const saveMeter = async () => {
    if (!user || !mForm.property_id || !mForm.identifier) return toast.error("Property and identifier are required");
    const payload = {
      owner_id: user.id,
      property_id: mForm.property_id,
      unit_id: mForm.unit_id === "none" ? null : mForm.unit_id,
      utility_type: type,
      identifier: mForm.identifier,
      rate_per_unit: Number(mForm.rate_per_unit) || 0,
      unit_label: mForm.unit_label || meta.unit,
    };
    const { error } = await (supabase as any).from("utility_meters").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Meter added");
    setMeterDlg(false);
    setMForm({ property_id: "", unit_id: "none", identifier: "", rate_per_unit: "0", unit_label: meta.unit });
    refresh();
  };

  const saveReading = async () => {
    if (!user || !rForm.meter_id || !rForm.value) return toast.error("Meter and value are required");
    const { error } = await (supabase as any).from("utility_readings").insert({
      owner_id: user.id, meter_id: rForm.meter_id, value: Number(rForm.value),
      notes: rForm.notes || null, captured_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Reading saved");
    setReadingDlg(false);
    setRForm({ meter_id: "", value: "", notes: "" });
    refresh();
  };

  const openBillDialog = (meter?: Meter) => {
    const m = meter ?? meters[0];
    if (!m) return toast.error("Add a meter first");
    const meterReadings = readings.filter((x) => x.meter_id === m.id).sort((a, b) => b.reading_date.localeCompare(a.reading_date));
    const curr = meterReadings[0]?.value ?? 0;
    const prev = meterReadings[1]?.value ?? 0;
    const tenant = tenants.find((t) => t.unit_id && t.unit_id === m.unit_id);
    setEditBill(null);
    setBForm({
      meter_id: m.id,
      tenant_id: tenant?.id ?? "none",
      prev_reading: String(prev),
      curr_reading: String(curr),
      rate: String(m.rate_per_unit),
      notes: "",
      due_date: "",
    });
    setBillDlg(true);
  };

  const saveBill = async () => {
    if (!user) return;
    const now = new Date();
    const payload: any = {
      owner_id: user.id,
      meter_id: bForm.meter_id || null,
      tenant_id: bForm.tenant_id === "none" ? null : bForm.tenant_id,
      utility_type: type,
      period_month: now.getMonth() + 1,
      period_year: now.getFullYear(),
      prev_reading: Number(bForm.prev_reading) || 0,
      curr_reading: Number(bForm.curr_reading) || 0,
      rate: Number(bForm.rate) || 0,
      notes: bForm.notes || null,
      due_date: bForm.due_date || null,
    };
    let error;
    if (editBill) {
      ({ error } = await (supabase as any).from("utility_bills").update(payload).eq("id", editBill.id));
    } else {
      ({ error } = await (supabase as any).from("utility_bills").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success(editBill ? "Bill updated" : "Bill generated");
    setBillDlg(false);
    refresh();
  };

  const approvePublish = async (b: Bill) => {
    if (!user) return;
    const { error } = await (supabase as any).from("utility_bills").update({
      approved_at: new Date().toISOString(), approved_by: user.id, published_at: new Date().toISOString(),
    }).eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Bill approved & published");
    refresh();
  };

  const chartData = useMemo(() => {
    const map = new Map<string, { period: string; consumption: number; cost: number }>();
    bills.forEach((b) => {
      const k = `${b.period_year}-${String(b.period_month).padStart(2, "0")}`;
      const cur = map.get(k) ?? { period: k, consumption: 0, cost: 0 };
      cur.consumption += Number(b.consumption ?? 0);
      cur.cost += Number(b.amount_due ?? 0);
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period)).slice(-12);
  }, [bills]);

  const meterUnitsForSelected = mForm.property_id ? units.filter((u) => u.property_id === mForm.property_id) : [];

  return (
    <LandlordLayout
      title={meta.title}
      action={
        <div className="flex gap-2">
          <Dialog open={readingDlg} onOpenChange={setReadingDlg}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Gauge className="h-4 w-4" /> Capture reading</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Capture meter reading</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Meter</Label>
                  <Select value={rForm.meter_id} onValueChange={(v) => setRForm({ ...rForm, meter_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select meter" /></SelectTrigger>
                    <SelectContent>
                      {meters.map((m) => <SelectItem key={m.id} value={m.id}>{m.identifier} ({m.unit_label})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reading value ({meta.unit})</Label>
                  <Input type="number" step="0.001" value={rForm.value} onChange={(e) => setRForm({ ...rForm, value: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={rForm.notes} onChange={(e) => setRForm({ ...rForm, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter><Button onClick={saveReading}>Save reading</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={meterDlg} onOpenChange={setMeterDlg}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add meter</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add {type} meter</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Property</Label>
                  <Select value={mForm.property_id} onValueChange={(v) => setMForm({ ...mForm, property_id: v, unit_id: "none" })}>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unit (optional — leave blank for shared meter)</Label>
                  <Select value={mForm.unit_id} onValueChange={(v) => setMForm({ ...mForm, unit_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Shared / building meter" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Shared / building</SelectItem>
                      {meterUnitsForSelected.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Meter identifier</Label><Input value={mForm.identifier} onChange={(e) => setMForm({ ...mForm, identifier: e.target.value })} placeholder="e.g. KPLC 1234567" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Rate / {meta.unit}</Label><Input type="number" step="0.0001" value={mForm.rate_per_unit} onChange={(e) => setMForm({ ...mForm, rate_per_unit: e.target.value })} /></div>
                  <div><Label>Unit label</Label><Input value={mForm.unit_label} onChange={(e) => setMForm({ ...mForm, unit_label: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={saveMeter}>Save meter</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="meters">Meters</TabsTrigger>
            <TabsTrigger value="readings">Readings</TabsTrigger>
            <TabsTrigger value="bills">Bills</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <Card label="Meters" value={meters.length.toString()} icon={<Icon className="h-5 w-5" />} />
              <Card label="Bills this year" value={bills.filter((b) => b.period_year === new Date().getFullYear()).length.toString()} />
              <Card label="Outstanding" value={formatKsh(bills.reduce((s, b) => s + Math.max(Number(b.amount_due) - Number(b.amount_paid), 0), 0))} />
            </div>
            <div className="bg-card border border-border p-6">
              <h3 className="font-serif text-lg mb-4">Consumption & cost trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RTooltip />
                    <Line yAxisId="left" type="monotone" dataKey="consumption" stroke="hsl(var(--accent))" name={`Consumption (${meta.unit})`} />
                    <Line yAxisId="right" type="monotone" dataKey="cost" stroke="hsl(var(--primary))" name="Cost (KSh)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="meters">
            <div className="bg-card border border-border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Identifier</TableHead><TableHead>Property</TableHead><TableHead>Unit</TableHead>
                  <TableHead className="text-right">Rate</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {meters.map((m) => {
                    const p = properties.find((x) => x.id === m.property_id);
                    const u = units.find((x) => x.id === m.unit_id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.identifier}</TableCell>
                        <TableCell>{p?.name ?? "—"}</TableCell>
                        <TableCell>{u?.label ?? "Shared"}</TableCell>
                        <TableCell className="text-right">{formatKsh(m.rate_per_unit, { decimals: 2 })} / {m.unit_label}</TableCell>
                        <TableCell>{m.active ? "Active" : "Inactive"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {meters.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No meters yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="readings">
            <div className="bg-card border border-border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Meter</TableHead>
                  <TableHead className="text-right">Value</TableHead><TableHead>Notes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {readings.map((r) => {
                    const m = meters.find((x) => x.id === r.meter_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.reading_date}</TableCell>
                        <TableCell>{m?.identifier ?? "—"}</TableCell>
                        <TableCell className="text-right">{Number(r.value).toLocaleString()} {m?.unit_label}</TableCell>
                        <TableCell className="text-muted-foreground">{r.notes}</TableCell>
                      </TableRow>
                    );
                  })}
                  {readings.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No readings captured.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="bills">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => openBillDialog()}><Plus className="h-4 w-4" /> Generate bill</Button>
            </div>
            <div className="bg-card border border-border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Period</TableHead><TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Consumption</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bills.map((b) => {
                    const t = tenants.find((x) => x.id === b.tenant_id);
                    return (
                      <TableRow key={b.id}>
                        <TableCell>{b.period_year}-{String(b.period_month).padStart(2, "0")}</TableCell>
                        <TableCell>{t?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-right">{Number(b.consumption ?? 0)} {meta.unit}</TableCell>
                        <TableCell className="text-right">{formatKsh(b.amount_due, { decimals: 2 })}</TableCell>
                        <TableCell><span className="text-xs uppercase tracking-wider">{b.status}{b.published_at ? " · published" : ""}</span></TableCell>
                        <TableCell className="text-right">
                          {!b.published_at && <Button size="sm" variant="outline" onClick={() => approvePublish(b)}>Approve</Button>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {bills.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No bills yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={billDlg} onOpenChange={setBillDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate {type} bill</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Meter</Label>
              <Select value={bForm.meter_id} onValueChange={(v) => setBForm({ ...bForm, meter_id: v })}>
                <SelectTrigger><SelectValue placeholder="Meter" /></SelectTrigger>
                <SelectContent>{meters.map((m) => <SelectItem key={m.id} value={m.id}>{m.identifier}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tenant</Label>
              <Select value={bForm.tenant_id} onValueChange={(v) => setBForm({ ...bForm, tenant_id: v })}>
                <SelectTrigger><SelectValue placeholder="Tenant (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tenant</SelectItem>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Previous reading</Label><Input type="number" step="0.001" value={bForm.prev_reading} onChange={(e) => setBForm({ ...bForm, prev_reading: e.target.value })} /></div>
              <div><Label>Current reading</Label><Input type="number" step="0.001" value={bForm.curr_reading} onChange={(e) => setBForm({ ...bForm, curr_reading: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rate / {meta.unit}</Label><Input type="number" step="0.0001" value={bForm.rate} onChange={(e) => setBForm({ ...bForm, rate: e.target.value })} /></div>
              <div><Label>Due date</Label><Input type="date" value={bForm.due_date} onChange={(e) => setBForm({ ...bForm, due_date: e.target.value })} /></div>
            </div>
            <div><Label>Notes / explanation</Label><Textarea value={bForm.notes} onChange={(e) => setBForm({ ...bForm, notes: e.target.value })} placeholder="Use this to explain unusually high bills" /></div>
          </div>
          <DialogFooter><Button onClick={saveBill}>Save bill</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}

function Card({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-serif">{value}</div>
    </div>
  );
}
