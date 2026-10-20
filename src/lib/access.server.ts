import { createClient, type User } from "@supabase/supabase-js";
import { isAdminIdentity } from "./admin-policy";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store, private", Vary: "Authorization" } });
export async function identity(request: Request, admin = false): Promise<User> {
 const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
 if (!token) throw new ApiError(401, "Connexion requise.");
 const client = createClient(import.meta.env['VITE_SUPABASE_URL'], import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'], { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
 const {data,error} = await client.auth.getUser(token);
 if (error || !data.user || data.user.is_anonymous || !data.user.email_confirmed_at) throw new ApiError(401, "Session invalide ou adresse non confirmée.");
 if (admin && !isAdminIdentity(data.user, process.env['VYRO_ADMIN_EMAIL'])) throw new ApiError(403, "Accès administrateur requis.");
 return data.user;
}
export async function body(request: Request) {
 if (request.headers.get("origin") !== new URL(request.url).origin) throw new ApiError(403, "Origine refusée.");
 if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415, "Format de requête invalide.");
 const text = await request.text();
 if (text.length > 16384) throw new ApiError(413, "Requête trop volumineuse.");
 try { return JSON.parse(text) as unknown; } catch { throw new ApiError(400, "Requête invalide."); }
}
export function api(handler: (request: Request) => Promise<Response>) {
 return async (request: Request) => { try { return await handler(request); } catch (error) {
 if (error instanceof ApiError) return json({error:error.message},error.status);
 console.error("Management request failed", error instanceof Error ? error.name : "unknown");
 return json({error:"Le service est momentanément indisponible. Réessayez."},503);
 } };
}
