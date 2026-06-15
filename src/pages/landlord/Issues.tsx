import { useEffect, useMemo, useState } from "react";
import { Loader2, Wrench, CheckCircle2, Clock, CircleDashed, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Issue {
  id: string;
  tenant_id: string;
  property_id: string | null;
  caretaker_id: string | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  photo_paths: string[];
  resolution_note: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

const statusConfig = {
  open:        { label: "Open",        Icon: CircleDashed, cls: "bg-secondary text-muted-foreground border-border" },
  in_progress: { label: "In progress", Icon: Clock,        cls: "bg-blue-100 text-blue-900 border-blue-300" },
  resolved:    { label: "Resolved",    Icon: CheckCircle2, cls: "bg-accent-soft text-accent-foreground border-accent/40" },
} as const;

const priorityCls = {
  low: "text-muted-foreground",
  medium: "text-blue-700",
  high: "text-destructive font-medium",
};

type Filter = "all" | "open" | "in_progress" | "resolved";

export default function LandlordIssues() {
  const { user, roles } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tenants, setTenants] = useState<Record<string, { full_name: string; unit_label: string | null }>>({});
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [caretakers, setCaretakers] = useState<{ id: string; full_name: string }[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<Issue | null>(null);
  const [assignTo, setAssignTo] = useState<string>("");
  const [statusVal, setStatusVal] = useState<Issue["status"]>("open");
  const [resolutionNote, setResolutionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: iss }, { data: ts }, { data: ps }, { data: cs }] = await Promise.all([
      supabase.from("maintenance_issues").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("tenants").select("id, full_name, unit_label").eq("owner_id", user.id),
      supabase.from("properties").select("id, name").eq("owner_id", user.id),
      supabase.from("caretakers").select("id, full_name").eq("owner_id", user.id).order("full_name"),
    ]);
    const list = (iss as Issue[]) ?? [];
    setIssues(list);
    setTenants(Object.fromEntries((ts ?? []).map(t => [t.id, { full_name: t.full_name, unit_label: t.unit_label }])));
    setProperties(Object.fromEntries((ps ?? []).map(p => [p.id, p.name])));
    setCaretakers((cs as any) ?? []);
    setLoading(false);

    const allPaths = list.flatMap(i => i.photo_paths);
    if (allPaths.length) {
      const { data: signed } = await supabase.storage.from("issue-photos").createSignedUrls(allPaths, 3600);
      const map: Record<string, string> = {};
      signed?.forEach(s => { if (s.signedUrl && s.path) map[s.path] = s.signedUrl; });
      setPhotoUrls(map);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => filter === "all" ? issues : issues.filter(i => i.status === filter), [issues, filter]);
  const counts = useMemo(() => ({
    all: issues.length,
    open: issues.filter(i => i.status === "open").length,
    in_progress: issues.filter(i => i.status === "in_progress").length,
    resolved: issues.filter(i => i.status === "resolved").length,
  }), [issues]);

  const openManage = (i: Issue) => {
    setActive(i);
    setAssignTo(i.caretaker_id ?? "");
    setStatusVal(i.status);
    setResolutionNote(i.resolution_note ?? "");
  };

  const save = async () => {
    if (!active) return;
    if (statusVal === "resolved" && resolutionNote.trim().length < 3) {
      return toast.error("Add a short resolution note");
    }
    setSaving(true);
    const patch: any = {
      caretaker_id: assignTo || null,
      status: statusVal,
      resolution_note: resolutionNote.trim() || null,
    };
    if (assignTo && assignTo !== active.caretaker_id) patch.assigned_at = new Date().toISOString();
    if (statusVal === "in_progress" && active.status === "open" && !patch.assigned_at && assignTo) {
      patch.assigned_at = new Date().toISOString();
    }
    if (statusVal === "resolved" && !active.resolved_at) patch.resolved_at = new Date().toISOString();
    if (statusVal !== "resolved") patch.resolved_at = null;

    const { error } = roles && !roles.includes("admin")
      ? await supabase.from("maintenance_issues").update(patch).eq("id", active.id).eq("owner_id", user.id)
      : await supabase.from("maintenance_issues").update(patch).eq("id", active.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Issue updated");
    setActive(null);
    load();
  };

  if (loading) {
    return <LandlordLayout title="Issues"><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></LandlordLayout>;
  }

  const activeCaretakerName = (id: string | null) => id ? caretakers.find(c => c.id === id)?.full_name : null;

  return (
    <LandlordLayout title="Issues">
      <div className="space-y-6">
        <div className="flex gap-2 flex-wrap">
          {([
            ["all", "All"], ["open", "Open"], ["in_progress", "In progress"], ["resolved", "Resolved"],
          ] as [Filter, string][]).map(([k, lbl]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`text-xs uppercase tracking-wider px-3 py-1.5 border ${filter === k ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-secondary"}`}>
              {lbl} <span className="opacity-60 ml-1">{counts[k]}</span>
            </button>
          ))}
        </div>

        <section className="bg-card border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Reported issues</h2>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No issues here.</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(i => {
                const s = statusConfig[i.status];
                const Icon = s.Icon;
                const tenant = tenants[i.tenant_id];
                const careName = activeCaretakerName(i.caretaker_id);
                return (
                  <li key={i.id} className="px-6 py-4">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{i.title}</span>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${s.cls}`}>
                            <Icon className="h-3 w-3 inline mr-1" />{s.label}
                          </span>
                          <span className={`text-xs uppercase tracking-wider ${priorityCls[i.priority]}`}>{i.priority}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tenant?.full_name ?? "—"}{tenant?.unit_label ? ` · Unit ${tenant.unit_label}` : ""}
                          {i.property_id && properties[i.property_id] ? ` · ${properties[i.property_id]}` : ""}
                          {" · "}{new Date(i.created_at).toLocaleDateString()}
                        </div>
                        <p className="text-sm mt-2 whitespace-pre-wrap">{i.description}</p>
                        {i.photo_paths.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {i.photo_paths.map(p => photoUrls[p] && (
                              <a key={p} href={photoUrls[p]} target="_blank" rel="noreferrer">
                                <img src={photoUrls[p]} alt="" className="h-16 w-16 object-cover rounded-sm border border-border" />
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          {careName ? <>Assigned to <span className="font-medium text-foreground">{careName}</span></> : <span className="italic">Unassigned</span>}
                          {i.resolution_note && <div className="mt-1 bg-accent-soft border border-accent/30 p-2 rounded-sm text-foreground"><span className="font-medium">Resolution: </span>{i.resolution_note}</div>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openManage(i)}>
                        <UserPlus className="h-3.5 w-3.5" /> Manage
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Manage issue</DialogTitle>
            <DialogDescription>{active?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assign caretaker</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                <option value="">— Unassigned —</option>
                {caretakers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              {caretakers.length === 0 && (
                <p className="text-xs text-muted-foreground">No caretakers yet. Add one from the Caretakers page.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={statusVal} onChange={e => setStatusVal(e.target.value as Issue["status"])}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Resolution note {statusVal === "resolved" && "*"}</Label>
              <Textarea rows={3} value={resolutionNote} onChange={e => setResolutionNote(e.target.value)}
                placeholder="What was done to fix it" maxLength={1000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}
