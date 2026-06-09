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

export function hasPaidPlan(userId: string | undefined | null) {
  if (!userId) return false;
  return localStorage.getItem(`planPaid:${userId}`) === "1";
}

export default function ProtectedRoute({ children, allowedRoles, requirePayment = true }: Props) {
  const { user, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (allowedRoles && !roles.some((r) => allowedRoles.includes(r))) {
    return <Navigate to="/" replace />;
  }

  // Payment gate — applies to paying roles only, excludes the /checkout page itself
  if (
    requirePayment &&
    roles.some((r) => PAYING_ROLES.includes(r)) &&
    !hasPaidPlan(user.id) &&
    location.pathname !== "/checkout"
  ) {
    const plan = sessionStorage.getItem("pendingPlan") || "starter";
    return <Navigate to={`/checkout?plan=${encodeURIComponent(plan)}`} replace />;
  }

  return <>{children}</>;
}
