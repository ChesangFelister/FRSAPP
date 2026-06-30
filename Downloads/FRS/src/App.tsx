import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Public pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Pricing from "./pages/Pricing";
import Checkout from "./pages/Checkout";
import Demo from "./pages/Demo";
import NotFound from "./pages/NotFound";

// Admin
import AdminDashboard from "./pages/admin/Dashboard";

// Landlord — core
import LandlordDashboard from "./pages/landlord/Dashboard";
import Properties from "./pages/landlord/Properties";
import PropertyForm from "./pages/landlord/PropertyForm";
import PropertyDetail from "./pages/landlord/PropertyDetail";
import Tenants from "./pages/landlord/Tenants";
import Caretakers from "./pages/landlord/Caretakers";
import Reminders from "./pages/landlord/Reminders";
import Payments from "./pages/landlord/Payments";
import Settings from "./pages/landlord/Settings";
import LandlordIssues from "./pages/landlord/Issues";

// Landlord — new modules
import Power from "./pages/landlord/Power";
import Water from "./pages/landlord/Water";
import Waste from "./pages/landlord/Waste";
import Inventory from "./pages/landlord/Inventory";
import Procurement from "./pages/landlord/Procurement";

// Other roles
import CaretakerDashboard from "./pages/caretaker/Dashboard";
import ServiceProviderDashboard from "./pages/service-provider/Dashboard";

// Tenant
import TenantDashboard from "./pages/tenant/Dashboard";
import TenantProfile from "./pages/tenant/Profile";
import TenantUtilities from "./pages/tenant/Utilities";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* ─── Public ─── */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/demo" element={<Demo />} />

            {/* ─── Admin ─── */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

            {/* ─── Landlord — core ─── */}
            <Route path="/landlord/dashboard"          element={<ProtectedRoute allowedRoles={["landlord"]}><LandlordDashboard /></ProtectedRoute>} />
            <Route path="/landlord/properties"         element={<ProtectedRoute allowedRoles={["landlord","admin"]}><Properties /></ProtectedRoute>} />
            <Route path="/landlord/properties/new"     element={<ProtectedRoute allowedRoles={["landlord","admin"]}><PropertyForm /></ProtectedRoute>} />
            <Route path="/landlord/properties/:id"     element={<ProtectedRoute allowedRoles={["landlord","admin"]}><PropertyDetail /></ProtectedRoute>} />
            <Route path="/landlord/properties/:id/edit" element={<ProtectedRoute allowedRoles={["landlord","admin"]}><PropertyForm /></ProtectedRoute>} />
            <Route path="/landlord/tenants"            element={<ProtectedRoute allowedRoles={["landlord","admin"]}><Tenants /></ProtectedRoute>} />
            <Route path="/landlord/caretakers"         element={<ProtectedRoute allowedRoles={["landlord"]}><Caretakers /></ProtectedRoute>} />
            <Route path="/landlord/reminders"          element={<ProtectedRoute allowedRoles={["landlord"]}><Reminders /></ProtectedRoute>} />
            <Route path="/landlord/payments"           element={<ProtectedRoute allowedRoles={["landlord"]}><Payments /></ProtectedRoute>} />
            <Route path="/landlord/settings"           element={<ProtectedRoute allowedRoles={["landlord"]}><Settings /></ProtectedRoute>} />
            <Route path="/landlord/issues"             element={<ProtectedRoute allowedRoles={["landlord"]}><LandlordIssues /></ProtectedRoute>} />

            {/* ─── Landlord — new utility modules ─── */}
            <Route path="/landlord/power"              element={<ProtectedRoute allowedRoles={["landlord","admin"]}><Power /></ProtectedRoute>} />
            <Route path="/landlord/water"              element={<ProtectedRoute allowedRoles={["landlord","admin"]}><Water /></ProtectedRoute>} />
            <Route path="/landlord/waste"              element={<ProtectedRoute allowedRoles={["landlord","admin"]}><Waste /></ProtectedRoute>} />

            {/* ─── Landlord — inventory & procurement ─── */}
            <Route path="/landlord/inventory"          element={<ProtectedRoute allowedRoles={["landlord","admin"]}><Inventory /></ProtectedRoute>} />
            <Route path="/landlord/procurement"        element={<ProtectedRoute allowedRoles={["landlord","admin"]}><Procurement /></ProtectedRoute>} />

            {/* ─── Caretaker ─── */}
            <Route path="/caretaker" element={<ProtectedRoute allowedRoles={["caretaker"]}><CaretakerDashboard /></ProtectedRoute>} />

            {/* ─── Service Provider ─── */}
            <Route path="/service-provider" element={<ProtectedRoute allowedRoles={["service_provider"]}><ServiceProviderDashboard /></ProtectedRoute>} />

            {/* ─── Tenant ─── */}
            <Route path="/tenant/dashboard"  element={<ProtectedRoute allowedRoles={["tenant"]}><TenantDashboard /></ProtectedRoute>} />
            <Route path="/tenant/profile"    element={<ProtectedRoute allowedRoles={["tenant"]}><TenantProfile /></ProtectedRoute>} />
            <Route path="/tenant/utilities"  element={<ProtectedRoute allowedRoles={["tenant"]}><TenantUtilities /></ProtectedRoute>} />

            {/* ─── 404 ─── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
