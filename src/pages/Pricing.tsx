import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const tiers = [
  {
    name: "Starter",
    price: "KSh 2,",
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

      <section className="py-20 lg:py-28 bg-subtle">
        <div className="container-narrow text-center">
          <div className="flex items-center justify-center gap-3 mb-4 text-accent text-xs uppercase tracking-[0.25em]">
            <span className="gold-rule" /><span>Pricing</span><span className="gold-rule" />
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-balance mb-6">Plans that scale with the portfolio.</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">Transparent, per-month pricing. No setup fees. Cancel any time.</p>
        </div>
      </section>

      <section className="py-20">
        <div className="container-wide grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div key={t.name} className={`flex flex-col p-8 lg:p-10 border ${t.highlight ? "border-accent bg-card shadow-elegant relative" : "border-border bg-card"}`}>
              {t.highlight && (
                <div className="absolute -top-3 left-8 bg-accent text-accent-foreground text-xs uppercase tracking-widest px-3 py-1 font-medium">
                  Most chosen
                </div>
              )}
              <h3 className="font-serif text-2xl mb-2">{t.name}</h3>
              <p className="text-sm text-muted-foreground mb-6 min-h-[3rem]">{t.desc}</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="font-serif text-5xl">{t.price}</span>
                <span className="text-muted-foreground text-sm">{t.cadence}</span>
              </div>
              <ul className="space-y-3 mb-10 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm">
                    <Check className="h-5 w-5 text-accent shrink-0" strokeWidth={2} />
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

      <SiteFooter />
    </div>
  );
}
