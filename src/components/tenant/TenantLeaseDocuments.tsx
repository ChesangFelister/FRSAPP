import { useEffect, useState } from "react";
import { Upload, FileText, Download, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

export default function TenantLeaseDocuments({ tenantId }: { tenantId: string }) {
  const folder = `tenant-uploads/${tenantId}`;
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
    const path = `${folder}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("property-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    e.target.value = "";
    if (error) { toast.error(error.message); return; }
    toast.success("Document uploaded");
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
    if (!confirm(`Delete "${displayName(fileName)}"?`)) return;
    const { error } = await supabase.storage
      .from("property-documents")
      .remove([`${folder}/${fileName}`]);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted");
    load();
  };

  // Strip "<timestamp>-" prefix added at upload time
  const displayName = (storedName: string) => storedName.replace(/^\d+-/, "");

  return (
    <section className="bg-card border border-border">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium">Lease documents</h2>
        <div className="ml-auto">
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

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : files.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          No documents yet. Upload your signed lease, ID copy, or any other supporting documents.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {files.map((f) => (
            <li key={f.name} className="px-6 py-3 flex items-center gap-4 hover:bg-secondary/30">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{displayName(f.name)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(f.metadata?.size)}
                  {f.created_at && <> · {new Date(f.created_at).toLocaleDateString()}</>}
                </div>
              </div>
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
