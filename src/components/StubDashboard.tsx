import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  role: string;
  description?: string;
}

export default function StubDashboard({ title, role, description }: Props) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-subtle">
      <header className="border-b border-border bg-background">
        <div className="container-wide flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground font-serif text-lg">E</span>
            <span className="font-serif text-xl">Estate</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="container-narrow py-20">
        <div className="bg-card border border-border p-12 lg:p-16 shadow-md">
          <div className="flex items-center gap-3 mb-6 text-accent text-xs uppercase tracking-[0.25em]">
            <span className="gold-rule" /><span>{role}</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl mb-4 text-balance">{title}</h1>
          <p className="text-muted-foreground text-lg max-w-xl mb-10 leading-relaxed">
            {description ?? "Your workspace is being prepared. The full experience launches in the next phase of the build."}
          </p>

          <div className="flex items-start gap-4 p-6 border border-accent/30 bg-accent-soft/40 rounded-sm">
            <Construction className="h-6 w-6 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <div className="font-medium mb-1">Coming in Phase 2</div>
              <div className="text-sm text-muted-foreground">
                Properties, tenants, financials, work orders, and document management are being built next.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
