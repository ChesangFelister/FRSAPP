import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

import LandlordDashboard from "./pages/landlord/Dashboard";
import Properties from "./pages/landlord/Properties";
import PropertyForm from "./pages/landlord/PropertyForm";
import PropertyDetail from "./pages/landlord/PropertyDetail";
import Tenants from "./pages/landlord/Tenants";
import Caretakers from "./pages/landlord/Caretakers";
import Reminders from "./pages/landlord/Reminders";
import Payments from "./pages/landlord/Payments";
import AdminDashboard from "./pages/admin/Dashboard";
import CaretakerDashboard from "./pages/caretaker/Dashboard";
import ServiceProviderDashboard from "./pages/service-provider/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/landlord/dashboard" element={<ProtectedRoute allowedRoles={["landlord"]}><LandlordDashboard /></ProtectedRoute>} />
            <Route path="/landlord/properties" element={<ProtectedRoute allowedRoles={["landlord"]}><Properties /></ProtectedRoute>} />
            <Route path="/landlord/properties/new" element={<ProtectedRoute allowedRoles={["landlord"]}><PropertyForm /></ProtectedRoute>} />
            <Route path="/landlord/properties/:id" element={<ProtectedRoute allowedRoles={["landlord"]}><PropertyDetail /></ProtectedRoute>} />
            <Route path="/landlord/properties/:id/edit" element={<ProtectedRoute allowedRoles={["landlord"]}><PropertyForm /></ProtectedRoute>} />
            <Route path="/landlord/tenants" element={<ProtectedRoute allowedRoles={["landlord"]}><Tenants /></ProtectedRoute>} />
            <Route path="/landlord/caretakers" element={<ProtectedRoute allowedRoles={["landlord"]}><Caretakers /></ProtectedRoute>} />
            <Route path="/landlord/reminders" element={<ProtectedRoute allowedRoles={["landlord"]}><Reminders /></ProtectedRoute>} />
            <Route path="/landlord/payments" element={<ProtectedRoute allowedRoles={["landlord"]}><Payments /></ProtectedRoute>} />
            <Route
              path="/caretaker"
              element={
                <ProtectedRoute allowedRoles={["caretaker"]}>
                  <CaretakerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-provider"
              element={
                <ProtectedRoute allowedRoles={["service_provider"]}>
                  <ServiceProviderDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
