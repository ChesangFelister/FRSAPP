import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function SiteHeader() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = (() => {
    if (roles.includes("admin")) return "/admin";
    if (roles.includes("landlord")) return "/landlord/dashboard";
    if (roles.includes("caretaker")) return "/caretaker";
    if (roles.includes("service_provider")) return "/service-provider";
    return "/";
  })();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-wide flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground font-serif text-lg">E</span>
          <span className="font-serif text-xl tracking-tight">Estate</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Platform</Link>
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate(dashboardPath)}>Dashboard</Button>
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>Sign out</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Sign in</Button>
              <Button size="sm" onClick={() => navigate("/auth?mode=register")}>Get started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
