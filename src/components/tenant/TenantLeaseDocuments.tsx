import { useEffect, useMemo, useState } from "react";
import { Upload, FileText, Download, Trash2, Loader2, Eye, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortOrder = "newest" | "oldest";

type Category = "lease" | "id" | "receipt" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "lease", label: "Lease" },
  { value: "id", label: "ID" },
  { value: "receipt", label: "Payment receipt" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABEL: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<Category, string>;

const CATEGORY_BADGE: Record<Category, string> = {
  lease: "bg-accent-soft text-accent-foreground border-accent/40",
  id: "bg-blue-100 text-blue-900 border-blue-300",
  receipt: "bg-secondary text-foreground border-border",
  other: "bg-muted text-muted-foreground border-border",
};

interface StoredFile {
  name: string;
  id?: string;
  size?: number;
  created_at?: string;
  metadata?: { size?: number; mimetype?: string } | null;
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Storage names look like: "<timestamp>__<category>__<originalName>"
// Old files (no category) fall back to "other".
function parseStoredName(stored: string): { category: Category; display: string } {
  const m = stored.match(/^\d+__([a-z]+)__(.+)$/);
  if (m && (CATEGORIES as { value: string }[]).some((c) => c.value === m[1])) {
    return { category: m[1] as Category, display: m[2] };
  }
  return { category: "other", display: stored.replace(/^\d+-/, "") };
}

export default function TenantLeaseDocuments({ tenantId }: { tenantId: string }) {
  const folder = `tenant-uploads/${tenantId}`;
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<Category>("lease");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [preview, setPreview] = useState<{ name: string; display: string; url: string; mime: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = async (fileName: string, display: string, mime?: string) => {
    setPreviewLoading(true);
    const { data, error } = await supabase.storage
      .from("property-documents")
      .createSignedUrl(`${folder}/${fileName}`, 300);
    setPreviewLoading(false);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Could not load preview"); return; }
    setPreview({ name: fileName, display, url: data.signedUrl, mime: mime ?? "" });
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage
      .from("property-documents")
      .list(folder, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) toast.error(error.message);
    setFiles((data ?? []).filter((f) => f.name && f.name !== ".emptyFolderPlaceholder") as StoredFile[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File must be under 20 MB"); return; }
    setUploading(true);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${folder}/${Date.now()}__${uploadCategory}__${safeName}`;
    const { error } = await supabase.storage
      .from("property-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    e.target.value = "";
    if (error) { toast.error(error.message); return; }
    toast.success(`${CATEGORY_LABEL[uploadCategory]} document uploaded`);
    load();
  };

  const handleDownload = async (fileName: string) => {
    const { data, error } = await supabase.storage
      .from("property-documents")
      .createSignedUrl(`${folder}/${fileName}`, 60);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Could not get download link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (fileName: string) => {
    const { display } = parseStoredName(fileName);
    if (!confirm(`Delete "${display}"?`)) return;
    const { error } = await supabase.storage
      .from("property-documents")
      .remove([`${folder}/${fileName}`]);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted");
    load();
  };

  const decorated = useMemo(
    () => files.map((f) => ({ ...f, ...parseStoredName(f.name) })),
    [files],
  );

  const counts = useMemo(() => {
    const base: Record<Category | "all", number> = { all: decorated.length, lease: 0, id: 0, receipt: 0, other: 0 };
    decorated.forEach((d) => { base[d.category]++; });
    return base;
  }, [decorated]);

  const filtered = filter === "all" ? decorated : decorated.filter((d) => d.category === filter);
  const visible = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sort === "newest" ? tb - ta : ta - tb;
    });
    return arr;
  }, [filtered, sort]);

  const isPreviewable = (mime: string, name: string) => {
    const lower = name.toLowerCase();
    return (
      mime.startsWith("image/") ||
      mime === "application/pdf" ||
      lower.endsWith(".pdf") ||
      /\.(png|jpe?g|gif|webp|svg)$/.test(lower)
    );
  };

  return (
    <section className="bg-card border border-border">
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium">Lease documents</h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as Category)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="inline-flex">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button asChild size="sm" disabled={uploading}>
              <span>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload"}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-6 py-3 border-b border-border flex flex-wrap gap-2">
        {(["all", ...CATEGORIES.map((c) => c.value)] as (Category | "all")[]).map((key) => {
          const active = filter === key;
          const label = key === "all" ? "All" : CATEGORY_LABEL[key as Category];
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "text-xs px-3 py-1 border rounded-full transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-secondary",
              )}
            >
              {label} <span className="opacity-70">({counts[key]})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          {decorated.length === 0
            ? "No documents yet. Upload your signed lease, ID copy, payment receipts, or any other supporting documents."
            : `No ${filter === "all" ? "" : CATEGORY_LABEL[filter as Category].toLowerCase() + " "}documents.`}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((f) => (
            <li key={f.name} className="px-6 py-3 flex items-center gap-4 hover:bg-secondary/30">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{f.display}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(f.metadata?.size)}
                  {f.created_at && <> · {new Date(f.created_at).toLocaleDateString()}</>}
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm hidden sm:inline-block",
                  CATEGORY_BADGE[f.category],
                )}
              >
                {CATEGORY_LABEL[f.category]}
              </span>
              <Button variant="ghost" size="sm" onClick={() => handleDownload(f.name)} title="Download">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(f.name)} title="Delete">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="px-6 py-3 text-xs text-muted-foreground border-t border-border">
        Your landlord can view these documents. Files are private and not publicly accessible.
      </p>
    </section>
  );
}
