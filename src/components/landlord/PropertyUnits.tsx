import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, DoorOpen, DoorClosed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";

interface Unit {
  id: string;
  property_id: string;
  label: string;
  status: "vacant" | "occupied";
  monthly_rent_ksh: number;
  notes: string | null;
}

export default function PropertyUnits({ propertyId, defaultRent }: { propertyId: string; defaultRent: number }) {
  const { user } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [label, setLabel] = useState("");
  const [rent, setRent] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("units").select("*").eq("property_id", propertyId).order("label");
    setUnits((data as Unit[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [propertyId]);

  const occupancy = units.length > 0
    ? Math.round((units.filter(u => u.status === "occupied").length / units.length) * 100)
    : 0;

  const openNew = () => { setEditing(null); setLabel(""); setRent(defaultRent); setOpen(true); };
  const openEdit = (u: Unit) => { setEditing(u); setLabel(u.label); setRent(Number(u.monthly_rent_ksh)); setOpen(true); };

  const save = async () => {
    if (!user) return;
    if (!label.trim()) { toast.error("Label is required"); return; }
    setSaving(true);
    const payload = { owner_id: user.id, property_id: propertyId, label, monthly_rent_ksh: rent };
    const { error } = editing
      ? await supabase.from("units").update(payload).eq("id", editing.id)
      : await supabase.from("units").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Unit updated" : "Unit added");
    setOpen(false);
    load();
  };

  const remove = async (u: Unit) => {
    if (u.status === "occupied") { toast.error("Unit is occupied — reassign tenant first"); return; }
    if (!confirm(`Delete unit ${u.label}?`)) return;
    const { error } = await supabase.from("units").delete().eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Unit deleted"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Occupancy</div>
          <div className="font-serif text-3xl">{occupancy}%</div>
          <div className="text-xs text-muted-foreground">
            {units.filter(u => u.status === "occupied").length} occupied · {units.filter(u => u.status === "vacant").length} vacant · {units.length} total
          </div>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add unit</Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : units.length === 0 ? (
        <div className="bg-secondary/30 border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No units yet. Add units to track vacancy and assign tenants individually.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {units.map(u => (
            <div key={u.id} className="bg-card border border-border p-4 flex items-center gap-3">
              {u.status === "occupied"
                ? <DoorClosed className="h-8 w-8 text-accent shrink-0" strokeWidth={1.5} />
                : <DoorOpen className="h-8 w-8 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />}
              <div className="flex-1 min-w-0">
                <div className="font-medium">Unit {u.label}</div>
                <div className="text-xs text-muted-foreground">{formatKsh(u.monthly_rent_ksh)} · <span className={u.status === "occupied" ? "text-accent" : ""}>{u.status}</span></div>
              </div>
              <div className="flex gap-0.5">
                <Button size="sm" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(u)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-serif text-xl">{editing ? "Edit unit" : "Add unit"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. A4, Ground-2, Penthouse" />
            </div>
            <div className="space-y-2">
              <Label>Monthly rent (KSh)</Label>
              <Input type="number" min={0} step={100} value={rent} onChange={(e) => setRent(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
