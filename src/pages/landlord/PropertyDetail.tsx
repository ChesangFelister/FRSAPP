import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Building2, Pencil, Users, Coins, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PropertyDocuments from "@/components/landlord/PropertyDocuments";
import { formatKsh } from "@/lib/currency";

export default function PropertyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [property, setProperty] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from("properties").select("*").eq("id", id).maybeSingle(),
        supabase.from("tenants").select("*").eq("property_id", id).order("created_at", { ascending: false }),
      ]);
      setProperty(p);
      setTenants(t ?? []);
      setLoading(false);
    };
    load();
  }, [id, user]);

  if (loading) return <LandlordLayout><div className="text-muted-foreground">Loading…</div></LandlordLayout>;
  if (!property) return <LandlordLayout><div>Not found.</div></LandlordLayout>;

  const activeTenants = tenants.filter(t => t.status === "active");
  const collected = activeTenants.reduce((s, t) => s + Number(t.monthly_rent_ksh ?? 0), 0);
  const occupancy = property.units_count > 0 ? Math.min(100, Math.round((activeTenants.length / property.units_count) * 100)) : 0;

  return (
    <LandlordLayout
      title={property.name}
      action={
        <Button asChild variant="outline">
          <Link to={`/landlord/properties/${property.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
        </Button>
      }
    >
      <Link to="/landlord/properties" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to properties
      </Link>

      {/* Hero */}
      <div className="grid lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-3 aspect-[16/10] bg-secondary overflow-hidden border border-border">
          {property.cover_image_url
            ? <img src={property.cover_image_url} alt={property.name} className="h-full w-full object-cover" />
            : <div className="h-full w-full flex items-center justify-center"><Building2 className="h-16 w-16 text-muted-foreground/30" strokeWidth={1.25} /></div>}
        </div>
        <div className="lg:col-span-2 bg-card border border-border p-6 lg:p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-3 text-accent text-xs uppercase tracking-[0.25em]">
            <span className="gold-rule" /><span>{property.property_type}</span>
          </div>
          <h1 className="font-serif text-3xl mb-3 text-balance">{property.name}</h1>
          <div className="flex items-start gap-2 text-muted-foreground text-sm mb-6">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{property.address}, {property.city}</span>
          </div>
          {property.description && (
            <p className="text-sm text-foreground/80 leading-relaxed mb-6">{property.description}</p>
          )}
          <div className="mt-auto pt-6 border-t border-border">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Listed at</div>
            <div className="font-serif text-3xl">{formatKsh(property.monthly_rent_ksh)}<span className="text-sm text-muted-foreground font-sans"> / month</span></div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total units", value: property.units_count, icon: Building2 },
          { label: "Active tenants", value: activeTenants.length, icon: Users },
          { label: "Monthly collected", value: formatKsh(collected), icon: Coins },
          { label: "Occupancy", value: `${occupancy}%`, icon: TrendingUp },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-border p-5">
            <c.icon className="h-4 w-4 text-accent mb-3" strokeWidth={1.75} />
            <div className="font-serif text-2xl mb-0.5">{c.value}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="bg-card border border-border rounded-none h-auto p-0">
          <TabsTrigger value="tenants" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent px-6 py-3">Tenants</TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent px-6 py-3">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="mt-6">
          <div className="bg-card border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-xl">Tenants at this property</h3>
              <Button asChild size="sm" variant="outline"><Link to="/landlord/tenants">Manage tenants →</Link></Button>
            </div>
            {tenants.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No tenants yet for this property.</div>
            ) : (
              <ul className="divide-y divide-border">
                {tenants.map((t) => (
                  <li key={t.id} className="flex items-center gap-4 p-4">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-serif text-sm">
                      {t.full_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.full_name}</div>
                      <div className="text-sm text-muted-foreground truncate">{t.unit_label ?? "—"} · {t.email ?? t.phone ?? "no contact"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">{formatKsh(t.monthly_rent_ksh)}</div>
                      <div className="text-xs text-muted-foreground capitalize">{t.status}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <PropertyDocuments propertyId={property.id} />
        </TabsContent>
      </Tabs>
    </LandlordLayout>
  );
}
