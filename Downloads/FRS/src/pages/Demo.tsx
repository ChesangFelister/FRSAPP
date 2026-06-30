import { useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Demo() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent("Demo request from website");
    const body = encodeURIComponent(`Name: ${name}%0AEmail: ${email}%0ACompany: ${company}%0A%0AMessage:%0A${message}`);
    window.location.href = `mailto:hello@propertypal.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-grow container-narrow py-16">
        <div className="mx-auto max-w-3xl rounded-2xl bg-card p-10 shadow-elegant ring-1 ring-border">
          <h1 className="font-serif text-3xl mb-2">Request a demo</h1>
          <p className="text-muted-foreground mb-6">Schedule a personalised walkthrough — tell us about your portfolio and preferred times.</p>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="company">Company (optional)</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="message">Notes</Label>
              <textarea id="message" className="w-full rounded-md border border-border p-2" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" variant="gold">Request demo</Button>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Or view plans</Link>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
