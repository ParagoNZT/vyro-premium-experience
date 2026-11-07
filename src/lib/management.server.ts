import type { ManagementDB } from "./db-types";
import type {
  ClientRow,
  LicenseRow,
  AdminPaymentRow,
  AuditRow,
  AdminOverview,
} from "./management-types";
import { ApiError, api, body, identity, json } from "./access.server";
import type { VerifiedIdentity } from "./admin-policy";
import { actionSchema, deviceSchema } from "./management-validation";
import { licenseUpsertSql } from "./license-sql";
import { stripeMode } from "./stripe-config.server";
import { getPlan, formatPrice } from "@/config/site";

export async function database(): Promise<ManagementDB> {
  let db: ManagementDB | undefined;
  try {
    db = (await import("cloudflare:workers")).env["VYRO_DB"] as ManagementDB | undefined;
  } catch {
    /* non-Worker preview */
  }
  if (!db) throw new ApiError(503, "La base de gestion n’est pas encore reliée.");
  return db;
}

export async function trackClient(db: ManagementDB, user: VerifiedIdentity) {
  const now = new Date().toISOString();
  const email = user.email.trim().toLowerCase();
  const givenName = user.user_metadata?.["first_name"];
  const name =
    (typeof givenName === "string" && givenName.trim().slice(0, 80)) ||
    email.split("@")[0]!.slice(0, 80);
  await db.batch([
    db
      .prepare(
        `UPDATE clients SET email=?,first_name=?,last_seen_at=? WHERE auth_user_id=?
      AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.email=? AND c.id<>clients.id)
      AND (email<>? OR first_name<>? OR last_seen_at IS NULL OR last_seen_at<?)`,
      )
      .bind(
        email,
        name,
        now,
        user.id,
        email,
        email,
        name,
        new Date(Date.now() - 60_000).toISOString(),
      ),
    db
      .prepare(
        `INSERT INTO clients(id,auth_user_id,email,first_name,created_at,last_seen_at)
      SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM clients WHERE auth_user_id=?)
      ON CONFLICT(email) DO UPDATE SET auth_user_id=excluded.auth_user_id,first_name=excluded.first_name,last_seen_at=excluded.last_seen_at
      WHERE clients.auth_user_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM licenses WHERE client_id=clients.id)
      AND NOT EXISTS (SELECT 1 FROM payments WHERE client_id=clients.id)`,
      )
      .bind(crypto.randomUUID(), user.id, email, name, now, now, user.id),
  ]);
  const client = await db
    .prepare("SELECT * FROM clients WHERE auth_user_id=?")
    .bind(user.id)
    .first<ClientRow>();
  if (!client || client.email.toLowerCase() !== email)
    throw new ApiError(
      409,
      "Cette adresse est déjà rattachée à un autre compte. Contactez le support.",
    );
  return client;
}

export const logStatement = (
  db: ManagementDB,
  actor: string,
  action: string,
  target: string,
  note: string,
) =>
  db
    .prepare(
      "INSERT INTO audit_log(id,actor_id,action,target_id,note,created_at) VALUES(?,?,?,?,?,?)",
    )
    .bind(crypto.randomUUID(), actor, action, target, note, new Date().toISOString());

export async function requireLinkedActiveLicense(db: ManagementDB, clientId: string) {
  const legacy = await db
    .prepare(
      `SELECT id FROM licenses WHERE client_id=? AND status='active' AND expires_at>?
        AND (beta_code_hash IS NULL OR NOT EXISTS (SELECT 1 FROM codes WHERE code_hash=licenses.beta_code_hash))`,
    )
    .bind(clientId, new Date().toISOString())
    .first();
  if (legacy)
    throw new ApiError(
      409,
      "Cette ancienne licence doit être rapprochée avec son accès TV. Contactez le support.",
    );
}

export async function grantStatement(
  db: ManagementDB,
  clientId: string,
  planId: string,
  deviceLimit: number,
  paymentId: string | null,
  now = new Date().toISOString(),
  sessionId: string | null = null,
  intent: string | null = null,
) {
  const plan = getPlan(planId);
  if (!plan) throw new ApiError(400, "Offre invalide.");
  const key =
    "VYRO-" +
    Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
  return db
    .prepare(licenseUpsertSql)
    .bind(
      crypto.randomUUID(),
      clientId,
      key,
      planId,
      now,
      now,
      plan.months,
      deviceLimit,
      paymentId,
      now,
      hash,
      clientId,
      paymentId,
      paymentId,
      paymentId,
      clientId,
      sessionId,
      intent,
      plan.months,
    );
}

