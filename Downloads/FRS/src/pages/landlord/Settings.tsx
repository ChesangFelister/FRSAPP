import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Save, Trash2, Image as ImageIcon, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fetchLogoAsDataUrl, receiptPdfDataUrl, type ReceiptData } from "@/lib/receipt";

export default function Settings() {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
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
        if (data.logo_url) {
          const d = await fetchLogoAsDataUrl(data.logo_url);
          setLogoDataUrl(d);
        }
      }
      setLoading(false);
    })();
  }, [user]);

  // Build sample receipt data for the preview
  const sample: ReceiptData = useMemo(() => ({
    receiptNumber: "PREVIEW-0001",
    issueDate: new Date().toISOString().slice(0, 10),
    landlord: { name: user?.user_metadata?.full_name ?? "Your name", email: user?.email ?? "you@example.com" },
    tenant: { name: "Jane Wanjiku", email: "jane@example.com", phone: "+254 700 000 000", unit: "A4" },
    property: { name: "Kilimani Heights", address: "Argwings Kodhek Rd, Nairobi" },
    payment: {
      period_month: new Date().getMonth() + 1,
      period_year: new Date().getFullYear(),
      amount_due: 35000,
      amount_paid: 35000,
      paid_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(new Date().getFullYear(), new Date().getMonth(), 5).toISOString().slice(0, 10),
      method: "M-Pesa",
      reference: "QGH7XYZ123",
      status: "paid",
      notes: "Sample receipt — your real receipts will look like this.",
    },
    branding: {
      businessName: businessName || null,
      address: address || null,
      logoDataUrl,
    },
  }), [businessName, address, logoDataUrl, user]);

  // Regenerate preview (debounced) whenever inputs change
  useEffect(() => {
    if (loading) return;
    const id = setTimeout(() => {
      try {
        setPreviewUrl(receiptPdfDataUrl(sample));
      } catch {
        // ignore preview failures
      }
    }, 200);
    return () => clearTimeout(id);
  }, [sample, loading]);

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
    // Use local file directly for instant preview (no re-fetch round trip)
    const reader = new FileReader();
    reader.onloadend = () => setLogoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
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

  const removeLogo = () => {
    setLogoUrl(null);
    setLogoDataUrl(null);
    toast.info("Logo will be removed on save");
  };

  return (
    <LandlordLayout title="Settings">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] max-w-6xl">
        {/* Form */}
        <section className="bg-card border border-border p-6 lg:p-8 h-fit">
          <div className="mb-6">
            <h2 className="font-serif text-2xl mb-1">Receipt branding</h2>
            <p className="text-sm text-muted-foreground">Customize how your downloaded tenant receipts look. Preview updates live.</p>
          </div>

          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 border border-border bg-secondary/40 flex items-center justify-center overflow-hidden">
                    {logoDataUrl || logoUrl ? (
                      <img src={logoDataUrl || logoUrl!} alt="Logo preview" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload logo"}
                    </Button>
                    {(logoDataUrl || logoUrl) && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeLogo} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">PNG or JPG. Max 2MB. Square works best. SVG isn't embedded in PDFs.</p>
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

        {/* Live preview */}
        <section className="bg-card border border-border p-4 lg:p-6 sticky top-20 h-fit">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">Live preview</h3>
          </div>
          <div className="bg-secondary/40 border border-border" style={{ height: 720 }}>
            {previewUrl ? (
              <iframe
                title="Receipt preview"
                src={previewUrl}
                className="w-full h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Generating preview…</div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Sample data shown — your real receipts use actual tenant and payment details.</p>
        </section>
      </div>
    </LandlordLayout>
  );
}
