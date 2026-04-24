import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users, Pencil, Trash2, ArrowLeft, CheckCircle2, FileSignature, Send, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";

type Status = "active" | "notice" | "ended";

interface Tenant {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  property_id: string | null;
  unit_id: string | null;
  unit_label: string | null;
  monthly_rent_ksh: number;
  lease_start: string | null;
  lease_end: string | null;
  status: Status;
  user_id: string | null;
}

interface Property { id: string; name: string }
interface Unit { id: string; label: string; property_id: string; monthly_rent_ksh: number; status: "vacant" | "occupied" }

const blankForm = {
  full_name: "", email: "", phone: "", property_id: "", unit_id: "",
  unit_label: "", monthly_rent_ksh: 0, lease_start: "", lease_end: "", status: "active" as Status,
};

const statusStyles: Record<Status, string> = {
  active: "bg-accent-soft text-accent-foreground border-accent/40",
  notice: "bg-yellow-100 text-yellow-900 border-yellow-300",
  ended: "bg-secondary text-muted-foreground border-border",
};

export default function Tenants() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteFor, setInviteFor] = useState<Tenant | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: t }, { data: p }, { data: u }] = await Promise.all([
      supabase.from("tenants").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("properties").select("id, name").eq("owner_id", user.id).order("name"),
      supabase.from("units").select("*").eq("owner_id", user.id),
    ]);
    setTenants((t as Tenant[]) ?? []);
    setProperties(p ?? []);
    setUnits((u as Unit[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...blankForm, property_id: properties[0]?.id ?? "" });
    setStep("form");
    setOpen(true);
  };

  const openEdit = (t: Tenant) => {
    setEditing(t);
    setForm({
      full_name: t.full_name, email: t.email ?? "", phone: t.phone ?? "",
      property_id: t.property_id ?? "", unit_label: t.unit_label ?? "",
      monthly_rent_ksh: Number(t.monthly_rent_ksh), lease_start: t.lease_start ?? "",
      lease_end: t.lease_end ?? "", status: t.status,
    });
    setStep("form");
    setOpen(true);
  };

  const openRenew = (t: Tenant) => {
    setEditing(t);
    const today = new Date().toISOString().slice(0, 10);
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    setForm({
      full_name: t.full_name, email: t.email ?? "", phone: t.phone ?? "",
      property_id: t.property_id ?? "", unit_label: t.unit_label ?? "",
      monthly_rent_ksh: Number(t.monthly_rent_ksh),
      lease_start: today,
      lease_end: oneYear.toISOString().slice(0, 10),
      status: "active",
    });
    setStep("form");
    setOpen(true);
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error("Tenant name is required."); return; }
    if (!form.property_id) { toast.error("Select a property to assign this tenant to."); return; }
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      owner_id: user.id,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      property_id: form.property_id || null,
      unit_label: form.unit_label || null,
      monthly_rent_ksh: form.monthly_rent_ksh,
      lease_start: form.lease_start || null,
      lease_end: form.lease_end || null,
      status: form.status,
    };
    const { error } = editing
      ? await supabase.from("tenants").update(payload).eq("id", editing.id)
      : await supabase.from("tenants").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const propName = propMap[form.property_id] ?? "property";
    toast.success(editing ? "Tenant updated" : `${form.full_name} assigned to ${propName}`, {
      description: "View on the property detail page.",
      action: form.property_id ? {
        label: "View property",
        onClick: () => { window.location.href = `/landlord/properties/${form.property_id}`; },
      } : undefined,
    });
    setOpen(false);
    setStep("form");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tenant record?")) return;
    const { error } = await supabase.from("tenants").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tenant deleted");
    load();
  };

  const propMap = Object.fromEntries(properties.map(p => [p.id, p.name]));

  return (
    <LandlordLayout
      title="Tenants"
      action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add tenant</Button>}
    >
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : tenants.length === 0 ? (
        <div className="bg-card border border-border p-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-5" strokeWidth={1.5} />
          <h3 className="font-serif text-2xl mb-2">No tenants yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Add your tenants to track leases, rent, and communications in one place.</p>
          <Button onClick={openNew} disabled={properties.length === 0}>
            <Plus className="h-4 w-4" /> Add your first tenant
          </Button>
          {properties.length === 0 && (
            <p className="text-xs text-muted-foreground mt-4">Create a property first.</p>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-6 py-4 font-medium">Tenant</th>
                <th className="text-left px-4 py-4 font-medium hidden md:table-cell">Property</th>
                <th className="text-left px-4 py-4 font-medium hidden sm:table-cell">Unit</th>
                <th className="text-right px-4 py-4 font-medium">Rent</th>
                <th className="text-center px-4 py-4 font-medium">Status</th>
                <th className="text-right px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium">{t.full_name}</div>
                    <div className="text-xs text-muted-foreground">{t.email ?? t.phone ?? "—"}</div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell text-muted-foreground">{propMap[t.property_id ?? ""] ?? "—"}</td>
                  <td className="px-4 py-4 hidden sm:table-cell text-muted-foreground">{t.unit_label ?? "—"}</td>
                  <td className="px-4 py-4 text-right font-medium">{formatKsh(t.monthly_rent_ksh)}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-xs px-2 py-0.5 border uppercase tracking-wider ${statusStyles[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openRenew(t)} title="Start new lease for this tenant"><FileSignature className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setStep("form"); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {step === "confirm" ? "Confirm tenant assignment" : (editing ? "Edit tenant" : "Add tenant")}
            </DialogTitle>
            <DialogDescription>
              {step === "confirm" ? "Review the details below before saving." : "Tenant details and lease information."}
            </DialogDescription>
          </DialogHeader>

          {step === "form" ? (
            <form onSubmit={handleReview} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t-name">Full name *</Label>
                <Input id="t-name" required value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="t-email">Email</Label>
                  <Input id="t-email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-phone">Phone</Label>
                  <Input id="t-phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="t-prop">Property *</Label>
                  <Select value={form.property_id} onValueChange={(v) => setForm(f => ({ ...f, property_id: v }))}>
                    <SelectTrigger id="t-prop"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-unit">Unit label</Label>
                  <Input id="t-unit" value={form.unit_label} onChange={(e) => setForm(f => ({ ...f, unit_label: e.target.value }))} placeholder="e.g. A4" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="t-rent">Monthly rent (KSh)</Label>
                  <Input id="t-rent" type="number" min={0} step={100} value={form.monthly_rent_ksh} onChange={(e) => setForm(f => ({ ...f, monthly_rent_ksh: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-status">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as Status }))}>
                    <SelectTrigger id="t-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="notice">On notice</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="t-start">Lease start</Label>
                  <Input id="t-start" type="date" value={form.lease_start} onChange={(e) => setForm(f => ({ ...f, lease_start: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-end">Lease end</Label>
                  <Input id="t-end" type="date" value={form.lease_end} onChange={(e) => setForm(f => ({ ...f, lease_end: e.target.value }))} />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Review →</Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="bg-accent-soft/40 border border-accent/30 p-4 flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium mb-0.5">{form.full_name}</div>
                  <div className="text-muted-foreground">
                    will be linked to <span className="font-medium text-foreground">{propMap[form.property_id] ?? "—"}</span>
                    {form.unit_label && <> · unit <span className="font-medium text-foreground">{form.unit_label}</span></>}
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border border-border bg-card p-4">
                <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Contact</dt><dd>{form.email || form.phone || "—"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Status</dt><dd className="capitalize">{form.status}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Monthly rent</dt><dd>{formatKsh(form.monthly_rent_ksh)}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Lease</dt><dd>{form.lease_start || "—"} → {form.lease_end || "—"}</dd></div>
              </dl>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setStep("form")}>
                  <ArrowLeft className="h-4 w-4" /> Back to edit
                </Button>
                <Button type="button" onClick={handleConfirm} disabled={saving}>
                  {saving ? "Saving…" : (editing ? "Confirm changes" : "Confirm & assign")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}
