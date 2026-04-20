import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-primary text-primary-foreground">
      <div className="container-wide py-16 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent text-accent-foreground font-serif text-lg">E</span>
            <span className="font-serif text-2xl">Estate</span>
          </div>
          <p className="text-sm text-primary-foreground/70 max-w-sm leading-relaxed">
            The institutional-grade operating system for residential property portfolios. Trusted by landlords managing buildings of every scale.
          </p>
        </div>

        <div>
          <h4 className="font-serif text-sm uppercase tracking-widest text-accent mb-4">Platform</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/pricing" className="hover:text-accent transition-colors">Pricing</Link></li>
            <li><a href="#features" className="hover:text-accent transition-colors">Features</a></li>
            <li><a href="#roles" className="hover:text-accent transition-colors">For your team</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-serif text-sm uppercase tracking-widest text-accent mb-4">Account</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/auth" className="hover:text-accent transition-colors">Sign in</Link></li>
            <li><Link to="/auth?mode=register" className="hover:text-accent transition-colors">Create account</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10">
        <div className="container-wide py-6 text-xs text-primary-foreground/60 flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} Estate. All rights reserved.</span>
          <span className="font-serif italic">Property management, refined.</span>
        </div>
      </div>
    </footer>
  );
}
