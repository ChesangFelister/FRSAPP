import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowLeft } from "lucide-react";
import TenantUtilities from "./Utilities";

export default function TenantUtilitiesPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-subtle">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center gap-4">
          <Link to="/tenant/dashboard" className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> <span className="font-serif text-xl">Utilities</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-primary-foreground/70 hidden sm:inline">{user?.email}</span>
            <Button variant="outline-light" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <TenantUtilities />
      </main>
    </div>
  );
}
