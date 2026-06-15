import { useEffect, useState } from "react";
import { Plus, Users, Pencil, Trash2, Loader2, Phone, Mail, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Caretaker {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface FormState {
  full_name: string;
  phone: string;
  email: string;
  notes: string;
}

const empty: FormState = { full_name: "", phone: "", email: "", notes: "" };

export default function Caretakers() {
  const { user } = useAuth();
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Caretaker | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from("caretakers").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("properties").select("caretaker_id").eq("owner_id", user.id).not("caretaker_id", "is", null),
    ]);
    setCaretakers((cs as Caretaker[]) ?? []);
    const c: Record<string, number> = {};
    (ps ?? []).forEach((p: any) => { if (p.caretaker_id) c[p.caretaker_id] = (c[p.caretaker_id] ?? 0) + 1; });
    setCounts(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Caretaker) => {
    setEditing(c);
    setForm({ full_name: c.full_name, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      owner_id: user.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("caretakers").update(payload).eq("id", editing.id).eq("owner_id", user.id)
      : await supabase.from("caretakers").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Caretaker updated" : "Caretaker added");
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("caretakers").delete().eq("id", id).eq("owner_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Caretaker removed");
    load();
  };

  return (
    <LandlordLayout
      title="Caretakers"
      action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add caretaker</Button>}
    >
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : caretakers.length === 0 ? (
        <div className="bg-card border border-border p-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-5" strokeWidth={1.5} />
          <h3 className="font-serif text-2xl mb-2">No caretakers yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Add caretakers and assign them to properties to keep on-site contacts organised.
          </p>
          <Button onClick={openNew}><Plus className="h-4 w-4" /> Add your first caretaker</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {caretakers.map((c) => (
            <div key={c.id} className="bg-card border border-border p-5 flex flex-col">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-serif">
                  {c.full_name[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg leading-tight truncate">{c.full_name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Building2 className="h-3 w-3" />
                    {counts[c.id] ?? 0} {counts[c.id] === 1 ? "property" : "properties"}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-muted-foreground mb-5">
                {c.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span className="truncate">{c.phone}</span></div>}
                {c.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><span className="truncate">{c.email}</span></div>}
                {!c.phone && !c.email && <div className="italic">No contact details</div>}
              </div>

              <div className="mt-auto flex gap-2 pt-4 border-t border-border">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove caretaker?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Properties assigned to {c.full_name} will become unassigned. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit caretaker" : "Add caretaker"}</DialogTitle>
              <DialogDescription>Caretakers can be assigned to properties from the property settings.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name *</Label>
                <Input id="full_name" required value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Mwangi" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254 7…" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@…" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Working hours, responsibilities…" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add caretaker"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}
