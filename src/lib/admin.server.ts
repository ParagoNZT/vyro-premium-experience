import { createClient } from "@supabase/supabase-js";
import { isAdminIdentity } from "./admin-policy";

export async function adminResponse(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store, private", "Vary": "Authorization", "Content-Type": "application/json; charset=utf-8" };
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return reply({ error: "Connexion requise." }, 401);
  const email = process.env['VYRO_ADMIN_EMAIL'];
  if (!email) return reply({ error: "L’accès administrateur n’est pas encore configuré." }, 503);
  const url = import.meta.env['VITE_SUPABASE_URL'];
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return reply({ error: "Service de connexion indisponible." }, 503);
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    // getUser calls Auth; it rejects forged tokens and checks the current identity.
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return reply({ error: "Session invalide ou expirée." }, 401);
    if (!isAdminIdentity(data.user, email)) return reply({ error: "Cet espace est réservé à l’administrateur." }, 403);
    return reply({ email: data.user.email, id: data.user.id, createdAt: data.user.created_at, lastSignInAt: data.user.last_sign_in_at ?? null });
  } catch {
    return reply({ error: "Impossible de vérifier la session. Réessayez." }, 503);
  }
}
