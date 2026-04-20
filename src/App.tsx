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
            <Route
              path="/landlord/dashboard"
              element={
                <ProtectedRoute allowedRoles={["landlord"]}>
                  <LandlordDashboard />
                </ProtectedRoute>
              }
            />
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
