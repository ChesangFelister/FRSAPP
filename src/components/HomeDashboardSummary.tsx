import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, Bell, BarChart3, Wrench, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth, AppRole } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { differenceInCalendarDays } from "date-fns";

interface Reminder {
  id: string;
  title: string;
  date: string;
  notes?: string;
}

function readReminders(userId: string): Reminder[] {
  try {
    const raw = localStorage.getItem(`reminders:${userId}`);
    return raw ? (JSON.parse(raw) as Reminder[]) : [];
  } catch {
    return [];
  }
}

export default function HomeDashboardSummary() {
  const { user, roles, loading } = useAuth();
  const [propertiesCount, setPropertiesCount] = useState<number | null>(null);
  const [tenantsCount, setTenantsCount] = useState<number | null>(null);
  const [pendingTenants, setPendingTenants] = useState<number>(0);
  const [upcomingReminders, setUpcomingReminders] = useState<number>(0);

  const primaryRole: AppRole | null =
    roles.includes("admin") ? "admin"
    : roles.includes("landlord") ? "landlord"
    : roles.includes("caretaker") ? "caretaker"
    : roles.includes("service_provider") ? "service_provider"
    : roles.includes("tenant") ? "tenant"
    : null;

  useEffect(() => {
    if (!user || primaryRole !== "landlord") return;
    let cancelled = false;

    (async () => {
      const [{ count: pCount }, { count: tCount }, { count: noticeCount }] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "notice"),
      ]);
      if (cancelled) return;
      setPropertiesCount(pCount ?? 0);
      setTenantsCount(tCount ?? 0);
      setPendingTenants(noticeCount ?? 0);
    })();

    // Reminders from localStorage (within next 14 days)
    const today = new Date();
    const reminders = readReminders(user.id);
    const upcoming = reminders.filter((r) => {
      const diff = differenceInCalendarDays(new Date(r.date), today);
      return diff >= 0 && diff <= 14;
    }).length;
    setUpcomingReminders(upcoming);

    return () => {
      cancelled = true;
    };
  }, [user, primaryRole]);

  if (loading || !user || !primaryRole) return null;

  const fullName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "there";

  return (
    <section className="border-b border-border bg-subtle">
      <div className="container-wide py-14 lg:py-20">
        <div className="flex items-center gap-3 mb-4 text-accent text-xs uppercase tracking-[0.25em]">
          <span className="gold-rule" /><span>Your workspace</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl text-balance">Welcome back, {fullName}.</h2>
            <p className="text-muted-foreground mt-2 capitalize">
              Signed in as {primaryRole.replace("_", " ")}.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to={dashboardPath(primaryRole)}>
              Open dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>

        {primaryRole === "landlord" && (
          <LandlordCards
            properties={propertiesCount}
            tenants={tenantsCount}
            pending={pendingTenants}
            upcomingReminders={upcomingReminders}
          />
        )}

        {primaryRole === "admin" && <AdminCards />}
        {primaryRole === "caretaker" && <RoleCards role="caretaker" />}
        {primaryRole === "service_provider" && <RoleCards role="service_provider" />}
        {primaryRole === "tenant" && <RoleCards role="tenant" />}
      </div>
    </section>
  );
}

function dashboardPath(role: AppRole) {
  switch (role) {
    case "admin": return "/admin";
    case "landlord": return "/landlord/dashboard";
    case "caretaker": return "/caretaker";
    case "service_provider": return "/service-provider";
    default: return "/";
  }
}

interface LandlordProps {
  properties: number | null;
  tenants: number | null;
  pending: number;
  upcomingReminders: number;
}

function LandlordCards({ properties, tenants, pending, upcomingReminders }: LandlordProps) {
  const cards = [
    {
      icon: Building2,
      label: "Properties",
      value: properties ?? "—",
      hint: "In your portfolio",
      href: "/landlord/properties",
    },
    {
      icon: Users,
      label: "Tenants",
      value: tenants ?? "—",
      hint: pending > 0 ? `${pending} on notice` : "All current",
      href: "/landlord/tenants",
    },
    {
      icon: Bell,
      label: "Reminders",
      value: upcomingReminders,
      hint: "Due in next 14 days",
      href: "/landlord/reminders",
    },
    {
      icon: BarChart3,
      label: "Financials",
      value: "Soon",
      hint: "Coming soon",
      href: null as string | null,
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-sm overflow-hidden border border-border">
      {cards.map((c) => {
        const inner = (
          <div className="bg-card p-6 lg:p-7 h-full hover:bg-secondary/50 transition-colors">
            <div className="flex items-start justify-between mb-6">
              <c.icon className="h-6 w-6 text-accent" strokeWidth={1.5} />
              {c.href && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="font-serif text-3xl text-primary mb-1">{c.value}</div>
            <div className="text-sm font-medium">{c.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
          </div>
        );
        return c.href ? (
          <Link key={c.label} to={c.href} className="block">{inner}</Link>
        ) : (
          <div key={c.label} aria-disabled className="opacity-80">{inner}</div>
        );
      })}
    </div>
  );
}

function AdminCards() {
  const cards = [
    { icon: ShieldCheck, label: "Admin console", hint: "Manage roles & users", href: "/admin" },
    { icon: BarChart3, label: "Platform metrics", hint: "Coming soon", href: null },
  ];
  return <SimpleCards cards={cards} />;
}

function RoleCards({ role }: { role: AppRole }) {
  const map: Record<string, { label: string; hint: string; href: string }[]> = {
    caretaker: [
      { label: "Caretaker dashboard", hint: "Your assigned properties", href: "/caretaker" },
    ],
    service_provider: [
      { label: "Service provider dashboard", hint: "Open work orders", href: "/service-provider" },
    ],
    tenant: [],
  };
  const items = map[role] ?? [];
  const cards = items.map((i) => ({ icon: Wrench, ...i }));
  if (!cards.length) return null;
  return <SimpleCards cards={cards} />;
}

interface SimpleCard {
  icon: typeof Wrench;
  label: string;
  hint: string;
  href: string | null;
}

function SimpleCards({ cards }: { cards: SimpleCard[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-sm overflow-hidden border border-border">
      {cards.map((c) => {
        const inner = (
          <div className="bg-card p-6 lg:p-7 h-full hover:bg-secondary/50 transition-colors">
            <c.icon className="h-6 w-6 text-accent mb-5" strokeWidth={1.5} />
            <div className="text-sm font-medium">{c.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
          </div>
        );
        return c.href ? (
          <Link key={c.label} to={c.href} className="block">{inner}</Link>
        ) : (
          <div key={c.label} aria-disabled className="opacity-80">{inner}</div>
        );
      })}
    </div>
  );
}
