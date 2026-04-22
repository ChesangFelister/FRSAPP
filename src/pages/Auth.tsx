import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, roles } = useAuth();
  const initialTab = params.get("mode") === "register" ? "register" : "login";
  const [tab, setTab] = useState(initialTab);
  const [justRegistered, setJustRegistered] = useState(false);

  // Redirect signed-in users — to landing after a fresh signup, to dashboard on login
  useEffect(() => {
    if (!user) return;
    if (justRegistered) {
      navigate("/", { replace: true });
      return;
    }
    if (roles.includes("admin")) navigate("/admin", { replace: true });
    else if (roles.includes("landlord")) navigate("/landlord/dashboard", { replace: true });
    else if (roles.includes("caretaker")) navigate("/caretaker", { replace: true });
    else if (roles.includes("service_provider")) navigate("/service-provider", { replace: true });
    else navigate("/", { replace: true });
  }, [user, roles, navigate, justRegistered]);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: name } },
    });
    setRegisterLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("already")) toast.error("This email is already registered. Try signing in.");
      else toast.error(error.message);
    } else {
      toast.success("Account created — welcome to Estate.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* LEFT — brand panel */}
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent text-accent-foreground font-serif text-lg">E</span>
          <span className="font-serif text-2xl">Estate</span>
        </Link>

        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-6 text-accent text-xs uppercase tracking-[0.25em]">
            <span className="gold-rule" /><span>Welcome</span>
          </div>
          <blockquote className="font-serif text-3xl leading-tight italic mb-6 text-balance">
            "Estate replaced four systems and a shared spreadsheet. The first month paid for the year."
          </blockquote>
          <div className="text-sm text-primary-foreground/70">
            <div className="font-medium text-primary-foreground">Helena Rourke</div>
            <div>Director, Rourke Residential</div>
          </div>
        </div>

        <div className="text-xs text-primary-foreground/50 relative z-10">© {new Date().getFullYear()} Estate</div>

        {/* gold accent */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />
      </aside>

      {/* RIGHT — forms */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground font-serif text-lg">E</span>
            <span className="font-serif text-xl">Estate</span>
          </Link>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full mb-8">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <h1 className="font-serif text-3xl mb-2">Welcome back</h1>
              <p className="text-muted-foreground text-sm mb-8">Sign in to continue managing your portfolio.</p>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@firm.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loginLoading}>
                  {loginLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <h1 className="font-serif text-3xl mb-2">Open your portfolio</h1>
              <p className="text-muted-foreground text-sm mb-8">Create a landlord account. Tenants and staff are added later by invitation.</p>
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Helena Rourke" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@firm.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters. Leaked passwords are blocked.</p>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={registerLoading}>
                  {registerLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground text-center mt-8">
            By continuing you agree to Estate's terms and privacy policy.
          </p>
        </div>
      </main>
    </div>
  );
}