export const manageRequest = api(async (request) => {
  const user = await identity(request, true);
  const db = await database();
  if (request.method === "GET") {
    const page = Math.floor(
      Math.max(0, Math.min(100000, Number(new URL(request.url).searchParams.get("page")) || 0)),
    );
    const offset = page * 50;
    const [clients, licenses, payments, audit, totals] = await Promise.all([
      db
        .prepare("SELECT * FROM clients ORDER BY created_at DESC,id LIMIT 51 OFFSET ?")
        .bind(offset)
        .all<ClientRow>(),
      db
        .prepare(
          `SELECT l.id,l.client_id,c.email,l.plan_id,l.started_at,l.expires_at,l.device_limit,l.status,l.source_payment_id,l.updated_at
        FROM licenses l JOIN clients c ON c.id=l.client_id ORDER BY l.updated_at DESC,l.id LIMIT 51 OFFSET ?`,
        )
        .bind(offset)
        .all<LicenseRow>(),
      db
        .prepare(
          `SELECT p.id,p.client_id,c.email,p.plan_id,p.amount_cents,p.currency,p.status,p.created_at,p.paid_at,p.livemode
        FROM payments p JOIN clients c ON c.id=p.client_id ORDER BY p.created_at DESC,p.id LIMIT 51 OFFSET ?`,
        )
        .bind(offset)
        .all<AdminPaymentRow>(),
      db
        .prepare("SELECT * FROM audit_log ORDER BY created_at DESC,id LIMIT 51 OFFSET ?")
        .bind(offset)
        .all<AuditRow>(),
      db
        .prepare(
          `SELECT (SELECT count(*) FROM clients) AS clients,
        (SELECT count(*) FROM licenses l JOIN clients c ON c.id=l.client_id JOIN codes b ON b.code_hash=l.beta_code_hash
          WHERE l.status='active' AND c.status='active' AND b.enabled=1 AND l.expires_at>?) AS activeLicenses,
        (SELECT coalesce(sum(amount_cents),0) FROM payments WHERE status='paid' AND livemode=1) AS paidCents,
        (SELECT coalesce(sum(amount_cents),0) FROM payments WHERE status='paid' AND livemode=0) AS testPaidCents`,
        )
        .bind(new Date().toISOString())
        .first<AdminOverview["stats"]>(),
    ]);
    const stripe = stripeMode();
    return json({
      clients: clients.results.slice(0, 50),
      licenses: licenses.results.slice(0, 50),
      payments: payments.results.slice(0, 50),
      audit: audit.results.slice(0, 50),
      stats: totals,
      stripe: { configured: stripe.enabled, live: stripe.live },
      page,
      hasMore: [clients, licenses, payments, audit].some((v) => v.results.length > 50),
    });
  }
  const parsed = actionSchema.safeParse(await body(request));
  if (!parsed.success)
    throw new ApiError(400, parsed.error.issues[0]?.message || "Vérifiez les champs.");
  const data = parsed.data;
  if (data.action === "create-client") {
    const id = crypto.randomUUID();
    const result = await db.batch([
      db
        .prepare(
          "INSERT INTO clients(id,email,first_name,created_at) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING",
        )
        .bind(id, data.email, data.firstName, new Date().toISOString()),
      logIfChanged(db, user.id, "client-created", id, "Fiche client créée"),
    ]);
    if (!changed(result[0])) throw new ApiError(409, "Cette fiche client existe déjà.");
  } else if (data.action === "grant-license") {
    await requireLinkedActiveLicense(db, data.clientId);
    const result = await db.batch([
      await grantStatement(db, data.clientId, data.planId, data.deviceLimit, null),
      logIfChanged(db, user.id, "license-granted", data.clientId, data.note),
    ]);
    if (!changed(result[0]))
      throw new ApiError(409, "Le client doit avoir un compte confirmé et actif.");
  } else if (data.action === "revoke-license") {
    const result = await db.batch([
      db
        .prepare("UPDATE licenses SET status='revoked',updated_at=? WHERE id=?")
        .bind(new Date().toISOString(), data.licenseId),
      logIfChanged(db, user.id, "license-revoked", data.licenseId, data.note),
    ]);
    if (!changed(result[0])) throw new ApiError(404, "Licence introuvable.");
  } else {
    const result = await db.batch([
      db
        .prepare("UPDATE clients SET status=? WHERE id=? AND auth_user_id IS NOT ?")
        .bind(data.status, data.clientId, user.id),
      logIfChanged(db, user.id, "client-" + data.status, data.clientId, data.note),
    ]);
    if (!changed(result[0]))
      throw new ApiError(
        409,
        "Client introuvable ou modification de votre propre accès interdite.",
      );
  }
  return json({ ok: true });
});

