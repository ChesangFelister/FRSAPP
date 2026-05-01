import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Receipt, LogOut, Wallet, Calendar, Home, Send, Download, User, CheckCircle2, Clock, AlertTriangle, CircleDashed, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";
import { downloadReceiptPdf, fetchLogoAsDataUrl } from "@/lib/receipt";

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
  owner_id: string;
}

interface Payment {
  id: string;
  period_month: number;
  period_year: number;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  submitted_at: string | null;
  submitted_method: string | null;
  submitted_reference: string | null;
  property_id: string | null;
  tenant_id: string;
}

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const statusStyles: Record<string, string> = {
  paid: "bg-accent-soft text-accent-foreground border-accent/40",
  partial: "bg-blue-100 text-blue-900 border-blue-300",
  late: "bg-destructive/10 text-destructive border-destructive/40",
  pending: "bg-secondary text-muted-foreground border-border",
};

export default function TenantDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<{ name: string; address: string } | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Payment | null>(null);
  const [intentMethod, setIntentMethod] = useState("M-Pesa");
  const [intentRef, setIntentRef] = useState("");
  const [intentNote, setIntentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: t } = await supabase
      .from("tenants").select("*").eq("user_id", user.id).maybeSingle();
    if (!t) { setLoading(false); return; }
    setTenant(t as TenantRow);

    const [{ data: prop }, { data: pay }] = await Promise.all([
      t.property_id
        ? supabase.from("properties").select("name, address").eq("id", t.property_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("rent_payments").select("*").eq("tenant_id", t.id).order("period_year", { ascending: false }).order("period_month", { ascending: false }),
    ]);
    setProperty(prop ?? null);
    setPayments((pay as Payment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const stats = useMemo(() => {
    const outstanding = payments.reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);
    const paidYtd = payments
      .filter(p => p.period_year === new Date().getFullYear())
      .reduce((s, p) => s + Number(p.amount_paid), 0);
    const next = payments.find(p => p.status !== "paid");
    return { outstanding, paidYtd, next };
  }, [payments]);

  // Latest payment status tracker — picks the most recent payment with activity
  // (submitted intent or any amount paid), falling back to the most recent record.
  const latest = useMemo(() => {
    if (payments.length === 0) return null;
    const withActivity = payments.find(p => p.submitted_at || Number(p.amount_paid) > 0);
    const p = withActivity ?? payments[0];

    type Tone = "completed" | "pending" | "failed" | "idle";
    let tone: Tone = "idle";
    let label = "No activity";
    let detail = "Submit a payment to start tracking its status.";

    if (p.status === "paid") {
      tone = "completed";
      label = "Completed";
      detail = `Confirmed${p.paid_date ? ` on ${p.paid_date}` : ""}${p.method ? ` via ${p.method}` : ""}.`;
    } else if (p.submitted_at && Number(p.amount_paid) === 0) {
      tone = "pending";
      label = "Pending confirmation";
      detail = `Submitted ${p.submitted_method ?? ""} ${p.submitted_reference ? `· ${p.submitted_reference}` : ""} — awaiting landlord confirmation.`;
    } else if (p.status === "partial") {
      tone = "pending";
      label = "Partially paid";
      detail = `${formatKsh(Number(p.amount_paid))} of ${formatKsh(Number(p.amount_due))} confirmed. Balance still due.`;
    } else if (p.status === "late") {
      tone = "failed";
      label = "Overdue";
      detail = `Due ${p.due_date}. Submit your payment to clear this period.`;
    } else {
      tone = "idle";
      label = "Awaiting payment";
      detail = `Due ${p.due_date}.`;
    }

    return { p, tone, label, detail };
  }, [payments]);


  const openPay = (p: Payment) => {
    setPayTarget(p);
    setIntentMethod(p.submitted_method ?? "M-Pesa");
    setIntentRef(p.submitted_reference ?? "");
    setIntentNote("");
    setPayOpen(true);
  };

  const submitIntent = async () => {
    if (!payTarget) return;
    if (!intentRef.trim()) { toast.error("Add a reference (e.g. M-Pesa code)"); return; }
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_rent_payment_intent", {
      _payment_id: payTarget.id,
      _method: intentMethod,
      _reference: intentRef,
      _note: intentNote,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment submitted — your landlord will confirm shortly.");
    setPayOpen(false);
    load();
  };

  const downloadReceipt = async (p: Payment) => {
    if (!tenant) return;
    if (Number(p.amount_paid) <= 0) { toast.error("No confirmed payment yet"); return; }

    const { data: settings } = await supabase
      .from("receipt_settings")
      .select("business_name, address, logo_url")
      .eq("owner_id", tenant.owner_id)
      .maybeSingle();

    let logoDataUrl: string | null = null;
    if (settings?.logo_url) logoDataUrl = await fetchLogoAsDataUrl(settings.logo_url);

    downloadReceiptPdf({
      receiptNumber: `${p.period_year}${String(p.period_month).padStart(2, "0")}-${p.id.slice(0, 8).toUpperCase()}`,
      issueDate: new Date().toISOString().slice(0, 10),
      landlord: { name: settings?.business_name ?? null, email: null },
      tenant: { name: tenant.full_name, email: tenant.email, phone: tenant.phone, unit: tenant.unit_label },
      property: property ? { name: property.name, address: property.address } : null,
      payment: {
        period_month: p.period_month, period_year: p.period_year,
        amount_due: Number(p.amount_due), amount_paid: Number(p.amount_paid),
        paid_date: p.paid_date, due_date: p.due_date,
        method: p.method, reference: p.reference, status: p.status, notes: p.notes,
      },
      branding: settings ? { businessName: settings.business_name, address: settings.address, logoDataUrl } : null,
    });
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-subtle">
        <h1 className="font-serif text-3xl mb-3">No tenant record linked</h1>
        <p className="text-muted-foreground max-w-md mb-6">Your account isn't linked to a tenant record yet. Ask your landlord for an invite link.</p>
        <Button variant="outline" onClick={handleSignOut}><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-subtle">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/frs-logo.png" alt="" className="h-8 w-8 object-contain bg-primary-foreground/10 rounded-sm p-1" />
            <span className="font-serif text-xl">Flashrentsolution</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-primary-foreground/70 hidden sm:inline">{user?.email}</span>
            <Button variant="outline-light" size="sm" asChild>
              <Link to="/tenant/profile"><User className="h-3.5 w-3.5" /> Profile</Link>
            </Button>
            <Button variant="outline-light" size="sm" onClick={handleSignOut}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="font-serif text-4xl mb-1">Welcome, {tenant.full_name.split(" ")[0]}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Home className="h-4 w-4" />
            {property?.name ?? "—"} {tenant.unit_label && <>· Unit {tenant.unit_label}</>}
          </p>
        </div>

        {/* Latest payment status tracker */}
        {latest && (() => {
          const tones = {
            completed: { wrap: "border-accent/40 bg-accent-soft", icon: "text-accent-foreground", Icon: CheckCircle2, chip: "bg-accent text-accent-foreground" },
            pending:   { wrap: "border-blue-300 bg-blue-50", icon: "text-blue-700", Icon: Clock, chip: "bg-blue-600 text-white" },
            failed:    { wrap: "border-destructive/40 bg-destructive/5", icon: "text-destructive", Icon: AlertTriangle, chip: "bg-destructive text-destructive-foreground" },
            idle:      { wrap: "border-border bg-card", icon: "text-muted-foreground", Icon: CircleDashed, chip: "bg-secondary text-muted-foreground" },
          } as const;
          const tone = tones[latest.tone];
          const Icon = tone.Icon;
          return (
            <section className={`border ${tone.wrap} p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
              <div className={`shrink-0 h-12 w-12 rounded-full bg-background border border-border flex items-center justify-center ${tone.icon}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Last payment</span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${tone.chip}`}>{latest.label}</span>
                </div>
                <div className="font-serif text-xl mt-1">
                  {months[latest.p.period_month - 1]} {latest.p.period_year} · {formatKsh(Number(latest.p.amount_due))}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{latest.detail}</p>
              </div>
              {latest.tone === "completed" && Number(latest.p.amount_paid) > 0 && (
                <Button size="sm" variant="outline" onClick={() => downloadReceipt(latest.p)}>
                  <Download className="h-3.5 w-3.5" /> Receipt
                </Button>
              )}
              {(latest.tone === "failed" || (latest.tone === "idle" && latest.p.status !== "paid")) && (
                <Button size="sm" onClick={() => openPay(latest.p)}>
                  <Send className="h-3.5 w-3.5" /> Pay now
                </Button>
              )}
              {latest.tone === "pending" && (
                <Button size="sm" variant="outline" onClick={() => openPay(latest.p)}>
                  <Send className="h-3.5 w-3.5" /> Update
                </Button>
              )}
            </section>
          );
        })()}

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Outstanding</div>
            <div className={`font-serif text-3xl ${stats.outstanding > 0 ? "text-destructive" : ""}`}>{formatKsh(stats.outstanding)}</div>
          </div>
          <div className="bg-card border border-border p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Paid this year</div>
            <div className="font-serif text-3xl">{formatKsh(stats.paidYtd)}</div>
          </div>
          <div className="bg-card border border-border p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Next due</div>
            {stats.next ? (
              <>
                <div className="font-serif text-2xl">{months[stats.next.period_month - 1]} {stats.next.period_year}</div>
                <div className="text-xs text-muted-foreground mt-1">Due {stats.next.due_date}</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">All caught up 🎉</div>
            )}
          </div>
        </div>

        {/* Payment history */}
        <section className="bg-card border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Rent history</h2>
          </div>
          {payments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No rent records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Period</th>
                    <th className="text-right px-4 py-3 font-medium">Due</th>
                    <th className="text-right px-4 py-3 font-medium">Paid</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map(p => {
                    const balance = Math.max(0, Number(p.amount_due) - Number(p.amount_paid));
                    const isPaid = p.status === "paid";
                    return (
                      <tr key={p.id} className="hover:bg-secondary/30">
                        <td className="px-6 py-4">
                          <div className="font-medium">{months[p.period_month - 1]} {p.period_year}</div>
                          <div className="text-xs text-muted-foreground">Due {p.due_date}</div>
                          {p.submitted_at && !isPaid && (
                            <div className="text-xs text-blue-700 mt-0.5">Submitted: {p.submitted_method} · {p.submitted_reference}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">{formatKsh(p.amount_due)}</td>
                        <td className="px-4 py-4 text-right">
                          <div>{formatKsh(p.amount_paid)}</div>
                          {balance > 0 && <div className="text-xs text-destructive">{formatKsh(balance)} due</div>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-xs px-2 py-0.5 border uppercase tracking-wider ${statusStyles[p.status] ?? ""}`}>{p.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            {!isPaid && (
                              <Button size="sm" variant="outline" onClick={() => openPay(p)}>
                                <Send className="h-3.5 w-3.5" /> {p.submitted_at ? "Update" : "Pay"}
                              </Button>
                            )}
                            {Number(p.amount_paid) > 0 && (
                              <Button size="sm" variant="ghost" onClick={() => downloadReceipt(p)} title="Download receipt">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground text-center">
          <Receipt className="h-3 w-3 inline mr-1" />
          Real-time card &amp; M-Pesa checkout coming soon. For now, pay via M-Pesa or bank and submit your reference here.
        </p>
      </main>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Submit payment</DialogTitle>
            <DialogDescription>
              {payTarget && <>Rent for {months[payTarget.period_month - 1]} {payTarget.period_year} — {formatKsh(payTarget.amount_due)}</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={intentMethod}
                onChange={(e) => setIntentMethod(e.target.value)}
              >
                <option>M-Pesa</option>
                <option>Bank transfer</option>
                <option>Cash</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference / transaction code *</Label>
              <Input value={intentRef} onChange={(e) => setIntentRef(e.target.value)} placeholder="e.g. QGH7XYZ123" />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea rows={2} value={intentNote} onChange={(e) => setIntentNote(e.target.value)} placeholder="Anything your landlord should know" />
            </div>
            <p className="text-xs text-muted-foreground">Your landlord will confirm and update the payment status. You'll be able to download your receipt once it's confirmed.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitIntent} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
