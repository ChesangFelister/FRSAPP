import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  Bell,
  BarChart3,
  Wrench,
  ShieldCheck,
  ArrowRight,
  FileText,
  CalendarClock,
  MessageSquare,
} from "lucide-react";
import { useAuth, AppRole } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { differenceInCalendarDays, format } from "date-fns";

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

function countUpcoming(reminders: Reminder[], days = 14) {
  const today = new Date();
  return reminders.filter((r) => {
    const diff = differenceInCalendarDays(new Date(r.date), today);
    return diff >= 0 && diff <= days;
  }).length;
}

interface TenantRow {
  id: string;
  full_name: string;
  status: "active" | "notice" | "ended";
  lease_start: string | null;
  lease_end: string | null;
  monthly_rent_ksh: number;
  unit_label: string | null;
}

export default function HomeDashboardSummary() {
  const { user, roles, loading } = useAuth();

  // Landlord data
  const [propertiesCount, setPropertiesCount] = useState<number | null>(null);
  const [tenantsCount, setTenantsCount] = useState<number | null>(null);
  const [pendingTenants, setPendingTenants] = useState<number>(0);

  // Tenant data (lease for the signed-in user, matched by email)
  const [tenantRecord, setTenantRecord] = useState<TenantRow | null>(null);

  // Reminders count (from localStorage, shared across roles)
  const [upcomingReminders, setUpcomingReminders] = useState<number>(0);

  const primaryRole: AppRole | null = useMemo(() => {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("landlord")) return "landlord";
    if (roles.includes("caretaker")) return "caretaker";
    if (roles.includes("service_provider")) return "service_provider";
    if (roles.includes("tenant")) return "tenant";
    return null;
  }, [roles]);

  // Reminders are stored client-side per user — load for every role
  useEffect(() => {
    if (!user) return;
    setUpcomingReminders(countUpcoming(readReminders(user.id)));
  }, [user]);

  // Landlord-only DB load
  useEffect(() => {
    if (!user || primaryRole !== "landlord") return;
    let cancelled = false;
    (async () => {
      const [{ count: pCount }, { count: tCount }, { count: noticeCount }] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase
          .from("tenants")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .eq("status", "notice"),
      ]);
      if (cancelled) return;
      setPropertiesCount(pCount ?? 0);
      setTenantsCount(tCount ?? 0);
      setPendingTenants(noticeCount ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, primaryRole]);

  // Tenant-only: find their tenant record by email
  useEffect(() => {
    if (!user || primaryRole !== "tenant" || !user.email) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, full_name, status, lease_start, lease_end, monthly_rent_ksh, unit_label")
        .eq("email", user.email!)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      setTenantRecord((data?.[0] as TenantRow | undefined) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, primaryRole]);

  if (loading || !user || !primaryRole) return null;

  const fullName =
    (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "there";

  return (
    <section className="border-b border-border bg-subtle">
      <div className="container-wide py-14 lg:py-20">
        <div className="flex items-center gap-3 mb-4 text-accent text-xs uppercase tracking-[0.25em]">
          <span className="gold-rule" />
          <span>Your workspace</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl text-balance">Welcome back, {fullName}.</h2>
            <p className="text-muted-foreground mt-2 capitalize">
              Signed in as {primaryRole.replace("_", " ")}.
            </p>
          </div>
          {dashboardPath(primaryRole) && (
            <Button asChild variant="outline">
              <Link to={dashboardPath(primaryRole)!}>
                Open dashboard <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>

        {primaryRole === "landlord" && (
          <LandlordCards
            properties={propertiesCount}
            tenants={tenantsCount}
            pending={pendingTenants}
            upcomingReminders={upcomingReminders}
          />
        )}

        {primaryRole === "admin" && <AdminCards upcomingReminders={upcomingReminders} />}
        {primaryRole === "caretaker" && (
          <RoleCards role="caretaker" upcomingReminders={upcomingReminders} />
        )}
        {primaryRole === "service_provider" && (
          <RoleCards role="service_provider" upcomingReminders={upcomingReminders} />
        )}
        {primaryRole === "tenant" && (
          <TenantCards record={tenantRecord} upcomingReminders={upcomingReminders} />
        )}
      </div>
    </section>
  );
}

function dashboardPath(role: AppRole): string | null {
  switch (role) {
    case "admin":
      return "/admin";
    case "landlord":
      return "/landlord/dashboard";
    case "caretaker":
      return "/caretaker";
    case "service_provider":
      return "/service-provider";
    default:
      return null;
  }
}

/* -------------------- Landlord -------------------- */

interface LandlordProps {
  properties: number | null;
  tenants: number | null;
  pending: number;
  upcomingReminders: number;
}

function LandlordCards({ properties, tenants, pending, upcomingReminders }: LandlordProps) {
  const cards: SimpleCard[] = [
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
      href: null,
    },
  ];
  return <CardGrid cards={cards} />;
}

/* -------------------- Tenant -------------------- */

function TenantCards({
  record,
  upcomingReminders,
}: {
  record: TenantRow | null;
  upcomingReminders: number;
}) {
  // Compute next rent due — first day of next month
  const today = new Date();
  const nextDue = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const daysToRent = differenceInCalendarDays(nextDue, today);

  const leaseStatus = record?.status
    ? record.status === "active"
      ? "Active"
      : record.status === "notice"
        ? "On notice"
        : "Ended"
    : "Not linked";

  const leaseHint = record?.lease_end
    ? `Ends ${format(new Date(record.lease_end), "MMM d, yyyy")}`
    : record
      ? "No end date on file"
      : "Ask your landlord to invite you";

  const cards: SimpleCard[] = [
    {
      icon: FileText,
      label: "Lease status",
      value: leaseStatus,
      hint: leaseHint,
      href: null,
    },
    {
      icon: CalendarClock,
      label: "Next rent due",
      value: `${daysToRent}d`,
      hint: `Due ${format(nextDue, "MMM d")}`,
      href: null,
    },
    {
      icon: Bell,
      label: "Reminders",
      value: upcomingReminders,
      hint: "Due in next 14 days",
      href: null,
    },
    {
      icon: MessageSquare,
      label: "Messages",
      value: 0,
      hint: "Coming soon",
      href: null,
    },
  ];
  return <CardGrid cards={cards} />;
}

/* -------------------- Admin / Caretaker / SP -------------------- */

function AdminCards({ upcomingReminders }: { upcomingReminders: number }) {
  const cards: SimpleCard[] = [
    {
      icon: ShieldCheck,
      label: "Admin console",
      value: "Open",
      hint: "Manage roles & users",
      href: "/admin",
    },
    {
      icon: Bell,
      label: "Reminders",
      value: upcomingReminders,
      hint: "Due in next 14 days",
      href: null,
    },
    {
      icon: BarChart3,
      label: "Platform metrics",
      value: "Soon",
      hint: "Coming soon",
      href: null,
    },
  ];
  return <CardGrid cards={cards} />;
}

function RoleCards({
  role,
  upcomingReminders,
}: {
  role: "caretaker" | "service_provider";
  upcomingReminders: number;
}) {
  const dashHref = role === "caretaker" ? "/caretaker" : "/service-provider";
  const dashHint =
    role === "caretaker" ? "Your assigned properties" : "Open work orders";

  const cards: SimpleCard[] = [
    {
      icon: Wrench,
      label: role === "caretaker" ? "Caretaker dashboard" : "Service provider dashboard",
      value: "Open",
      hint: dashHint,
      href: dashHref,
    },
    {
      icon: Bell,
      label: "Reminders",
      value: upcomingReminders,
      hint: "Due in next 14 days",
      href: null,
    },
  ];
  return <CardGrid cards={cards} />;
}

/* -------------------- Shared card grid -------------------- */

interface SimpleCard {
  icon: typeof Wrench;
  label: string;
  value: string | number;
  hint: string;
  href: string | null;
}

function CardGrid({ cards }: { cards: SimpleCard[] }) {
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
          <Link key={c.label} to={c.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={c.label} aria-disabled className="opacity-90">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
