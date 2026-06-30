import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, Coins, TrendingUp, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { formatKsh } from "@/lib/currency";

interface Stats {
  properties: number;
  tenants: number;
  monthlyRevenue: number;
  occupancy: number;
}

export default function LandlordDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ properties: 0, tenants: 0, monthlyRevenue: 0, occupancy: 0 });
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: props }, { data: tenants }] = await Promise.all([
        supabase.from("properties").select("id, name, city, units_count, monthly_rent_ksh, status, cover_image_url, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
        supabase.from("tenants").select("id, monthly_rent_ksh, status, property_id").eq("owner_id", user.id),
      ]);
      const propsArr = props ?? [];
      const tenantsArr = tenants ?? [];
      const activeTenants = tenantsArr.filter(t => t.status === "active");
      const totalUnits = propsArr.reduce((sum, p) => sum + (p.units_count ?? 0), 0);
      const monthlyRevenue = activeTenants.reduce((sum, t) => sum + Number(t.monthly_rent_ksh ?? 0), 0);
      const occupancy = totalUnits > 0 ? Math.min(100, Math.round((activeTenants.length / totalUnits) * 100)) : 0;

      setStats({ properties: propsArr.length, tenants: activeTenants.length, monthlyRevenue, occupancy });
      setRecent(propsArr.slice(0, 4));
      setLoading(false);
    };
    load();
  }, [user]);

  const cards = [
    { label: "Properties", value: stats.properties, icon: Building2 },
    { label: "Active tenants", value: stats.tenants, icon: Users },
    { label: "Monthly revenue", value: formatKsh(stats.monthlyRevenue), icon: Coins },
    { label: "Occupancy", value: `${stats.occupancy}%`, icon: TrendingUp },
  ];

  return (
    <LandlordLayout
      title="Overview"
      action={
        <Button asChild>
          <Link to="/landlord/properties/new"><Plus className="h-4 w-4" /> New property</Link>
        </Button>
      }
    >
      {/* Welcome */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3 text-accent text-xs uppercase tracking-[0.25em]">
          <span className="gold-rule" /><span>Today</span>
        </div>
        <h2 className="font-serif text-3xl md:text-4xl text-balance">Your portfolio at a glance.</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border p-6">
            <c.icon className="h-5 w-5 text-accent mb-4" strokeWidth={1.75} />
            <div className="font-serif text-3xl mb-1">{loading ? "—" : c.value}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Recent properties */}
      <div className="bg-card border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-serif text-xl">Recent properties</h3>
          <Link to="/landlord/properties" className="text-sm text-accent hover:underline">View all →</Link>
        </div>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-muted-foreground mb-6">No properties yet. Add your first to get started.</p>
            <Button asChild><Link to="/landlord/properties/new"><Plus className="h-4 w-4" /> Add property</Link></Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((p) => (
              <li key={p.id}>
                <Link to={`/landlord/properties/${p.id}`} className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors">
                  <div className="h-14 w-20 bg-secondary flex-shrink-0 overflow-hidden">
                    {p.cover_image_url
                      ? <img src={p.cover_image_url} alt="" className="h-full w-full object-cover" />
                      : <div className="h-full w-full flex items-center justify-center"><Building2 className="h-5 w-5 text-muted-foreground/40" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{p.city} · {p.units_count} unit{p.units_count !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatKsh(p.monthly_rent_ksh)}</div>
                    <div className="text-xs text-muted-foreground">/ month</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </LandlordLayout>
  );
}
