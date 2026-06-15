import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, LogOut, Home, ArrowLeft, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";
import TenantLeaseDocuments from "@/components/tenant/TenantLeaseDocuments";

interface TenantRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  property_id: string | null;
  unit_id: string | null;
  unit_label: string | null;
  monthly_rent_ksh: number;
  lease_start: string | null;
  lease_end: string | null;
  status: string;
}

export default function TenantProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<{ name: string; address: string; city: string } | null>(null);
  const [unit, setUnit] = useState<{ label: string; status: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: t } = await supabase
        .from("tenants").select("*").eq("user_id", user.id).maybeSingle();
      if (!t) { setLoading(false); return; }
      setTenant(t as TenantRow);
      setPhone(t.phone ?? "");

      const [{ data: prop }, { data: u }] = await Promise.all([
        t.property_id
          ? supabase.from("properties").select("name, address, city").eq("id", t.property_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        t.unit_id
          ? supabase.from("units").select("label, status").eq("id", t.unit_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setProperty(prop ?? null);
      setUnit(u ?? null);
      setLoading(false);
    };
    load();
  }, [user]);

  const savePhone = async () => {
    if (!tenant || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({ phone: phone.trim() || null })
      .eq("id", tenant.id)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Phone number updated");
    setTenant({ ...tenant, phone: phone.trim() || null });
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-subtle">
        <h1 className="font-serif text-3xl mb-3">No tenant record linked</h1>
        <p className="text-muted-foreground max-w-md mb-6">Your account isn't linked to a tenant record yet.</p>
        <Button variant="outline" onClick={handleSignOut}><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>
    );
  }

  const phoneChanged = (phone.trim() || null) !== (tenant.phone ?? null);

  return (
    <div className="min-h-screen bg-subtle">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/frs-logo.png" alt="" className="h-8 w-8 object-contain bg-primary-foreground/10 rounded-sm p-1" />
            <span className="font-serif text-xl">Flashrentsolution</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline-light" size="sm" asChild>
              <Link to="/tenant/dashboard"><ArrowLeft className="h-3.5 w-3.5" /> Dashboard</Link>
            </Button>
            <Button variant="outline-light" size="sm" onClick={handleSignOut}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="font-serif text-4xl mb-1 flex items-center gap-3"><User className="h-7 w-7 text-muted-foreground" /> Profile</h1>
          <p className="text-muted-foreground">Your account, lease and contact info.</p>
        </div>

        {/* Account */}
        <section className="bg-card border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-medium">Account</h2>
          </div>
          <dl className="px-6 py-5 grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Full name</dt>
              <dd className="font-medium">{tenant.full_name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Email</dt>
              <dd className="font-medium">{tenant.email ?? user?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Status</dt>
              <dd className="font-medium capitalize">{tenant.status}</dd>
            </div>
          </dl>
        </section>

        {/* Property + unit */}
        <section className="bg-card border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Home className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Property &amp; unit</h2>
          </div>
          <dl className="px-6 py-5 grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Property</dt>
              <dd className="font-medium">{property?.name ?? "—"}</dd>
              {property && <dd className="text-xs text-muted-foreground mt-0.5">{property.address}, {property.city}</dd>}
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Unit</dt>
              <dd className="font-medium">{unit?.label ?? tenant.unit_label ?? "—"}</dd>
              {unit && <dd className="text-xs text-muted-foreground mt-0.5 capitalize">{unit.status}</dd>}
            </div>
          </dl>
        </section>

        {/* Lease */}
        <section className="bg-card border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-medium">Lease</h2>
          </div>
          <dl className="px-6 py-5 grid sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Start</dt>
              <dd className="font-medium">{tenant.lease_start ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">End</dt>
              <dd className="font-medium">{tenant.lease_end ?? "Open-ended"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Monthly rent</dt>
              <dd className="font-medium">{formatKsh(Number(tenant.monthly_rent_ksh))}</dd>
            </div>
          </dl>
        </section>

        {/* Lease documents */}
        <TenantLeaseDocuments tenantId={tenant.id} />

        {/* Editable phone */}
        <section className="bg-card border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-medium">Contact</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 7XX XXX XXX"
              />
              <p className="text-xs text-muted-foreground">Your landlord uses this to reach you about rent and maintenance.</p>
            </div>
            <div>
              <Button onClick={savePhone} disabled={!phoneChanged || saving}>
                {saving ? "Saving…" : "Save phone"}
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
