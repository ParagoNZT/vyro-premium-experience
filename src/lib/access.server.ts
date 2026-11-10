import { isAdminIdentity, type AdminIdentity, type VerifiedIdentity } from "./admin-policy.ts";
import { ApiError } from "./api-error.ts";
import { database } from "./database.server.ts";

export { ApiError } from "./api-error.ts";

export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
      "X-Content-Type-Options": "nosniff",
    },
  });

function publicAuthConfig() {
  const runtimeUrl = process.env["SUPABASE_URL"];
  const runtimeKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = runtimeUrl && runtimeKey ? runtimeUrl : import.meta.env?.["VITE_SUPABASE_URL"];
  const key =
    runtimeUrl && runtimeKey ? runtimeKey : import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key || key.startsWith("sb_secret_"))
    throw new ApiError(503, "Service de connexion indisponible.");
  if (!key.startsWith("sb_publishable_")) {
    try {
      const payload = key.split(".")[1]?.replaceAll("-", "+").replaceAll("_", "/");
      if (!payload || JSON.parse(atob(payload)).role !== "anon") throw new Error();
    } catch {
      throw new ApiError(503, "Service de connexion indisponible.");
    }
  }
  const base = new URL(url);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== "https:" &&
      !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)))
  ) {
    throw new ApiError(503, "Service de connexion indisponible.");
  }
  return { endpoint: base.href.replace(/\/+$/, "") + "/auth/v1/user", key };
}

export function identity(request: Request, admin: true | "owner"): Promise<AdminIdentity>;
export function identity(request: Request, admin?: boolean | "owner"): Promise<VerifiedIdentity>;
export async function identity(request: Request, admin: boolean | "owner" = false) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token || token.length > 8192) throw new ApiError(401, "Connexion requise.");
  const { endpoint, key } = publicAuthConfig();
  const result = await fetch(endpoint, {
    headers: { Authorization: "Bearer " + token, apikey: key },
    // Workers reject "error". Keep the credentials on the configured host and reject 3xx below.
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  if (result.status === 401 || result.status === 403)
    throw new ApiError(401, "Session invalide ou expirée.");
  if (!result.ok) throw new ApiError(503, "Service de connexion indisponible.");
  const data = (await result.json()) as Partial<VerifiedIdentity> | null;
  if (
    !data ||
    typeof data.id !== "string" ||
    !data.id ||
    typeof data.email !== "string" ||
    !data.email ||
    typeof data.email_confirmed_at !== "string" ||
    !data.email_confirmed_at ||
    data.is_anonymous === true
  ) {
    throw new ApiError(401, "Session invalide ou adresse non confirmée.");
  }
  const user = data as VerifiedIdentity;
  if (admin) {
    const adminId = process.env["VYRO_ADMIN_USER_ID"];
    if (!adminId?.trim()) throw new ApiError(503, "L’accès administrateur n’est pas configuré.");
    if (isAdminIdentity(user, adminId, process.env["VYRO_ADMIN_EMAIL"]))
      return { ...user, adminRole: "owner" } satisfies AdminIdentity;
    if (admin === "owner" || user.id === adminId.trim())
      throw new ApiError(403, "Accès propriétaire requis.");
    const db = await database();
    const membership = await db
      .prepare(
        `SELECT 1 FROM vyro_admin_memberships m JOIN clients c ON c.id=m.client_id
        AND c.auth_user_id=m.auth_user_id WHERE m.auth_user_id=? AND c.status='active'`,
      )
      .bind(user.id)
      .first();
    if (!membership) throw new ApiError(403, "Accès administrateur requis.");
    return { ...user, adminRole: "admin" } satisfies AdminIdentity;
  }
  return user;
}

export function expectedOrigin(request: Request) {
  const configured = process.env["VYRO_SITE_ORIGIN"]?.trim();
  if (!configured) {
    const url = new URL(request.url);
    if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return url.origin;
    throw new ApiError(503, "L’adresse publique du site n’est pas configurée.");
  }
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.origin !== configured) {
    throw new ApiError(503, "L’adresse publique du site est invalide.");
  }
  return url.origin;
}

export async function limitedBody(
  request: Pick<Request, "headers" | "body">,
  limit: number,
): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    throw new ApiError(413, "Requête trop volumineuse.");
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        throw new ApiError(413, "Requête trop volumineuse.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

export async function body(request: Request) {
  if (request.headers.get("origin") !== expectedOrigin(request))
    throw new ApiError(403, "Origine refusée.");
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  ) {
    throw new ApiError(415, "Format de requête invalide.");
  }
  const raw = await limitedBody(request, 16384);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)) as unknown;
  } catch {
    throw new ApiError(400, "Requête invalide.");
  }
}

export function api(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error("VYRO request failed", error instanceof Error ? error.name : "unknown");
      return json({ error: "Le service est momentanément indisponible. Réessayez." }, 503);
    }
  };
}
