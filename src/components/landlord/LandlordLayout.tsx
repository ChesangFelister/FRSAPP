import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Users, LogOut, Menu, Wallet, CalendarClock, HardHat, Receipt, Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/landlord/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/landlord/properties", label: "Properties", icon: Building2 },
  { to: "/landlord/tenants", label: "Tenants", icon: Users },
  { to: "/landlord/caretakers", label: "Caretakers", icon: HardHat },
  { to: "/landlord/payments", label: "Payments", icon: Receipt },
  { to: "/landlord/reminders", label: "Reminders", icon: CalendarClock },
  { to: "/landlord/settings", label: "Settings", icon: SettingsIcon },
  { to: "/landlord/financials", label: "Financials", icon: Wallet, soon: true },
];

export default function LandlordLayout({ children, title, action }: { children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  return (
    <div className="min-h-screen flex bg-subtle">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-primary text-primary-foreground flex flex-col transition-transform lg:translate-x-0 lg:static",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Link to="/" className="flex items-center gap-2 px-6 h-16 border-b border-primary-foreground/10">
          <img src="/frs-logo.png" alt="Flashrentsolution logo" className="h-8 w-8 object-contain bg-primary-foreground/10 rounded-sm p-1" />
          <span className="font-serif text-xl">Flashrentsolution</span>
        </Link>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {nav.map((item) => (
            item.soon ? (
              <div
                key={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-primary-foreground/50 cursor-not-allowed"
                aria-disabled="true"
              >
                <item.icon className="h-4 w-4" strokeWidth={1.75} />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-widest bg-accent/20 text-accent px-1.5 py-0.5 rounded-sm">Soon</span>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors",
                  isActive
                    ? "bg-accent/15 text-accent border-l-2 border-accent pl-[10px]"
                    : "text-primary-foreground/75 hover:bg-primary-foreground/5 hover:text-primary-foreground"
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
              </NavLink>
            )
          ))}
        </nav>

        <div className="border-t border-primary-foreground/10 p-4">
          <div className="text-xs text-primary-foreground/60 mb-1">Signed in as</div>
          <div className="text-sm font-medium truncate mb-3">{user?.email}</div>
          <Button variant="outline-light" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-background border-b border-border h-16 flex items-center px-6 gap-4">
          <button className="lg:hidden p-2 -ml-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          {title && <h1 className="font-serif text-2xl truncate">{title}</h1>}
          <div className="ml-auto">{action}</div>
        </header>
        <main className="flex-1 p-6 lg:p-10 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
