import type { ManagementDB } from "./db-types";
import type {
  AdminClientRow,
  ClientRow,
  LicenseRow,
  AdminPaymentRow,
  AuditRow,
  AdminOverview,
} from "./management-types";
import { ApiError, api, body, identity, json } from "./access.server";
import type { VerifiedIdentity } from "./admin-policy";
import { actionSchema, deviceSchema } from "./management-validation";
import { licensePackUpsertSql, licenseThroughSql, licenseUpsertSql } from "./license-sql";
import {
  expiryAfterParisDay,
  lastIncludedParisDay,
  NO_LICENSE_EXPIRY,
  parisDateInput,
} from "./license-dates";
import {
  licensePackNameKey,
  licensePackTerms,
  standardLicensePacks,
  type LicensePack,
} from "./license-packs";
import { stripeMode } from "./stripe-config.server";
import { getPlan, formatPrice } from "@/config/site";
import { database } from "./database.server";
import type { RemoteDeviceSummary } from "./remote-contract";

export { database } from "./database.server";

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

async function newLicenseKey() {
  const key =
    "VYRO-" +
    Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
  return { key, hash };
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
  const { key, hash } = await newLicenseKey();
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

const customPackColumns =
  "id,name,months,devices,price_cents AS priceCents,enabled,updated_at AS updatedAt";
async function listPacks(db: ManagementDB) {
  const custom = await db
    .prepare(
      `SELECT ${customPackColumns} FROM vyro_custom_packs ORDER BY enabled DESC,name COLLATE NOCASE,id`,
    )
    .all<LicensePack>();
  return [...standardLicensePacks, ...custom.results];
}

export const manageRequest = api(async (request) => {
  const user = await identity(request, true);
  const db = await database();
  const ownerId = process.env["VYRO_ADMIN_USER_ID"]!.trim();
  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    if (params.get("packs") === "1") return json({ packs: await listPacks(db) });
    const page = Math.floor(Math.max(0, Math.min(100000, Number(params.get("page")) || 0)));
    const offset = page * 50;
    const clientQuery = (params.get("client") ?? "").trim().slice(0, 254);
    const [clients, licenses, payments, audit, totals, packs] = await Promise.all([
      db
        .prepare(
          `SELECT c.id,c.email,c.first_name,c.status,c.created_at,c.last_seen_at,
          c.auth_user_id IS NOT NULL AS registered,
          CASE WHEN c.auth_user_id=? THEN 'owner' WHEN m.auth_user_id IS NOT NULL THEN 'admin' END AS admin_role,
          (EXISTS (SELECT 1 FROM show_reseller_memberships s WHERE s.auth_user_id=c.auth_user_id
            AND s.verified_email=c.email AND s.enabled=1)
            OR EXISTS (SELECT 1 FROM partner_apps a WHERE a.owner_id=c.auth_user_id AND a.enabled=1)) AS reseller
          FROM clients c LEFT JOIN vyro_admin_memberships m ON m.client_id=c.id AND m.auth_user_id=c.auth_user_id
          WHERE instr(lower(c.first_name||' '||c.email),lower(?))>0
          ORDER BY c.created_at DESC,c.id LIMIT 51 OFFSET ?`,
        )
        .bind(ownerId, clientQuery, offset)
        .all<AdminClientRow>(),
      db
        .prepare(
          `SELECT l.id,l.client_id,c.email,l.plan_id,l.started_at,l.expires_at,l.manual_expiry,l.pack_id,l.pack_name,l.device_limit,l.status,l.source_payment_id,l.updated_at
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
        .prepare(
          `SELECT a.*,CASE WHEN a.actor_id=? THEN 'Propriétaire' WHEN a.actor_id='stripe' THEN 'Stripe'
          ELSE coalesce(c.email,'Administrateur') END AS actor_label
          FROM audit_log a LEFT JOIN clients c ON c.auth_user_id=a.actor_id
          ORDER BY a.created_at DESC,a.id LIMIT 51 OFFSET ?`,
        )
        .bind(ownerId, offset)
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
      listPacks(db),
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
      hasMoreClients: clients.results.length > 50,
      packs,
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
  } else if (data.action === "save-pack") {
    const id = data.id ?? crypto.randomUUID();
    const name = data.name.replace(/\s+/g, " ");
    const nameKey = licensePackNameKey(name);
    if (standardLicensePacks.some((pack) => licensePackNameKey(pack.name) === nameKey))
      throw new ApiError(409, "Ce nom est réservé à un pack VYRO.");
    const now = new Date().toISOString();
    const statement = data.id
      ? db
          .prepare(
            `UPDATE vyro_custom_packs SET name=?,name_key=?,months=?,devices=?,price_cents=?,updated_at=?
        WHERE id=? AND NOT EXISTS(SELECT 1 FROM vyro_custom_packs WHERE name_key=? AND id<>?)`,
          )
          .bind(name, nameKey, data.months, data.devices, data.priceCents, now, id, nameKey, id)
      : db
          .prepare(
            `INSERT INTO vyro_custom_packs(id,name,name_key,months,devices,price_cents,updated_at)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT(name_key) DO NOTHING`,
          )
          .bind(id, name, nameKey, data.months, data.devices, data.priceCents, now);
    const result = await db.batch([
      statement,
      logIfChanged(db, user.id, data.id ? "pack-updated" : "pack-created", id, name),
    ]);
    if (!changed(result[0]))
      throw new ApiError(409, "Ce nom est déjà utilisé ou le pack est introuvable.");
  } else if (data.action === "pack-availability") {
    const enabled = Number(data.enabled);
    const result = await db.batch([
      db
        .prepare("UPDATE vyro_custom_packs SET enabled=?,updated_at=? WHERE id=? AND enabled<>?")
        .bind(enabled, new Date().toISOString(), data.id, enabled),
      logIfChanged(
        db,
        user.id,
        data.enabled ? "pack-restored" : "pack-archived",
        data.id,
        data.enabled ? "Pack à nouveau attribuable" : "Pack retiré du sélecteur",
      ),
    ]);
    if (!changed(result[0])) throw new ApiError(409, "Ce pack a déjà changé ou est introuvable.");
  } else if (data.action === "grant-pack") {
    const pack =
      standardLicensePacks.find(({ id }) => id === data.packId) ??
      (await db
        .prepare(`SELECT ${customPackColumns} FROM vyro_custom_packs WHERE id=?`)
        .bind(data.packId)
        .first<LicensePack>());
    if (!pack?.enabled || pack.updatedAt !== data.version)
      throw new ApiError(409, "Ce pack a changé ou n’est plus disponible. Actualisez la liste.");
    await requireLinkedActiveLicense(db, data.clientId);
    const { key, hash } = await newLicenseKey();
    const now = new Date().toISOString();
    const result = await db.batch([
      db
        .prepare(licensePackUpsertSql)
        .bind(
          crypto.randomUUID(),
          data.clientId,
          key,
          now,
          pack.months,
          pack.devices,
          hash,
          pack.id,
          pack.name,
          pack.updatedAt,
        ),
      logIfChanged(
        db,
        user.id,
        "pack-granted",
        data.clientId,
        `${pack.name} · ${licensePackTerms(pack)} · ${data.note}`,
      ),
    ]);
    if (!changed(result[0])) {
      const current = await db
        .prepare(
          `SELECT l.expires_at,l.status,
        (SELECT count(*) FROM bindings WHERE code_hash=l.beta_code_hash) AS linked
        FROM licenses l JOIN clients c ON c.id=l.client_id WHERE l.client_id=? AND c.status='active'`,
        )
        .bind(data.clientId)
        .first<{ expires_at: string; status: string; linked: number }>();
      if (
        pack.months !== null &&
        current?.status === "active" &&
        current.expires_at === NO_LICENSE_EXPIRY
      )
        throw new ApiError(
          409,
          "Ce client a déjà un accès sans échéance. Il faut le révoquer explicitement avant d’attribuer une durée limitée.",
        );
      if (current && current.linked > pack.devices)
        throw new ApiError(
          409,
          `Ce compte a ${current.linked} appareils liés. Libérez des places avant d’attribuer un pack limité à ${pack.devices}.`,
        );
      throw new ApiError(
        409,
        "Vérifiez que le compte est confirmé et actif, puis actualisez la liste des packs.",
      );
    }
  } else if (data.action === "grant-license") {
    await requireLinkedActiveLicense(db, data.clientId);
    const result = await db.batch([
      await grantStatement(db, data.clientId, data.planId, data.deviceLimit, null),
      logIfChanged(db, user.id, "license-granted", data.clientId, data.note),
    ]);
    if (!changed(result[0]))
      throw new ApiError(409, "Le client doit avoir un compte confirmé et actif.");
  } else if (data.action === "grant-license-until") {
    const now = Date.now();
    if (data.through < parisDateInput(now) || data.through > "9998-12-31")
      throw new ApiError(400, "La date de fin doit être aujourd’hui ou dans le futur.");
    const expiresAt = expiryAfterParisDay(data.through);
    await requireLinkedActiveLicense(db, data.clientId);
    const { key, hash } = await newLicenseKey();
    const isoNow = new Date(now).toISOString();
    const expected = data.expectedLicenseId ?? null;
    const result = await db.batch([
      db
        .prepare(licenseThroughSql)
        .bind(
          crypto.randomUUID(),
          data.clientId,
          key,
          isoNow,
          expiresAt,
          data.deviceLimit,
          isoNow,
          hash,
          data.clientId,
          expected,
          expected,
          data.clientId,
        ),
      logIfChanged(
        db,
        user.id,
        "license-expiry-set",
        data.clientId,
        `Jusqu’au ${data.through} inclus · ${data.deviceLimit} appareil(s) · ${data.note}`,
      ),
    ]);
    if (!changed(result[0]))
      throw new ApiError(
        409,
        "Le compte doit être confirmé et actif, la licence modifiable et le quota suffisant. Un accès sans échéance ne peut pas être converti en durée limitée ici.",
      );
  } else if (data.action === "client-admin-role") {
    if (user.adminRole !== "owner")
      throw new ApiError(403, "Seul le propriétaire peut modifier les rôles.");
    const statement = data.grant
      ? db
          .prepare(
            `INSERT INTO vyro_admin_memberships(auth_user_id,client_id,granted_by,granted_at)
          SELECT auth_user_id,id,?,? FROM clients WHERE id=? AND status='active'
          AND auth_user_id IS NOT NULL AND auth_user_id<>? ON CONFLICT DO NOTHING`,
          )
          .bind(user.id, new Date().toISOString(), data.clientId, ownerId)
      : db
          .prepare("DELETE FROM vyro_admin_memberships WHERE client_id=? AND auth_user_id<>?")
          .bind(data.clientId, ownerId);
    const result = await db.batch([
      statement,
      logIfChanged(
        db,
        user.id,
        data.grant ? "admin-role-granted" : "admin-role-revoked",
        data.clientId,
        data.note,
      ),
    ]);
    if (!changed(result[0]))
      throw new ApiError(409, "Aucun rôle modifié. Vérifiez l’état du compte et son rôle actuel.");
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
        .prepare(
          `UPDATE clients SET status=? WHERE id=? AND auth_user_id IS NOT ?
          AND (?=1 OR NOT EXISTS (SELECT 1 FROM vyro_admin_memberships m WHERE m.client_id=clients.id))`,
        )
        .bind(data.status, data.clientId, ownerId, Number(user.adminRole === "owner")),
      logIfChanged(db, user.id, "client-" + data.status, data.clientId, data.note),
    ]);
    if (!changed(result[0]))
      throw new ApiError(409, "Client introuvable ou droits insuffisants pour modifier ce compte.");
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
  const [license, devices, remoteDevices, orders] = await Promise.all([
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
      'Android / TV' AS platform,coalesce(p.last_seen,b.created_at) AS lastSeen,
      nullif(trim(p.android_version),'') AS androidVersion,nullif(trim(p.app_version),'') AS appVersion
      FROM bindings b
      JOIN licenses l ON l.beta_code_hash=b.code_hash LEFT JOIN device_profiles p ON p.code_hash=b.code_hash AND p.device_hash=b.device_hash
      WHERE l.client_id=? ORDER BY lastSeen DESC`,
      )
      .bind(client.id)
      .all(),
    db
      .prepare(
        `SELECT id,edition,kind,name,last_seen AS lastSeen FROM remote_devices
        WHERE owner_id=? ORDER BY paired_at DESC,id LIMIT 10`,
      )
      .bind(user.id)
      .all<RemoteDeviceSummary>(),
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
  const expiresOn = license?.manual_expiry ? lastIncludedParisDay(license.expires_at) : undefined;
  return {
    id: user.id,
    email: client.email,
    firstName: client.first_name,
    licenseKey: active ? license.license_key : "",
    subscription: license
      ? {
          planId: license.plan_id,
          planName:
            license.pack_name ??
            (license.manual_expiry === 1
              ? "Durée personnalisée"
              : license.expires_at === NO_LICENSE_EXPIRY
                ? "Sans échéance"
                : (plan?.name ?? license.plan_id)),
          status: active ? "active" : license.status === "revoked" ? "revoked" : "expired",
          startedAt: license.started_at,
          expiresAt: license.expires_at === NO_LICENSE_EXPIRY ? null : license.expires_at,
          expiresOn,
          devicesUsed: devices.results.length,
          devicesAllowed: license.device_limit,
        }
      : null,
    devices: devices.results,
    remoteDevices: remoteDevices.results,
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
