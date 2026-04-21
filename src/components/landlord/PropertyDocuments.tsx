import { useEffect, useState } from "react";
import { Upload, FileText, Download, Trash2, Loader2, File } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Category = "lease" | "inspection" | "certificate" | "other";

interface Doc {
  id: string;
  name: string;
  category: Category;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

const CATEGORY_LABEL: Record<Category, string> = {
  lease: "Lease",
  inspection: "Inspection",
  certificate: "Certificate",
  other: "Other",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PropertyDocuments({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<Category>("lease");

  const load = async () => {
    const { data, error } = await supabase
      .from("property_documents")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [propertyId]);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File must be under 20 MB."); return; }

    setUploading(true);
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${user.id}/${propertyId}/${crypto.randomUUID()}-${safeName}`;

    const { error: upErr } = await supabase.storage.from("property-documents").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }

    const { error: insErr } = await supabase.from("property_documents").insert({
      property_id: propertyId,
      owner_id: user.id,
      name: file.name,
      category,
      file_path: path,
      file_size: file.size,
      mime_type: file.type || null,
    });
    if (insErr) {
      toast.error(insErr.message);
      await supabase.storage.from("property-documents").remove([path]);
    } else {
      toast.success("Document uploaded");
      await load();
    }
    setUploading(false);
  };

  const handleDownload = async (doc: Doc) => {
    const { data, error } = await supabase.storage
      .from("property-documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data) { toast.error(error?.message ?? "Could not generate link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (doc: Doc) => {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    await supabase.storage.from("property-documents").remove([doc.file_path]);
    const { error } = await supabase.from("property_documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted");
    setDocs((d) => d.filter((x) => x.id !== doc.id));
  };

  return (
    <div>
      {/* Uploader */}
      <div className="bg-card border border-border p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lease">Lease</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="certificate">Certificate</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className={cn(
            "inline-flex items-center justify-center gap-2 h-10 px-4 bg-primary text-primary-foreground hover:brightness-110 cursor-pointer transition-all text-sm font-medium",
            uploading && "pointer-events-none opacity-60"
          )}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload document"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              disabled={uploading}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-3">PDF, Word, or image. Max 20 MB. Files are private to you.</p>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-muted-foreground text-sm p-8 text-center">Loading documents…</div>
      ) : docs.length === 0 ? (
        <div className="bg-card border border-border p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.25} />
          <div className="text-sm text-muted-foreground">No documents yet. Upload your first lease or certificate above.</div>
        </div>
      ) : (
        <ul className="bg-card border border-border divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 bg-secondary border border-border flex items-center justify-center shrink-0">
                <File className="h-5 w-5 text-accent" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span className="uppercase tracking-widest text-accent">{CATEGORY_LABEL[d.category]}</span>
                  <span>·</span>
                  <span>{formatBytes(d.file_size)}</span>
                  <span>·</span>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleDownload(d)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(d)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
