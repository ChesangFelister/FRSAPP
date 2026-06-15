import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function SiteHeader() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  const isLandlord = !!user && roles.includes("landlord");

  const dashboardPath = (() => {
    if (roles.includes("admin")) return "/admin";
    if (roles.includes("landlord")) return "/landlord/dashboard";
    if (roles.includes("caretaker")) return "/caretaker";
    if (roles.includes("service_provider")) return "/service-provider";
    return "/";
  })();

  useEffect(() => {
    if (!isLandlord || !user) {
      setPendingCount(0);
      return;
    }

    const load = async () => {
      const { count } = await supabase
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "notice");
      setPendingCount(count ?? 0);
    };
    load();

    const channel = supabase
      .channel("tenants-pending")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tenants", filter: `owner_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLandlord, user]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 shadow-sm backdrop-blur">
      <div className="container-wide flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2">
          <img src="/frs-logo.png" alt="Flashrentsolution logo" className="h-8 w-8 object-contain" />
          <span className="font-serif text-xl tracking-tight">Flashrentsolution</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {user && roles.includes("admin") && (
            <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors">Admin</Link>
          )}
          {isLandlord && (
            <>
              <Link to="/landlord/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
              <Link to="/landlord/properties" className="text-muted-foreground hover:text-foreground transition-colors">Properties</Link>
              <Link
                to="/landlord/tenants"
                className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
              >
                Tenants
                {pendingCount > 0 && (
                  <span
                    aria-label={`${pendingCount} pending tenant actions`}
                    className="inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground"
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            </>
          )}
          {user && roles.includes("caretaker") && !roles.includes("landlord") && (
            <Link to="/caretaker" className="text-muted-foreground hover:text-foreground transition-colors">Caretaker</Link>
          )}
          {user && roles.includes("service_provider") && !roles.includes("landlord") && (
            <Link to="/service-provider" className="text-muted-foreground hover:text-foreground transition-colors">Service</Link>
          )}
          {!user && (
            <>
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Platform</Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate(dashboardPath)}>Dashboard</Button>
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>Sign out</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="gold" asChild>
                <Link to="/demo" className="inline-block px-3 py-1">Request a demo</Link>
              </Button>
              <Button size="sm" onClick={() => navigate("/pricing")}>Get started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
