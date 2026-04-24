import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Wallet, Clock, AlertTriangle, CheckCircle2, FileDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";
import { downloadReceiptPdf, fetchLogoAsDataUrl } from "@/lib/receipt";
import { syncRentReminders } from "@/lib/rentReminders";

type Status = "pending" | "paid" | "late" | "partial";

interface Payment {
  id: string;
  tenant_id: string;
  property_id: string | null;
  period_month: number;
  period_year: number;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_date: string | null;
  status: Status;
  method: string | null;
  reference: string | null;
  notes: string | null;
}

interface Tenant {
  id: string;
  full_name: string;
  property_id: string | null;
  monthly_rent_ksh: number;
}
interface Property { id: string; name: string }

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const statusStyles: Record<Status, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  late: "bg-red-100 text-red-700 border-red-200",
  partial: "bg-blue-100 text-blue-700 border-blue-200",
};

const today = new Date();
const blank = {
  tenant_id: "",
  period_month: today.getMonth() + 1,
  period_year: today.getFullYear(),
  amount_due: 0,
  amount_paid: 0,
  due_date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().slice(0, 10),
  paid_date: "" as string,
  method: "",
  reference: "",
  notes: "",
};

export default function Payments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState(blank);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTenant, setFilterTenant] = useState<string>("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [p, t, props] = await Promise.all([
      supabase.from("rent_payments").select("*").eq("owner_id", user.id).order("period_year", { ascending: false }).order("period_month", { ascending: false }),
      supabase.from("tenants").select("id,full_name,property_id,monthly_rent_ksh").eq("owner_id", user.id).order("full_name"),
      supabase.from("properties").select("id,name").eq("owner_id", user.id).order("name"),
    ]);
    if (p.error) toast.error(p.error.message);
    const rows = (p.data as Payment[]) ?? [];
    const tlist = (t.data as Tenant[]) ?? [];
    setPayments(rows);
    setTenants(tlist);
    setProperties((props.data as Property[]) ?? []);
    setLoading(false);

    // Auto-create local reminders for due-soon / late rent
    const tMap = Object.fromEntries(tlist.map(x => [x.id, x.full_name]));
    const added = syncRentReminders(
      user.id,
      rows.map(r => ({
        id: r.id, status: r.status, due_date: r.due_date,
        amount_due: r.amount_due, amount_paid: r.amount_paid,
        period_month: r.period_month, period_year: r.period_year,
        tenant_name: tMap[r.tenant_id] ?? "Tenant",
      }))
    );
    if (added > 0) toast.message(`${added} rent reminder${added > 1 ? "s" : ""} added`);
  };

  useEffect(() => { load(); }, [user]);

  const generateThisMonth = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("ensure_current_month_dues_for_owner", { _owner_id: user.id });
    if (error) { toast.error(error.message); return; }
    const n = Number(data ?? 0);
    toast.success(n > 0 ? `Created ${n} rent record${n > 1 ? "s" : ""} for this month` : "All tenants already have this month's rent recorded");
    load();
  };

  const downloadReceipt = async (p: Payment) => {
    const tenant = tenantMap[p.tenant_id];
    if (!tenant) { toast.error("Tenant not found"); return; }
    if (Number(p.amount_paid) <= 0) { toast.error("No payment recorded for this period"); return; }

    const { data: settings } = await supabase
      .from("receipt_settings")
      .select("business_name, address, logo_url")
      .eq("owner_id", user!.id)
      .maybeSingle();

    let logoDataUrl: string | null = null;
    if (settings?.logo_url) logoDataUrl = await fetchLogoAsDataUrl(settings.logo_url);

    downloadReceiptPdf({
      receiptNumber: `${p.period_year}${String(p.period_month).padStart(2, "0")}-${p.id.slice(0, 8).toUpperCase()}`,
      issueDate: new Date().toISOString().slice(0, 10),
      landlord: { name: user?.user_metadata?.full_name ?? null, email: user?.email ?? null },
      tenant: {
        name: tenant.full_name,
        unit: (tenant as any).unit_label ?? null,
      },
      property: p.property_id ? { name: propMap[p.property_id] ?? null } : null,
      payment: {
        period_month: p.period_month,
        period_year: p.period_year,
        amount_due: Number(p.amount_due),
        amount_paid: Number(p.amount_paid),
        paid_date: p.paid_date,
        due_date: p.due_date,
        method: p.method,
        reference: p.reference,
        status: p.status,
        notes: p.notes,
      },
      branding: settings ? {
        businessName: settings.business_name,
        address: settings.address,
        logoDataUrl,
      } : null,
    });
  };

  const tenantMap = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t])), [tenants]);
  const propMap = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p.name])), [properties]);

  const stats = useMemo(() => {
    const totalDue = payments.reduce((s, p) => s + Number(p.amount_due), 0);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
    const late = payments.filter(p => p.status === "late").length;
    const pending = payments.filter(p => p.status === "pending" || p.status === "partial").length;
    return { totalDue, totalPaid, outstanding: totalDue - totalPaid, late, pending };
  }, [payments]);

  const filtered = useMemo(() => payments.filter(p =>
    (filterStatus === "all" || p.status === filterStatus) &&
    (filterTenant === "all" || p.tenant_id === filterTenant)
  ), [payments, filterStatus, filterTenant]);

  const openNew = () => {
    setEditing(null);
    setForm(blank);
    setOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({
      tenant_id: p.tenant_id,
      period_month: p.period_month,
      period_year: p.period_year,
      amount_due: Number(p.amount_due),
      amount_paid: Number(p.amount_paid),
      due_date: p.due_date,
      paid_date: p.paid_date ?? "",
      method: p.method ?? "",
      reference: p.reference ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const onTenantChange = (tenantId: string) => {
    const t = tenantMap[tenantId];
    setForm(f => ({
      ...f,
      tenant_id: tenantId,
      amount_due: f.amount_due || (t ? Number(t.monthly_rent_ksh) : 0),
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.tenant_id) { toast.error("Select a tenant"); return; }
    if (!form.due_date) { toast.error("Set a due date"); return; }
    const tenant = tenantMap[form.tenant_id];
    if (!tenant) { toast.error("Tenant not found"); return; }

    const payload = {
      owner_id: user.id,
      tenant_id: form.tenant_id,
      property_id: tenant.property_id,
      period_month: Number(form.period_month),
      period_year: Number(form.period_year),
      amount_due: Number(form.amount_due) || 0,
      amount_paid: Number(form.amount_paid) || 0,
      due_date: form.due_date,
      paid_date: form.paid_date || null,
      method: form.method || null,
      reference: form.reference || null,
      notes: form.notes || null,
    };

    const res = editing
      ? await supabase.from("rent_payments").update(payload).eq("id", editing.id)
      : await supabase.from("rent_payments").insert(payload);

    if (res.error) {
      if (res.error.code === "23505") toast.error("A payment record for this tenant and month already exists");
      else toast.error(res.error.message);
      return;
    }
    toast.success(editing ? "Payment updated" : "Payment recorded");
    setOpen(false);
    load();
  };

  const handleDelete = async (p: Payment) => {
    if (!confirm("Delete this payment record?")) return;
    const { error } = await supabase.from("rent_payments").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const markPaid = async (p: Payment) => {
    const { error } = await supabase.from("rent_payments").update({
      amount_paid: p.amount_due,
      paid_date: new Date().toISOString().slice(0, 10),
    }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid");
    load();
  };

  return (
    <LandlordLayout
      title="Payments"
      action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={generateThisMonth} disabled={tenants.length === 0}>
            <RefreshCw className="h-4 w-4" />Generate this month
          </Button>
          <Button onClick={openNew} disabled={tenants.length === 0}><Plus className="h-4 w-4" />Record payment</Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Collected" value={formatKsh(stats.totalPaid)} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Outstanding" value={formatKsh(stats.outstanding)} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Late" value={String(stats.late)} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Pending" value={String(stats.pending)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTenant} onValueChange={setFilterTenant}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tenants</SelectItem>
            {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : tenants.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Add a tenant first, then you can record their rent payments.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No payments yet. Click "Record payment" to add the first one.
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const t = tenantMap[p.tenant_id];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{t?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.property_id ? propMap[p.property_id] ?? "—" : "—"}</TableCell>
                    <TableCell>{months[p.period_month - 1]} {p.period_year}</TableCell>
                    <TableCell>{formatKsh(p.amount_due)}</TableCell>
                    <TableCell>{formatKsh(p.amount_paid)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.due_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[p.status]}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.status !== "paid" && (
                          <Button size="sm" variant="ghost" onClick={() => markPaid(p)}>Mark paid</Button>
                        )}
                        {Number(p.amount_paid) > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => downloadReceipt(p)} title="Download receipt PDF">
                            <FileDown className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit payment" : "Record payment"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={onTenantChange}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Month</Label>
                <Select value={String(form.period_month)} onValueChange={(v) => setForm(f => ({ ...f, period_month: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input type="number" value={form.period_year} onChange={(e) => setForm(f => ({ ...f, period_year: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount due (KSh)</Label>
                <Input type="number" value={form.amount_due} onChange={(e) => setForm(f => ({ ...f, amount_due: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Amount paid (KSh)</Label>
                <Input type="number" value={form.amount_paid} onChange={(e) => setForm(f => ({ ...f, amount_paid: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label>Paid date</Label>
                <Input type="date" value={form.paid_date} onChange={(e) => setForm(f => ({ ...f, paid_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Method</Label>
                <Input placeholder="M-Pesa, Bank, Cash" value={form.method} onChange={(e) => setForm(f => ({ ...f, method: e.target.value }))} />
              </div>
              <div>
                <Label>Reference</Label>
                <Input placeholder="Txn / receipt #" value={form.reference} onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Save changes" : "Record payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
        {icon}{label}
      </div>
      <div className="font-serif text-2xl">{value}</div>
    </Card>
  );
}
