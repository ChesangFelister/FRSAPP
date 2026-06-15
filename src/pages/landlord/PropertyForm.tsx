import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import ImageUpload from "@/components/landlord/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type PropertyType = "apartment" | "house" | "commercial" | "land" | "other";
type PropertyStatus = "active" | "draft" | "archived";

interface FormState {
  name: string;
  address: string;
  city: string;
  property_type: PropertyType;
  units_count: number;
  monthly_rent_ksh: number;
  status: PropertyStatus;
  description: string;
  cover_image_url: string | null;
  caretaker_id: string | null;
  owner_id: string;
}

const empty: FormState = {
  name: "", address: "", city: "", property_type: "apartment",
  units_count: 1, monthly_rent_ksh: 0, status: "active", description: "", cover_image_url: null,
  caretaker_id: null,
  owner_id: "",
};

interface CaretakerOpt { id: string; full_name: string; }
interface LandlordOption { id: string; full_name: string | null; email: string | null; }

const NONE = "__none__";

export default function PropertyForm() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [caretakers, setCaretakers] = useState<CaretakerOpt[]>([]);
  const [landlords, setLandlords] = useState<LandlordOption[]>([]);

  useEffect(() => {
    if (!user) return;

    const loadCaretakers = async () => {
      const ownerId = roles.includes("admin") ? form.owner_id : user.id;
      if (ownerId) {
        const { data: builder } = await supabase.from("caretakers").select("id, full_name").eq("owner_id", ownerId).order("full_name");
        setCaretakers((builder as CaretakerOpt[]) ?? []);
      } else {
        setCaretakers([]);
      }

      if (roles.includes("admin")) {
        const { data: landlordRoles } = await supabase.from("user_roles").select("user_id").eq("role", "landlord");
        const landlordIds = Array.from(new Set((landlordRoles ?? []).map((item) => item.user_id))).filter(Boolean);
        const { data: profiles } = landlordIds.length
          ? await supabase.from("profiles").select("id, full_name, email").in("id", landlordIds)
          : { data: [] };
        setLandlords((profiles as LandlordOption[]) ?? []);
      }
    };

    loadCaretakers();
  }, [user, roles, form.owner_id]);

  useEffect(() => {
    if (isNew || !user) return;
    // scope fetch: non-admins must own the property
    const q = !roles.includes("admin")
      ? supabase.from("properties").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle()
      : supabase.from("properties").select("*").eq("id", id).maybeSingle();

    q.then(({ data, error }) => {
      if (error || !data) { toast.error("Property not found"); navigate("/landlord/properties"); return; }
      setForm({
        name: data.name, address: data.address, city: data.city,
        property_type: data.property_type, units_count: data.units_count,
        monthly_rent_ksh: Number(data.monthly_rent_ksh), status: data.status,
        description: data.description ?? "", cover_image_url: data.cover_image_url,
        caretaker_id: (data as any).caretaker_id ?? null,
        owner_id: (data as any).owner_id ?? "",
      });
      setLoading(false);
    });
  }, [id, isNew, navigate, user]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.caretaker_id && !caretakers.some((c) => c.id === form.caretaker_id)) {
      toast.error("Selected caretaker doesn't belong to your account");
      return;
    }
    if (roles.includes("admin") && !form.owner_id) {
      toast.error("Select a landlord for this property.");
      return;
    }
    setSaving(true);
    const payload = { ...form, owner_id: roles.includes("admin") ? form.owner_id : user.id };
    const { data, error } = isNew
      ? await supabase.from("properties").insert(payload).select().single()
      : await (roles.includes("admin")
        ? supabase.from("properties").update(payload).eq("id", id!).select().single()
        : supabase.from("properties").update(payload).eq("id", id!).eq("owner_id", user.id).select().single());
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Property created" : "Changes saved");
    navigate(`/landlord/properties/${data.id}`);
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    const { error } = roles.includes("admin")
      ? await supabase.from("properties").delete().eq("id", id)
      : await supabase.from("properties").delete().eq("id", id).eq("owner_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Property deleted");
    navigate("/landlord/properties");
  };

  if (loading) {
    return <LandlordLayout><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></LandlordLayout>;
  }

  return (
    <LandlordLayout title={isNew ? "New property" : "Edit property"}>
      <Link to="/landlord/properties" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to properties
      </Link>

      <form onSubmit={handleSave} className="grid lg:grid-cols-3 gap-6 max-w-6xl">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border p-6 lg:p-8 space-y-5">
            <h2 className="font-serif text-xl mb-2">Property details</h2>

            <div className="space-y-2">
              <Label htmlFor="name">Property name *</Label>
              <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Riverside Heights" />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="address">Street address *</Label>
                <Input id="address" required value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Ngong Road" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" required value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Nairobi" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={form.property_type} onValueChange={(v) => update("property_type", v as PropertyType)}>
                  <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="units">Units</Label>
                <Input id="units" type="number" min={1} value={form.units_count} onChange={(e) => update("units_count", parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rent">Monthly rent (KSh)</Label>
                <Input id="rent" type="number" min={0} step={100} value={form.monthly_rent_ksh} onChange={(e) => update("monthly_rent_ksh", parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" rows={4} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="A brief description for tenants and team members." />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border p-6 space-y-5">
            <ImageUpload value={form.cover_image_url} onChange={(url) => update("cover_image_url", url)} />

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v as PropertyStatus)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Active properties appear in your public listings.</p>
            </div>

            {roles.includes("admin") && (
              <div className="space-y-2">
                <Label htmlFor="owner">Landlord owner *</Label>
                <Select value={form.owner_id} onValueChange={(v) => update("owner_id", v)}>
                  <SelectTrigger id="owner"><SelectValue placeholder="Select landlord" /></SelectTrigger>
                  <SelectContent>
                    {landlords.length === 0
                      ? <SelectItem value="">No landlords available</SelectItem>
                      : landlords.map((landlord) => (
                        <SelectItem key={landlord.id} value={landlord.id}>
                          {landlord.full_name ?? landlord.email ?? landlord.id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assign this property to a landlord account. Landlord accounts are loaded from current users with the landlord role.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="caretaker">Assigned caretaker</Label>
              <Select
                value={form.caretaker_id ?? NONE}
                onValueChange={(v) => update("caretaker_id", v === NONE ? null : v)}
              >
                <SelectTrigger id="caretaker"><SelectValue placeholder="No caretaker" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No caretaker</SelectItem>
                  {caretakers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {caretakers.length === 0
                  ? <>No caretakers yet. <Link to="/landlord/caretakers" className="text-accent hover:underline">Add one →</Link></>
                  : "Manage caretakers from the Caretakers page."}
              </p>
            </div>
          </div>

          <div className="bg-card border border-border p-6 space-y-3">
            <Button type="submit" className="w-full" size="lg" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isNew ? "Create property" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => navigate(-1)}>Cancel</Button>

            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" /> Delete property
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this property?</AlertDialogTitle>
                    <AlertDialogDescription>This permanently removes the property and all its images. Tenant records remain but become unassigned.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </form>
    </LandlordLayout>
  );
}
