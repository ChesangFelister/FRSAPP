import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Droplets, Trash2, ArrowLeft, LogOut, Home, User, AlertTriangle } from "lucide-react";
import { formatKsh } from "@/lib/currency";

type UtilityType = "power" | "water" | "waste";
type BillStatus = "draft" | "approved" | "sent" | "paid" | "disputed";

interface UtilityBill {
  id: string;
  utility_type: UtilityType;
  period_month: number;
  period_year: number;
  units_consumed: number;
  rate_per_unit: number;
  fixed_charge: number;
  amount_due: number;
  amount_paid: number;
  status: BillStatus;
  due_date: string | null;
  notes: string | null;
}

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const utilityConfig: Record<UtilityType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  power: { label: "Electricity", icon: Zap,     color: "text-amber-600",  bg: "bg-amber-50" },
  water: { label: "Water",       icon: Droplets, color: "text-blue-600",  bg: "bg-blue-50" },
  waste: { label: "Waste",       icon: Trash2,   color: "text-green-600", bg: "bg-green-50" },
};

const statusConfig: Record<BillStatus, { label: string; cls: string }> = {
  draft:    { label: "Pending",  cls: "bg-gray-100 text-gray-600 border-gray-200" },
  approved: { label: "Due",      cls: "bg-amber-100 text-amber-700 border-amber-200" },
  sent:     { label: "Due",      cls: "bg-amber-100 text-amber-700 border-amber-200" },
  paid:     { label: "Paid",     cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  disputed: { label: "Disputed", cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function TenantUtilities() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tenantId, setTenantId]     = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [unitLabel, setUnitLabel]   = useState<string | null>(null);
  const [bills, setBills]           = useState<UtilityBill[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: t } = await supabase.from("tenants").select("id,full_name,property_id,unit_label").eq("user_id", user.id).maybeSingle();
    if (!t) { setLoading(false); return; }
    setTenantId(t.id);
    setTenantName(t.full_name);
    setUnitLabel(t.unit_label);
    if (t.property_id) {
      const { data: p } = await supabase.from("properties").select("name").eq("id", t.property_id).maybeSingle();
      setPropertyName(p?.name ?? "");
    }
    const { data: b } = await supabase.from("utility_bills").select("*").eq("tenant_id", t.id).order("period_year", { ascending: false }).order("period_month", { ascending: false });
    setBills((b as UtilityBill[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const byType = useMemo(() => {
    const out: Record<UtilityType, UtilityBill[]> = { power: [], water: [], waste: [] };
    bills.forEach(b => { if (out[b.utility_type]) out[b.utility_type].push(b); });
    return out;
  }, [bills]);

  const summary = useMemo(() => {
    const outstanding = bills.filter(b => b.status !== "paid").reduce((s,b) => s + Math.max(0, b.amount_due - b.amount_paid), 0);
    const paidYtd = bills.filter(b => b.period_year === new Date().getFullYear()).reduce((s,b) => s + b.amount_paid, 0);
    return { outstanding, paidYtd, total: bills.length };
  }, [bills]);

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const BillTable = ({ type }: { type: UtilityType }) => {
    const cfg  = utilityConfig[type];
    const Icon = cfg.icon;
    const typeBills = byType[type];
    return (
      <Card>
        <CardHeader className={`pb-3 ${cfg.bg} border-b`}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`h-4 w-4 ${cfg.color}`} />
            {cfg.label} Bills
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {typeBills.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No {cfg.label.toLowerCase()} bills yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Period</th>
                    {type !== "waste" && <th className="text-right px-4 py-3 font-medium">Usage</th>}
                    <th className="text-right px-4 py-3 font-medium">Amount Due</th>
                    <th className="text-right px-4 py-3 font-medium">Paid</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {typeBills.map(b => {
                    const sCfg = statusConfig[b.status];
                    const balance = Math.max(0, b.amount_due - b.amount_paid);
                    return (
                      <tr key={b.id} className="hover:bg-secondary/20">
                        <td className="px-4 py-3 font-medium">
                          {months[b.period_month - 1]} {b.period_year}
                        </td>
                        {type !== "waste" && (
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {b.units_consumed} {type === "power" ? "kWh" : "m³"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-semibold">{formatKsh(b.amount_due)}</td>
                        <td className="px-4 py-3 text-right">
                          {formatKsh(b.amount_paid)}
                          {balance > 0 && b.status !== "draft" && <div className="text-xs text-destructive">{formatKsh(balance)} due</div>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className={`text-xs ${sCfg.cls}`}>{sCfg.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {b.due_date ? new Date(b.due_date).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Notes section for bills with explanations */}
          {typeBills.filter(b => b.notes).map(b => (
            <div key={`note-${b.id}`} className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-sm p-3 text-sm">
              <p className="font-medium text-amber-800 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Note for {months[b.period_month-1]} {b.period_year}
              </p>
              <p className="text-amber-700">{b.notes}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="font-serif text-3xl mb-3">No tenant record linked</h1>
        <p className="text-muted-foreground mb-6">Ask your landlord for an invite link to link your account.</p>
        <Button variant="outline" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-subtle">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/frs-logo.png" alt="" className="h-8 w-8 object-contain bg-primary-foreground/10 rounded-sm p-1" />
            <span className="font-serif text-xl">Flashrentsolution</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline-light" size="sm" asChild>
              <Link to="/tenant/dashboard"><ArrowLeft className="h-3.5 w-3.5 mr-1" />Dashboard</Link>
            </Button>
            <Button variant="outline-light" size="sm" asChild>
              <Link to="/tenant/profile"><User className="h-3.5 w-3.5" /></Link>
            </Button>
            <Button variant="outline-light" size="sm" onClick={handleSignOut}><LogOut className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {/* Page heading */}
        <div>
          <h1 className="font-serif text-4xl mb-1">Utility Bills</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Home className="h-4 w-4" />
            {propertyName || "—"} {unitLabel && <>· Unit {unitLabel}</>}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Outstanding Bills</div>
            <div className={`font-serif text-3xl ${summary.outstanding > 0 ? "text-destructive" : ""}`}>{formatKsh(summary.outstanding)}</div>
          </div>
          <div className="bg-card border border-border p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Paid This Year</div>
            <div className="font-serif text-3xl">{formatKsh(summary.paidYtd)}</div>
          </div>
          <div className="bg-card border border-border p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Total Bills</div>
            <div className="font-serif text-3xl">{summary.total}</div>
          </div>
        </div>

        {/* Bills by type */}
        <Tabs defaultValue="power">
          <TabsList className="mb-4">
            <TabsTrigger value="power" className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Electricity ({byType.power.length})
            </TabsTrigger>
            <TabsTrigger value="water" className="flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5" /> Water ({byType.water.length})
            </TabsTrigger>
            <TabsTrigger value="waste" className="flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Waste ({byType.waste.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="power"><BillTable type="power" /></TabsContent>
          <TabsContent value="water"><BillTable type="water" /></TabsContent>
          <TabsContent value="waste"><BillTable type="waste" /></TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center">
          Bills are generated by your landlord and reflect your monthly utility usage.
          Contact your landlord for any disputes or queries.
        </p>
      </main>
    </div>
  );
}
