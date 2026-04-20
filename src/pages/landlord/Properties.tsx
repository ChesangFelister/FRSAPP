import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKsh } from "@/lib/currency";

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  units_count: number;
  monthly_rent_ksh: number;
  status: "active" | "draft" | "archived";
  cover_image_url: string | null;
  property_type: string;
}

const statusStyles: Record<string, string> = {
  active: "bg-accent-soft text-accent-foreground border-accent/40",
  draft: "bg-muted text-muted-foreground border-border",
  archived: "bg-secondary text-muted-foreground border-border",
};

export default function Properties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("properties").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      setProperties((data as Property[]) ?? []);
      setLoading(false);
    });
  }, [user]);

  const filtered = properties.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.city.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <LandlordLayout
      title="Properties"
      action={<Button asChild><Link to="/landlord/properties/new"><Plus className="h-4 w-4" /> New property</Link></Button>}
    >
      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search properties…" className="pl-9" />
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border p-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-5" strokeWidth={1.5} />
          <h3 className="font-serif text-2xl mb-2">{properties.length === 0 ? "No properties yet" : "No matches"}</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {properties.length === 0 ? "Add your first property to begin tracking units, tenants, and revenue." : "Try a different search term."}
          </p>
          {properties.length === 0 && (
            <Button asChild><Link to="/landlord/properties/new"><Plus className="h-4 w-4" /> Add your first property</Link></Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <Link key={p.id} to={`/landlord/properties/${p.id}`} className="group bg-card border border-border overflow-hidden hover:shadow-elegant transition-shadow">
              <div className="aspect-[16/10] bg-secondary overflow-hidden">
                {p.cover_image_url
                  ? <img src={p.cover_image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  : <div className="h-full w-full flex items-center justify-center"><Building2 className="h-10 w-10 text-muted-foreground/30" strokeWidth={1.25} /></div>}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-serif text-lg leading-tight truncate">{p.name}</h3>
                  <span className={`text-xs px-2 py-0.5 border uppercase tracking-wider ${statusStyles[p.status]}`}>{p.status}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate mb-4">{p.city} · {p.address}</p>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">{p.units_count} unit{p.units_count !== 1 ? "s" : ""} · {p.property_type}</span>
                  <span className="font-medium text-sm">{formatKsh(p.monthly_rent_ksh)}<span className="text-muted-foreground">/mo</span></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </LandlordLayout>
  );
}
