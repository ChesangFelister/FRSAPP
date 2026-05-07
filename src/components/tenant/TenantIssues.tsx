import { useEffect, useState } from "react";
import { Loader2, Plus, Wrench, X, Image as ImageIcon, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import PhotoLightbox from "./PhotoLightbox";

interface Issue {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  photo_paths: string[];
  resolution_note: string | null;
  caretaker_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface Props {
  tenantId: string;
  ownerId: string;
  propertyId: string | null;
  unitId: string | null;
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

export default function TenantIssues({ tenantId, ownerId, propertyId, unitId }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from("maintenance_issues")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    const list = (data as Issue[]) ?? [];
    setIssues(list);
    setLoading(false);

    // Sign photo URLs
    const allPaths = list.flatMap(i => i.photo_paths);
    if (allPaths.length) {
      const { data: signed } = await supabase.storage.from("issue-photos").createSignedUrls(allPaths, 3600);
      const map: Record<string, string> = {};
      signed?.forEach(s => { if (s.signedUrl && s.path) map[s.path] = s.signedUrl; });
      setPhotoUrls(map);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId]);

  const reset = () => {
    setTitle(""); setDescription(""); setPriority("medium"); setFiles([]);
  };

  const submit = async () => {
    const t = title.trim(), d = description.trim();
    if (t.length < 3) return toast.error("Add a short title (3+ characters)");
    if (d.length < 10) return toast.error("Describe the issue (10+ characters)");
    if (t.length > 120) return toast.error("Title too long (max 120)");
    if (d.length > 2000) return toast.error("Description too long (max 2000)");
    if (files.length > 5) return toast.error("Max 5 photos");

    setSubmitting(true);

    // Upload photos first
    const paths: string[] = [];
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} is too large (max 5MB)`); setSubmitting(false); return; }
      const ext = f.name.split(".").pop() ?? "jpg";
      const path = `${ownerId}/${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("issue-photos").upload(path, f, { contentType: f.type });
      if (error) { toast.error(`Upload failed: ${error.message}`); setSubmitting(false); return; }
      paths.push(path);
    }

    const { error } = await supabase.from("maintenance_issues").insert({
      owner_id: ownerId,
      tenant_id: tenantId,
      property_id: propertyId,
      unit_id: unitId,
      title: t,
      description: d,
      priority,
      photo_paths: paths,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Issue reported. Your landlord has been notified.");
    setOpen(false);
    reset();
    load();
  };

  return (
    <section className="bg-card border border-border">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium">Maintenance issues</h2>
        <Button size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Report issue
        </Button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : issues.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-sm">
          No issues reported yet. Use “Report issue” for repairs or problems in your unit.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {issues.map(i => {
            const s = statusConfig[i.status];
            const Icon = s.Icon;
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
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{i.description}</p>
                    {i.photo_paths.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {i.photo_paths.map(p => photoUrls[p] && (
                          <a key={p} href={photoUrls[p]} target="_blank" rel="noreferrer">
                            <img src={photoUrls[p]} alt="" className="h-16 w-16 object-cover rounded-sm border border-border" />
                          </a>
                        ))}
                      </div>
                    )}
                    {i.resolution_note && (
                      <div className="mt-2 text-xs bg-accent-soft border border-accent/30 p-2 rounded-sm">
                        <span className="font-medium">Resolution: </span>{i.resolution_note}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1.5">
                      Reported {new Date(i.created_at).toLocaleDateString()}
                      {i.resolved_at && ` · Resolved ${new Date(i.resolved_at).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Report an issue</DialogTitle>
            <DialogDescription>Describe the problem so your landlord can dispatch help.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Leaking kitchen tap" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="When it started, what's happening, anything else useful…" maxLength={2000} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={priority} onChange={e => setPriority(e.target.value as any)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High — urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Photos (optional, max 5)</Label>
              <Input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, idx) => (
                    <div key={idx} className="text-xs flex items-center gap-1 border border-border px-2 py-1 rounded-sm">
                      <ImageIcon className="h-3 w-3" />{f.name}
                      <button onClick={() => setFiles(files.filter((_, i) => i !== idx))} className="ml-1 text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit issue"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
