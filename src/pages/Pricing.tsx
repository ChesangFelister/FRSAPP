import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const tiers = [
  {
    name: "Starter",
    price: "KSh 2500,",
    cadence: "/ month",
    desc: "For owners taking their first portfolio digital.",
    features: ["Up to 10 units", "Tenant ledger & invoicing", "Document vault (5 GB)", "Email support"],
    highlight: false,
  },
  {
    name: "Professional",
    price: "KSh 7,500",
    cadence: "/ month",
    desc: "For growing landlords with active operations.",
    features: ["Up to 75 units", "Caretaker & service-provider workflows", "Financial reporting suite", "Reminder automation", "Priority support"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    desc: "For institutional portfolios with bespoke needs.",
    features: ["Unlimited units & users", "SSO & advanced permissions", "Dedicated success manager", "Custom integrations", "99.99% uptime SLA"],
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <section className="py-12 lg:py-12 bg-gradient-to-b from-slate-50 via-slate-100 to-white">
        <div className="container-narrow text-center">
          <div className="inline-flex items-center justify-center gap-3 mb-4 rounded-full bg-accent/10 px-4 py-2 text-accent text-xs uppercase tracking-[0.28em]">
            <span className="gold-rule" />Pricing<span className="gold-rule" />
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-balance mb-6">Plans designed for modern landlords.</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Transparent, per-month pricing that scales with your portfolio. No setup fees, clear value, and support for every stage.</p>
        </div>
      </section>

      <section className="py-20">
        <div className="container-wide grid md:grid-cols-3 gap-8">
          {tiers.map((t) => (
            <div key={t.name} className={`group relative flex flex-col rounded-[2rem] border bg-white/95 p-8 lg:p-10 shadow-sm ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-elegant ${t.highlight ? "border-accent/20 bg-gradient-to-b from-white via-slate-50 to-white" : "border-border"}`}>
              {t.highlight && (
                <div className="absolute -top-3 left-8 rounded-full bg-accent text-accent-foreground text-[11px] uppercase tracking-[0.25em] px-3 py-1 font-semibold shadow-sm">
                  Most chosen
                </div>
              )}
              <h3 className="font-serif text-2xl mb-2">{t.name}</h3>
              <p className="text-sm text-muted-foreground mb-6 min-h-[3rem]">{t.desc}</p>
              <div className="flex items-baseline gap-3 mb-8">
                <span className="font-serif text-5xl text-foreground">{t.price}</span>
                <span className="text-muted-foreground text-sm">{t.cadence}</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm text-slate-700">
                    <Check className="mt-0.5 h-5 w-5 text-accent shrink-0" strokeWidth={2} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" variant={t.highlight ? "default" : "outline"} className="w-full">
                <Link to={t.name === "Enterprise" ? "/auth?mode=register" : `/auth?mode=register&plan=${t.name.toLowerCase()}`}>{t.name === "Enterprise" ? "Talk to us" : "Start with " + t.name}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12">
        <div className="container-narrow">
          <div className="mx-auto max-w-3xl rounded-2xl bg-card p-8 shadow-elegant ring-1 ring-border">
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.28em] text-accent mb-3">Need a custom walkthrough?</p>
              <h2 className="font-serif text-3xl mb-3">Request a demo and we’ll show you the platform live.</h2>
              <p className="max-w-2xl mx-auto text-muted-foreground mb-6">Perfect for landlords who want a guided tour, custom pricing, or help matching the product to your portfolio.</p>
              <div className="flex justify-center">
                <Button asChild size="lg" variant="gold">
                  <Link to="/demo">Request a demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
