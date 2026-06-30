import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  requirePayment?: boolean;
}

// Roles that must subscribe before accessing their dashboard.
// Invited users (tenant/caretaker/service_provider) and admins are exempt.
const PAYING_ROLES: AppRole[] = ["landlord"];
const BYPASS_PAYMENT_EMAIL = "chesangfelister@gmail.com";

export function hasPaidPlan(userId: string | undefined | null, userEmail?: string | null) {
  if (!userId) return false;
  if (userEmail?.toLowerCase() === BYPASS_PAYMENT_EMAIL) return true;
  return localStorage.getItem(`planPaid:${userId}`) === "1";
}

export default function ProtectedRoute({ children, allowedRoles, requirePayment = true }: Props) {
  const { user, roles, loading } = useAuth();
  const location = useLocation();

  const roleDestination = (() => {
    const roleRoutes: Record<AppRole, string> = {
      admin: "/admin",
      landlord: "/landlord/dashboard",
      caretaker: "/caretaker",
      tenant: "/tenant/dashboard",
      service_provider: "/service-provider",
    };
    const priority: AppRole[] = ["tenant", "admin", "landlord", "caretaker", "service_provider"];
    const r = priority.find((x) => roles.includes(x));
    return r ? roleRoutes[r] : "/";
  })();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (allowedRoles && !roles.some((r) => allowedRoles.includes(r))) {
    return <Navigate to={roleDestination} replace />;
  }

  // Payment gate — applies to paying roles only, excludes the /checkout page itself
  if (
    requirePayment &&
    roles.includes("admin") === false &&
    roles.some((r) => PAYING_ROLES.includes(r)) &&
    !hasPaidPlan(user.id, user.email) &&
    location.pathname !== "/checkout"
  ) {
    const plan = sessionStorage.getItem("pendingPlan") || "starter";
    return <Navigate to={`/checkout?plan=${encodeURIComponent(plan)}`} replace />;
  }

  return <>{children}</>;
}