export function changed(result: { meta?: { changes?: number } } | undefined) {
  return Boolean(result?.meta?.changes);
}

export const logIfChanged = (
  db: ManagementDB,
  actor: string,
  action: string,
  target: string,
  note: string,
) =>
  db
    .prepare(
      "INSERT INTO audit_log(id,actor_id,action,target_id,note,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0",
    )
    .bind(crypto.randomUUID(), actor, action, target, note, new Date().toISOString());

export async function accountData(db: ManagementDB, client: ClientRow, user: VerifiedIdentity) {
  const [license, devices, orders] = await Promise.all([
    db
      .prepare(
        `SELECT l.*,b.enabled AS tv_enabled,c.status AS client_status FROM licenses l
      JOIN clients c ON c.id=l.client_id LEFT JOIN codes b ON b.code_hash=l.beta_code_hash WHERE l.client_id=?`,
      )
      .bind(client.id)
      .first<
        LicenseRow & { license_key: string; tv_enabled: number | null; client_status: string }
      >(),
    db
      .prepare(
        `SELECT b.device_hash AS id,coalesce(nullif(trim(coalesce(p.manufacturer,'')||' '||coalesce(p.model,'')),''),'Appareil TV') AS name,
      'Android / TV' AS platform,coalesce(p.last_seen,b.created_at) AS lastSeen FROM bindings b
      JOIN licenses l ON l.beta_code_hash=b.code_hash LEFT JOIN device_profiles p ON p.code_hash=b.code_hash AND p.device_hash=b.device_hash
      WHERE l.client_id=? ORDER BY lastSeen DESC`,
      )
      .bind(client.id)
      .all(),
    db
      .prepare(
        `SELECT id,paid_at,plan_id,amount_cents FROM payments
      WHERE client_id=? AND status='paid' AND livemode=1 ORDER BY paid_at DESC LIMIT 100`,
      )
      .bind(client.id)
      .all<Pick<AdminPaymentRow, "id" | "paid_at" | "plan_id" | "amount_cents">>(),
  ]);
  if (license?.client_status === "suspended")
    throw new ApiError(403, "Votre accès au site est suspendu. Contactez le support.");
  const active =
    license?.status === "active" &&
    license.tv_enabled === 1 &&
    license.expires_at > new Date().toISOString();
  const plan = license ? getPlan(license.plan_id) : undefined;
  return {
    id: user.id,
    email: client.email,
    firstName: client.first_name,
    licenseKey: active ? license.license_key : "",
    subscription: license
      ? {
          planId: license.plan_id,
          planName: plan?.name ?? license.plan_id,
          status: active ? "active" : license.status === "revoked" ? "revoked" : "expired",
          startedAt: license.started_at,
          expiresAt: license.expires_at,
          devicesUsed: devices.results.length,
          devicesAllowed: license.device_limit,
        }
      : null,
    devices: devices.results,
    orders: orders.results.map((p) => ({
      id: p.id,
      date: p.paid_at,
      planName: getPlan(p.plan_id)?.name ?? p.plan_id,
      amount: formatPrice(p.amount_cents / 100),
      status: "paid",
    })),
  };
}

export const accountRequest = api(async (request) => {
  const user = await identity(request);
  const parsed =
    request.method === "POST" ? deviceSchema.safeParse(await body(request)) : undefined;
  if (parsed && !parsed.success) throw new ApiError(400, "Vérifiez l’identifiant de l’appareil.");
  if (parsed?.data?.action === "add")
    throw new ApiError(
      400,
      "Saisissez votre clé dans l’application TV : l’appareil apparaîtra automatiquement ici.",
    );
  const db = await database();
  const client = await trackClient(db, user);
  if (client.status !== "active")
    throw new ApiError(403, "Votre accès au site est suspendu. Contactez le support.");
  if (parsed?.data?.action === "remove") {
    const result = await db
      .prepare(
        `DELETE FROM bindings WHERE device_hash=? AND code_hash=(
      SELECT l.beta_code_hash FROM licenses l JOIN clients c ON c.id=l.client_id WHERE c.id=? AND c.status='active')`,
      )
      .bind(parsed.data.id, client.id)
      .run();
    if (!changed(result)) throw new ApiError(404, "Appareil introuvable.");
  }
  return json(await accountData(db, client, user));
});
