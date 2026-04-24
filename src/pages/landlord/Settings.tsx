import { useEffect, useRef, useState } from "react";
import { Upload, Save, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("receipt_settings")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) {
        setBusinessName(data.business_name ?? "");
        setAddress(data.address ?? "");
        setLogoUrl(data.logo_url ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipt-logos").upload(path, file, { upsert: true });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data } = supabase.storage.from("receipt-logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
    toast.success("Logo uploaded");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("receipt_settings").upsert({
      owner_id: user.id,
      business_name: businessName || null,
      address: address || null,
      logo_url: logoUrl,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Receipt settings saved");
  };

  const removeLogo = () => { setLogoUrl(null); toast.info("Logo will be removed on save"); };

  return (
    <LandlordLayout title="Settings">
      <div className="max-w-2xl space-y-8">
        <section className="bg-card border border-border p-6 lg:p-8">
          <div className="mb-6">
            <h2 className="font-serif text-2xl mb-1">Receipt branding</h2>
            <p className="text-sm text-muted-foreground">Customize how your downloaded tenant receipts look.</p>
          </div>

          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 border border-border bg-secondary/40 flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo preview" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload logo"}
                    </Button>
                    {logoUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeLogo} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, or SVG. Max 2MB. Square works best.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="biz-name">Business name</Label>
                <Input id="biz-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Karibu Properties Ltd" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="biz-address">Address</Label>
                <Textarea
                  id="biz-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, city, postal code, phone, email"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Appears under your business name on receipts.</p>
              </div>

              <div className="pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </LandlordLayout>
  );
}
