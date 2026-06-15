import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, AppRole } from "@/context/AuthContext";
import {
  PLANS,
  initiateMpesaStkPush,
  getPayheroPaymentStatus,
} from "@/lib/payhero";
import { formatKsh } from "@/lib/currency";
import logo from "@/assets/logo.png";

const roleRoutes: Record<AppRole, string> = {
  admin: "/admin",
  landlord: "/landlord/dashboard",
  caretaker: "/caretaker",
  tenant: "/tenant/dashboard",
  service_provider: "/service-provider",
};

export default function Checkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, roles, loading } = useAuth();

  const planKey = (params.get("plan") || sessionStorage.getItem("pendingPlan") || "starter").toLowerCase();
  const plan = PLANS[planKey] ?? PLANS.starter;

  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [externalReference, setExternalReference] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");

  const destination = useMemo(() => {
    const priority: AppRole[] = ["tenant", "admin", "landlord", "caretaker", "service_provider"];
    const r = priority.find((x) => roles.includes(x));
    return r ? roleRoutes[r] : "/";
  }, [roles]);

  useEffect(() => {
    if (!loading && user && roles.includes("admin")) {
      navigate("/admin", { replace: true });
      return;
    }
    if (!loading && !user) {
      navigate("/auth?mode=login&plan=" + planKey, { replace: true });
    }
  }, [loading, user, roles, navigate, planKey]);

  // Poll status
  useEffect(() => {
    if (status !== "pending" || (!checkoutRequestId && !externalReference)) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await getPayheroPaymentStatus({
          checkoutRequestId: checkoutRequestId || undefined,
          externalReference: externalReference || undefined,
        });
        // Normalize PayHero responses: some responses set `status` boolean,
        // others include a `response.Status` string or `response.ResultCode`.
        const rawStatus = res?.response?.Status ?? res?.status ?? res?.response?.status ?? "";
        let s = "";
        if (typeof rawStatus === "string") s = rawStatus;
        else if (typeof rawStatus === "boolean") s = rawStatus ? "SUCCESS" : "FAILED";
        else if (res?.response?.ResultCode !== undefined) s = Number(res.response.ResultCode) === 0 ? "SUCCESS" : "FAILED";
        else s = String(rawStatus ?? "");
        s = String(s).toUpperCase();

        if (s.includes("SUCCESS") || s === "COMPLETED" || s === "PAID") {
          setStatus("success");
          if (user?.id) localStorage.setItem(`planPaid:${user.id}`, "1");
          sessionStorage.removeItem("pendingPlan");
          toast.success("Payment received");
          return;
        }

        if (s.includes("FAIL") || s.includes("CANCEL")) {
          setStatus("failed");
          toast.error("Payment failed or cancelled");
          return;
        }
      } catch (e) {
        // ignore transient errors while polling
      }
      if (!stop) setTimeout(tick, 4000);
    };
    const t = setTimeout(tick, 4000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [status, checkoutRequestId, externalReference, user?.id]);

  // Redirect on successful payment
  useEffect(() => {
    if (status === "success" && destination !== "/") {
      const timer = setTimeout(() => navigate(destination, { replace: true }), 1500);
      return () => clearTimeout(timer);
    }
  }, [status, destination, navigate]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    let normalized = phone.trim().replace(/\s+/g, "");
    if (normalized.startsWith("+")) normalized = normalized.slice(1);
    if (normalized.startsWith("0")) normalized = "254" + normalized.slice(1);
    if (!/^254\d{9}$/.test(normalized)) {
      toast.error("Enter a valid Kenyan phone number e.g. 0712345678");
      return;
    }
    setSubmitting(true);
    const ref = `PLAN-${planKey.toUpperCase()}-${Date.now()}`;
    try {
      const res = await initiateMpesaStkPush({
        amount: plan.amount,
        phoneNumber: normalized,
        externalReference: ref,
        customerName: user?.email ?? undefined,
      });
      setCheckoutRequestId(res.CheckoutRequestID || null);
      setExternalReference(ref);
      setStatus("pending");
      toast.success("Check your phone to enter M-PESA PIN");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err ?? "Failed to initiate payment");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <img src={logo} alt="Flashrentsolution" className="h-8 w-8 rounded-sm object-contain" />
          <span className="font-serif text-xl">Flashrentsolution</span>
        </Link>

        <div className="border border-border bg-card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">Complete your subscription</div>
          <h1 className="font-serif text-3xl mb-1">{plan.name} plan</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Pay via M-PESA to activate your account.
          </p>

          <div className="flex items-baseline gap-2 mb-8">
            <span className="font-serif text-4xl">{formatKsh(plan.amount)}</span>
            <span className="text-muted-foreground text-sm">/ month</span>
          </div>

          {status === "success" ? (
            <div className="flex flex-col items-center text-center py-6">
              <CheckCircle2 className="h-12 w-12 text-accent mb-3" />
              <p className="font-medium">Payment confirmed</p>
              <p className="text-sm text-muted-foreground">Redirecting to your dashboard…</p>
            </div>
          ) : status === "pending" ? (
            <div className="flex flex-col items-center text-center py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="font-medium">Waiting for M-PESA confirmation</p>
              <p className="text-sm text-muted-foreground">
                Enter your PIN on your phone. This may take up to a minute.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone">M-PESA phone number</Label>
                <Input
                  id="phone"
                  required
                  inputMode="tel"
                  placeholder="0712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  You'll receive an STK push to authorize payment.
                </p>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Pay {formatKsh(plan.amount)}
              </Button>
              {status === "failed" && (
                <p className="text-sm text-destructive text-center">
                  Payment didn't go through. Try again.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
