// Admin-only edge function for cross-platform user & role management
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type AppRole = "admin" | "landlord" | "caretaker" | "tenant" | "service_provider";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      const ids = list.users.map((u) => u.id);
      const { data: roles } = await admin.from("user_roles").select("user_id, role").in("user_id", ids);
      const { data: profiles } = await admin.from("profiles").select("id, full_name, phone").in("id", ids);
      const out = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: profiles?.find((p) => p.id === u.id)?.full_name ?? null,
        phone: profiles?.find((p) => p.id === u.id)?.phone ?? null,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as AppRole),
      }));
      return json({ users: out });
    }

    if (action === "addRole") {
      const { userId, role } = body as { userId: string; role: AppRole };
      const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (error && !String(error.message).includes("duplicate")) throw error;
      return json({ ok: true });
    }

    if (action === "removeRole") {
      const { userId, role } = body as { userId: string; role: AppRole };
      const { error } = await admin.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "deleteUser") {
      const { userId } = body as { userId: string };
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
