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
import { Trash2, Plus, Pencil, Star, CheckCircle2, XCircle, Clock, CalendarDays, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";

type CollectionStatus = "scheduled" | "completed" | "missed" | "cancelled";
type CollectionFrequency = "daily" | "weekly" | "biweekly" | "monthly";
type BillStatus = "draft" | "approved" | "sent" | "paid" | "disputed";

interface Property { id: string; name: string }

interface WasteProvider {
  id: string; owner_id: string; name: string; contact_name: string | null;
  phone: string | null; email: string | null; monthly_fee: number;
  contract_start: string | null; contract_end: string | null;
  rating: number | null; notes: string | null; active: boolean;
}

interface CollectionSchedule {
  id: string; property_id: string; provider_id: string | null;
  frequency: CollectionFrequency; scheduled_date: string; actual_date: string | null;
  status: CollectionStatus; notes: string | null;
}

interface UtilityBill {
  id: string; tenant_id: string; property_id: string | null;
  period_month: number; period_year: number;
  fixed_charge: number; amount_due: number; amount_paid: number; status: BillStatus;
}

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const collectionStatusConfig: Record<CollectionStatus, { label: string; cls: string; icon: React.ElementType }> = {
  scheduled:  { label: "Scheduled",  cls: "bg-amber-100 text-amber-700 border-amber-200",   icon: Clock },
  completed:  { label: "Completed",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  missed:     { label: "Missed",     cls: "bg-red-100 text-red-700 border-red-200",           icon: XCircle },
  cancelled:  { label: "Cancelled",  cls: "bg-gray-100 text-gray-600 border-gray-200",        icon: XCircle },
};

const billStatusConfig: Record<BillStatus, { label: string; cls: string }> = {
  draft:    { label: "Draft",    cls: "bg-gray-100 text-gray-700 border-gray-200" },
  approved: { label: "Approved", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  sent:     { label: "Sent",     cls: "bg-purple-100 text-purple-700 border-purple-200" },
  paid:     { label: "Paid",     cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  disputed: { label: "Disputed", cls: "bg-red-100 text-red-700 border-red-200" },
};

const today = new Date();
const blankProvider = { name:"", contact_name:"", phone:"", email:"", monthly_fee:0, contract_start:"", contract_end:"", rating: 5, notes:"", active:true };
const blankSchedule = { property_id:"", provider_id:"", frequency:"weekly" as CollectionFrequency, scheduled_date: today.toISOString().slice(0,10), notes:"" };

export default function Waste() {
  const { user } = useAuth();

  const [properties, setProperties]   = useState<Property[]>([]);
  const [providers, setProviders]     = useState<WasteProvider[]>([]);
  const [schedules, setSchedules]     = useState<CollectionSchedule[]>([]);
  const [bills, setBills]             = useState<UtilityBill[]>([]);
  const [loading, setLoading]         = useState(true);

  const [filterProperty, setFilterProperty] = useState("all");
  const [filterMonth, setFilterMonth]       = useState(today.getMonth() + 1);
  const [filterYear, setFilterYear]         = useState(today.getFullYear());

  // Provider form
  const [providerOpen, setProviderOpen]   = useState(false);
  const [editProvider, setEditProvider]   = useState<WasteProvider | null>(null);
  const [providerForm, setProviderForm]   = useState(blankProvider);
  const [providerSaving, setProviderSaving] = useState(false);

  // Schedule form
  const [scheduleOpen, setScheduleOpen]   = useState(false);
  const [scheduleForm, setScheduleForm]   = useState(blankSchedule);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Waste rate config
  const [rateOpen, setRateOpen]   = useState(false);
  const [ratePropertyId, setRatePropertyId] = useState("");
  const [rateAmount, setRateAmount] = useState(0);
  const [rateFrom, setRateFrom]   = useState(today.toISOString().slice(0,10));
  const [rateSaving, setRateSaving] = useState(false);

  // Bill generation
  const [genOpen, setGenOpen]     = useState(false);
  const [genProperty, setGenProperty] = useState("");
  const [genMonth, setGenMonth]   = useState(today.getMonth() + 1);
  const [genYear, setGenYear]     = useState(today.getFullYear());
  const [genSaving, setGenSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [propRes, provRes, schRes, billRes] = await Promise.all([
      supabase.from("properties").select("id,name").eq("owner_id", user.id).order("name"),
      supabase.from("waste_service_providers").select("*").eq("owner_id", user.id).order("name"),
      supabase.from("waste_collection_schedules").select("*").eq("owner_id", user.id).order("scheduled_date", { ascending: false }),
      supabase.from("utility_bills").select("*").eq("owner_id", user.id).eq("utility_type","waste").order("period_year,period_month"),
    ]);
    setProperties(propRes.data ?? []);
    setProviders(provRes.data ?? []);
    setSchedules(schRes.data ?? []);
    setBills(billRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const propMap = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p.name])), [properties]);
  const providerMap = useMemo(() => Object.fromEntries(providers.map(p => [p.id, p.name])), [providers]);

  const filteredBills = useMemo(() => bills.filter(b =>
    (filterProperty === "all" || b.property_id === filterProperty) &&
    b.period_month === filterMonth && b.period_year === filterYear
  ), [bills, filterProperty, filterMonth, filterYear]);

  const filteredSchedules = useMemo(() => schedules.filter(s =>
    filterProperty === "all" || s.property_id === filterProperty
  ), [schedules, filterProperty]);

  const totalBilled = filteredBills.reduce((s,b) => s + b.amount_due, 0);
  const totalPaid   = filteredBills.reduce((s,b) => s + b.amount_paid, 0);

  // Provider CRUD
  const saveProvider = async () => {
    if (!user || !providerForm.name) { toast.error("Provider name is required."); return; }
    setProviderSaving(true);
    const payload = { ...providerForm, owner_id: user.id, contract_start: providerForm.contract_start || null, contract_end: providerForm.contract_end || null };
    const { error } = editProvider
      ? await supabase.from("waste_service_providers").update(payload).eq("id", editProvider.id)
      : await supabase.from("waste_service_providers").insert(payload);
    setProviderSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Provider saved."); setProviderOpen(false); setEditProvider(null); load();
  };

  const deleteProvider = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    const { error } = await supabase.from("waste_service_providers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Provider deleted."); load();
  };

  // Schedule CRUD
  const saveSchedule = async () => {
    if (!user || !scheduleForm.property_id || !scheduleForm.scheduled_date) { toast.error("Property and date are required."); return; }
    setScheduleSaving(true);
    const { error } = await supabase.from("waste_collection_schedules").insert({
      owner_id: user.id, ...scheduleForm,
      provider_id: scheduleForm.provider_id || null,
      notes: scheduleForm.notes || null,
    });
    setScheduleSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Collection scheduled."); setScheduleOpen(false); load();
  };

  const updateScheduleStatus = async (id: string, status: CollectionStatus) => {
    const { error } = await supabase.from("waste_collection_schedules").update({ status, actual_date: status === "completed" ? new Date().toISOString().slice(0,10) : null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status updated."); load();
  };

  // Waste rate
  const saveRate = async () => {
    if (!user || !ratePropertyId) { toast.error("Select a property."); return; }
    setRateSaving(true);
    const { error } = await supabase.from("utility_rates").insert({
      owner_id: user.id, property_id: ratePropertyId, utility_type: "waste",
      rate_per_unit: 0, fixed_charge: rateAmount, unit_label: "month", effective_from: rateFrom,
    });
    setRateSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Waste fee rate saved."); setRateOpen(false); load();
  };

  // Generate bills
  const generateBills = async () => {
    if (!user || !genProperty) { toast.error("Select a property."); return; }
    setGenSaving(true);
    const { data, error } = await supabase.rpc("generate_waste_bills_for_property", {
      _owner_id: user.id, _property_id: genProperty, _month: genMonth, _year: genYear,
    });
    setGenSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data} waste bill(s) generated.`); setGenOpen(false); load();
  };

  const approveBill = async (billId: string) => {
    const { error } = await supabase.rpc("approve_utility_bill", { _bill_id: billId });
    if (error) { toast.error(error.message); return; }
    toast.success("Bill approved."); load();
  };

  return (
    <LandlordLayout title="Waste Management" action={
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => { setRateOpen(true); setRatePropertyId(""); setRateAmount(0); setRateFrom(today.toISOString().slice(0,10)); }}>Monthly Fee Rate</Button>
        <Button size="sm" variant="outline" onClick={() => { setGenOpen(true); setGenProperty(""); setGenMonth(today.getMonth()+1); setGenYear(today.getFullYear()); }}>Generate Bills</Button>
        <Button size="sm" variant="outline" onClick={() => { setScheduleOpen(true); setScheduleForm(blankSchedule); }}><CalendarDays className="h-4 w-4 mr-1" />Schedule</Button>
        <Button size="sm" onClick={() => { setProviderOpen(true); setEditProvider(null); setProviderForm(blankProvider); }}><Plus className="h-4 w-4 mr-1" />Add Provider</Button>
      </div>
    }>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={filterProperty} onValueChange={setFilterProperty}><SelectTrigger className="w-48"><SelectValue placeholder="All properties" /></SelectTrigger><SelectContent><SelectItem value="all">All properties</SelectItem>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
        <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(Number(v))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{months.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select>
        <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{[2024,2025,2026,2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Providers", value: providers.filter(p=>p.active).length, icon: Trash2, color: "text-green-600" },
          { label: "Collections This Period", value: filteredSchedules.filter(s => { const d=new Date(s.scheduled_date); return d.getMonth()+1===filterMonth && d.getFullYear()===filterYear; }).length, icon: CalendarDays, color: "text-blue-500" },
          { label: "Total Billed", value: formatKsh(totalBilled), icon: TrendingUp, color: "text-indigo-500" },
          { label: "Outstanding",  value: formatKsh(totalBilled-totalPaid), icon: XCircle, color: "text-red-500" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-5 pb-4"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground mb-1">{s.label}</p><p className="text-xl font-semibold">{s.value}</p></div><s.icon className={`h-5 w-5 mt-0.5 ${s.color}`} /></div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="schedules">
        <TabsList className="mb-4">
          <TabsTrigger value="schedules">Collection Schedule</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="providers">Service Providers</TabsTrigger>
        </TabsList>

        {/* SCHEDULES */}
        <TabsContent value="schedules">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>Date</TableHead><TableHead>Frequency</TableHead><TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : filteredSchedules.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No schedules.</TableCell></TableRow>
                : filteredSchedules.slice(0,50).map(s => {
                  const cfg = collectionStatusConfig[s.status];
                  const Ico = cfg.icon;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{propMap[s.property_id] ?? "—"}</TableCell>
                      <TableCell>{new Date(s.scheduled_date).toLocaleDateString()}</TableCell>
                      <TableCell className="capitalize">{s.frequency}</TableCell>
                      <TableCell>{s.provider_id ? providerMap[s.provider_id] ?? "—" : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs ${cfg.cls}`}><Ico className="h-3 w-3 mr-1" />{cfg.label}</Badge></TableCell>
                      <TableCell>
                        {s.status === "scheduled" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateScheduleStatus(s.id, "completed")}><CheckCircle2 className="h-3 w-3 mr-1" />Done</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateScheduleStatus(s.id, "missed")}><XCircle className="h-3 w-3 mr-1" />Missed</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* BILLS */}
        <TabsContent value="bills">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Property</TableHead><TableHead className="text-right">Monthly Fee</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : filteredBills.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No waste bills for this period. Use "Generate Bills" to create them.</TableCell></TableRow>
                : filteredBills.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{propMap[b.property_id ?? ""] ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatKsh(b.amount_due)}</TableCell>
                    <TableCell className="text-right">{formatKsh(b.amount_paid)}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${billStatusConfig[b.status].cls}`}>{billStatusConfig[b.status].label}</Badge></TableCell>
                    <TableCell>{b.status === "draft" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approveBill(b.id)}><CheckCircle2 className="h-3 w-3 mr-1" />Approve</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* PROVIDERS */}
        <TabsContent value="providers">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Monthly Fee</TableHead><TableHead>Rating</TableHead><TableHead>Active</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : providers.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No providers added yet.</TableCell></TableRow>
                : providers.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.contact_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.phone ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatKsh(p.monthly_fee)}</TableCell>
                    <TableCell>
                      <div className="flex">{[1,2,3,4,5].map(n => <Star key={n} className={`h-3.5 w-3.5 ${n <= (p.rating??0) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={p.active ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>{p.active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditProvider(p); setProviderForm({ name:p.name, contact_name:p.contact_name??"", phone:p.phone??"", email:p.email??"", monthly_fee:p.monthly_fee, contract_start:p.contract_start??"", contract_end:p.contract_end??"", rating:p.rating??5, notes:p.notes??"", active:p.active }); setProviderOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => deleteProvider(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Provider Dialog */}
      <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editProvider ? "Edit Provider" : "Add Service Provider"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Company Name</Label><Input value={providerForm.name} onChange={e => setProviderForm(f=>({...f,name:e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Person</Label><Input value={providerForm.contact_name} onChange={e => setProviderForm(f=>({...f,contact_name:e.target.value}))} /></div>
              <div><Label>Phone</Label><Input value={providerForm.phone} onChange={e => setProviderForm(f=>({...f,phone:e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={providerForm.email} onChange={e => setProviderForm(f=>({...f,email:e.target.value}))} /></div>
              <div><Label>Monthly Fee (KSh)</Label><Input type="number" min={0} value={providerForm.monthly_fee} onChange={e => setProviderForm(f=>({...f,monthly_fee:Number(e.target.value)}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contract Start</Label><Input type="date" value={providerForm.contract_start} onChange={e => setProviderForm(f=>({...f,contract_start:e.target.value}))} /></div>
              <div><Label>Contract End</Label><Input type="date" value={providerForm.contract_end} onChange={e => setProviderForm(f=>({...f,contract_end:e.target.value}))} /></div>
            </div>
            <div><Label>Rating (1–5)</Label><Input type="number" min={1} max={5} value={providerForm.rating} onChange={e => setProviderForm(f=>({...f,rating:Number(e.target.value)}))} /></div>
            <div><Label>Notes</Label><Textarea value={providerForm.notes} onChange={e => setProviderForm(f=>({...f,notes:e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setProviderOpen(false); setEditProvider(null); }}>Cancel</Button>
            <Button onClick={saveProvider} disabled={providerSaving}>{providerSaving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Schedule Collection</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Property</Label><Select value={scheduleForm.property_id} onValueChange={v => setScheduleForm(f=>({...f,property_id:v}))}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Provider</Label><Select value={scheduleForm.provider_id} onValueChange={v => setScheduleForm(f=>({...f,provider_id:v}))}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent><SelectItem value="">None</SelectItem>{providers.filter(p=>p.active).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Frequency</Label><Select value={scheduleForm.frequency} onValueChange={v => setScheduleForm(f=>({...f,frequency:v as CollectionFrequency}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["daily","weekly","biweekly","monthly"].map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Scheduled Date</Label><Input type="date" value={scheduleForm.scheduled_date} onChange={e => setScheduleForm(f=>({...f,scheduled_date:e.target.value}))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={scheduleForm.notes} onChange={e => setScheduleForm(f=>({...f,notes:e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button><Button onClick={saveSchedule} disabled={scheduleSaving}>{scheduleSaving ? "Saving…" : "Schedule"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Dialog */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Set Monthly Waste Fee</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Property</Label><Select value={ratePropertyId} onValueChange={setRatePropertyId}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Monthly Fee per Tenant (KSh)</Label><Input type="number" min={0} value={rateAmount} onChange={e => setRateAmount(Number(e.target.value))} /></div>
            <div><Label>Effective From</Label><Input type="date" value={rateFrom} onChange={e => setRateFrom(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button><Button onClick={saveRate} disabled={rateSaving}>{rateSaving ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Bills Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Generate Monthly Waste Bills</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Property</Label><Select value={genProperty} onValueChange={setGenProperty}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Month</Label><Select value={String(genMonth)} onValueChange={v => setGenMonth(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{months.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Year</Label><Input type="number" value={genYear} onChange={e => setGenYear(Number(e.target.value))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button><Button onClick={generateBills} disabled={genSaving}>{genSaving ? "Generating…" : "Generate"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}
