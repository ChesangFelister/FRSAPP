import { useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
}

export default function ImageUpload({ value, onChange, label = "Cover image", className }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB."); return; }

    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("property-images").upload(filename, file, { upsert: false });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("property-images").getPublicUrl(filename);
    onChange(data.publicUrl);
    setUploading(false);
  };

  return (
    <div className={className}>
      <label className="text-sm font-medium block mb-2">{label}</label>
      {value ? (
        <div className="relative aspect-[16/10] bg-secondary border border-border overflow-hidden group">
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 h-8 w-8 bg-background/90 hover:bg-background rounded-sm flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className={cn(
          "flex flex-col items-center justify-center aspect-[16/10] border-2 border-dashed border-border bg-secondary/30 hover:bg-secondary/60 cursor-pointer transition-colors",
          uploading && "pointer-events-none opacity-60"
        )}>
          {uploading ? (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          ) : (
            <>
              <Upload className="h-7 w-7 text-muted-foreground mb-2" strokeWidth={1.5} />
              <span className="text-sm font-medium">Click to upload</span>
              <span className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5 MB</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
