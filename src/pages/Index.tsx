import { Building2, Users, Wrench, BarChart3, FileText, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import heroImage from "@/assets/hero-building.jpg";

const features = [
  { icon: Building2, title: "Portfolio management", body: "Centralised oversight of every building, unit, and lease across your holdings." },
  { icon: Users, title: "Tenant relations", body: "Onboarding, communication, and rent tracking — orchestrated from one ledger." },
  { icon: BarChart3, title: "Financial intelligence", body: "Cash-flow, occupancy, and yield reporting that institutional investors expect." },
  { icon: Wrench, title: "Maintenance workflows", body: "Dispatch caretakers and service providers with full audit trails." },
  { icon: FileText, title: "Document vault", body: "Leases, inspections, and certificates stored with version history." },
  { icon: Bell, title: "Reminders & compliance", body: "Never miss a renewal, an inspection, or a regulatory deadline." },
];

const roles = [
  { name: "Landlords", body: "Run your portfolio with the precision of an institutional asset manager." },
  { name: "Tenants", body: "A clear ledger, transparent communication, and effortless renewals." },
  { name: "Caretakers", body: "A focused queue of properties and tasks — no inbox archaeology." },
  { name: "Service Providers", body: "Receive, accept, and complete work orders with documented sign-off." },
];

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Modern residential building at golden hour" className="h-full w-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/40" />
        </div>

        <div className="relative container-wide py-28 md:py-40 lg:py-48 text-primary-foreground">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6 text-accent text-xs uppercase tracking-[0.25em]">
              <span className="gold-rule" />
              <span>Property management, refined</span>
            </div>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.05] text-balance mb-8">
              The operating system for serious landlords.
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/85 leading-relaxed max-w-xl mb-10">
              Estate consolidates leases, ledgers, maintenance, and tenant relationships into a single, audit-ready platform — built for portfolios of every scale.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" variant="gold">
                <Link to="/auth?mode=register">Open your portfolio</Link>
              </Button>
              <Button asChild size="lg" variant="outline-light">
                <Link to="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container-wide py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { k: "12,400+", v: "Units under management" },
            { k: "$1.8B", v: "Portfolio value tracked" },
            { k: "99.97%", v: "Ledger accuracy" },
            { k: "27 mins", v: "Avg. onboarding" },
          ].map((s) => (
            <div key={s.v}>
              <div className="font-serif text-3xl text-primary">{s.k}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-2">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 lg:py-32">
        <div className="container-wide">
          <div className="max-w-2xl mb-16">
            <div className="flex items-center gap-3 mb-4 text-accent text-xs uppercase tracking-[0.25em]">
              <span className="gold-rule" /><span>Capabilities</span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-balance mb-4">Every workflow, one ledger of truth.</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Stop assembling spreadsheets, email threads, and disconnected apps. Estate brings the full lifecycle of a property — from acquisition to renewal — under one disciplined system.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-sm overflow-hidden border border-border">
            {features.map((f) => (
              <div key={f.title} className="bg-card p-8 lg:p-10 hover:bg-secondary/50 transition-colors">
                <f.icon className="h-7 w-7 text-accent mb-5" strokeWidth={1.5} />
                <h3 className="font-serif text-xl mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="py-24 lg:py-32 bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-2xl mb-16">
            <div className="flex items-center gap-3 mb-4 text-accent text-xs uppercase tracking-[0.25em]">
              <span className="gold-rule" /><span>Built for the whole team</span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-balance">A purpose-built workspace for every stakeholder.</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((r, i) => (
              <div key={r.name} className="border border-primary-foreground/15 p-8 hover:border-accent transition-colors">
                <div className="font-serif text-accent text-sm mb-4">0{i + 1}</div>
                <h3 className="font-serif text-2xl mb-3">{r.name}</h3>
                <p className="text-sm text-primary-foreground/75 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 lg:py-32 bg-subtle">
        <div className="container-narrow text-center">
          <div className="flex items-center justify-center gap-3 mb-6 text-accent text-xs uppercase tracking-[0.25em]">
            <span className="gold-rule" /><span>Begin</span><span className="gold-rule" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-balance mb-6">Bring your portfolio into focus.</h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Set up your first building in under thirty minutes. Invite your team. Replace five tools with one.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg"><Link to="/auth?mode=register">Create your account</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/pricing">Compare plans</Link></Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
