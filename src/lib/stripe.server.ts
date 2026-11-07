import { ApiError, api, body, expectedOrigin, identity, json, limitedBody } from "./access.server";
import {
  database,
  trackClient,
  grantStatement,
  logIfChanged,
  changed,
  requireLinkedActiveLicense,
} from "./management.server";
import { checkoutSchema } from "./management-validation";
import { verifyStripeSignature } from "./stripe-signature";
import { stripeMode } from "./stripe-config.server";
import {
  attachPaymentSql,
  suppressRefundedFulfillmentSql,
  recordGrantSql,
  finalizePaymentSql,
  recordRefundSql,
  revokeSoleGrantSql,
  finalizeRefundSql,
} from "./stripe-ledger-sql";
import { getPlan } from "@/config/site";
import type { PaymentRow } from "./management-types";
import type { ManagementDB } from "./db-types";

type StripeSession = {
  id: string;
  url: string | null;
  payment_status: string;
  status: string;
  amount_total: number;
  currency: string;
  livemode: boolean;
  client_reference_id: string | null;
  payment_intent: string | null;
  metadata: Record<string, string> | null;
};
type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: Record<string, unknown> };
};

async function stripeCall<T>(
  path: string,
  form?: URLSearchParams,
  idempotency?: string,
): Promise<T> {
  if (!stripeMode().enabled) throw new ApiError(503, "Le paiement Stripe n’est pas configuré.");
  const response = await fetch("https://api.stripe.com/v1/" + path, {
    method: form ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + process.env["STRIPE_SECRET_KEY"],
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    ...(form ? { body: form } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok)
    throw new ApiError(502, "Stripe n’a pas pu traiter la demande. Aucun accès n’a été activé.");
  return response.json() as Promise<T>;
}

function checkoutUrl(url: string | null) {
  if (!url) throw new ApiError(502, "Page de paiement indisponible.");
  const target = new URL(url);
  if (target.origin !== "https://checkout.stripe.com" || target.username || target.password) {
    throw new ApiError(502, "Page de paiement indisponible.");
  }
  return target.href;
}

async function checkoutDatabase() {
  const db = await database();
  try {
    const schema = await db
      .prepare(
        `SELECT
          (SELECT count(*) FROM sqlite_master WHERE type='trigger' AND name IN
            ('vyro_license_insert','vyro_license_update','vyro_client_status','vyro_beta_update','vyro_beta_delete')) AS triggers,
          (SELECT beta_code_hash FROM licenses WHERE 0) AS linked,
          (SELECT payment_intent FROM stripe_full_refunds WHERE 0) AS refunds,
          (SELECT payment_id FROM stripe_license_grants WHERE 0) AS grants,
          (SELECT id FROM codes WHERE 0) AS codes,
          (SELECT code_hash FROM bindings WHERE 0) AS bindings`,
      )
      .bind()
      .first<{ triggers: number }>();
    if (schema?.triggers === 5) return db;
  } catch {
    // Fail before creating a payable Checkout Session when the D1 schema isn't ready.
  }
  throw new ApiError(503, "La base de paiement n’est pas encore prête.");
}

export const checkoutStatus = api(async (request) => {
  const mode = stripeMode();
  if (mode.enabled) {
    expectedOrigin(request);
    await checkoutDatabase();
  }
  return json(mode);
});

export const checkoutRequest = api(async (request) => {
  const user = await identity(request);
  const input = checkoutSchema.safeParse(await body(request));
  if (!input.success) throw new ApiError(400, "Offre invalide.");
  const plan = getPlan(input.data.planId);
  if (!plan) throw new ApiError(400, "Offre invalide.");
  const mode = stripeMode();
  if (!mode.enabled) throw new ApiError(503, "Le paiement Stripe n’est pas configuré.");
  const origin = expectedOrigin(request);
  const db = await checkoutDatabase();
  const client = await trackClient(db, user);
  if (client.status !== "active") throw new ApiError(403, "Votre compte est suspendu.");
  await requireLinkedActiveLicense(db, client.id);
  const requestKey = client.id + ":" + input.data.requestKey;
  const live = Number(mode.live);
  await db
    .prepare(
      `INSERT INTO payments(id,client_id,plan_id,amount_cents,currency,created_at,livemode,request_key)
    SELECT ?,?,?,?,'eur',?,?,? WHERE EXISTS (SELECT 1 FROM clients WHERE id=? AND status='active')
    AND (SELECT count(*) FROM payments WHERE client_id=? AND created_at>?)<8
    ON CONFLICT(request_key) DO NOTHING`,
    )
    .bind(
      crypto.randomUUID(),
      client.id,
      plan.id,
      Math.round(plan.price * 100),
      new Date().toISOString(),
      live,
      requestKey,
      client.id,
      client.id,
      new Date(Date.now() - 60_000).toISOString(),
    )
    .run();
  const order = await db
    .prepare("SELECT * FROM payments WHERE request_key=? AND client_id=?")
    .bind(requestKey, client.id)
    .first<PaymentRow>();
  if (!order)
    throw new ApiError(429, "Impossible de créer une commande. Attendez une minute et réessayez.");
  if (order.plan_id !== plan.id || order.livemode !== live || order.status !== "pending") {
    throw new ApiError(409, "Cette demande a déjà été traitée. Rechargez la page.");
  }
  if (order.stripe_session_id) {
    const session = await stripeCall<StripeSession>(
      "checkout/sessions/" + encodeURIComponent(order.stripe_session_id),
    );
    if (session.status !== "open")
      throw new ApiError(409, "Cette session a expiré ou a été traitée. Rechargez la page.");
    return json({ url: checkoutUrl(session.url) });
  }
  const form = new URLSearchParams({
    mode: "payment",
    "managed_payments[enabled]": "false",
    "adaptive_pricing[enabled]": "false",
    client_reference_id: order.id,
    customer_email: user.email,
    success_url: origin + "/account?payment=" + (mode.live ? "processing" : "test"),
    cancel_url: origin + "/checkout?plan=" + plan.id,
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(order.amount_cents),
    "line_items[0][price_data][product_data][name]": "VYRO Premium · " + plan.name,
    "line_items[0][quantity]": "1",
    "metadata[order_id]": order.id,
    "metadata[plan_id]": plan.id,
    "metadata[client_id]": client.id,
    "payment_intent_data[metadata][order_id]": order.id,
  });
  const session = await stripeCall<StripeSession>(
    "checkout/sessions",
    form,
    "checkout-" + order.id,
  );
  const url = checkoutUrl(session.url);
  if (!/^cs_[A-Za-z0-9_]+$/.test(session.id) || session.livemode !== mode.live) {
    throw new ApiError(502, "Session Stripe invalide.");
  }
  const persisted = await db
    .prepare(
      `UPDATE payments SET stripe_session_id=?
    WHERE id=? AND status='pending' AND (stripe_session_id IS NULL OR stripe_session_id=?)`,
    )
    .bind(session.id, order.id, session.id)
    .run();
  if (!changed(persisted)) throw new ApiError(409, "Cette commande a déjà été traitée.");
  return json({ url });
});

const eventTypes = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "charge.refunded",
  "charge.dispute.created",
]);
const received = () => json({ received: true });
const intentId = (value: unknown): value is string =>
  typeof value === "string" && /^pi_[A-Za-z0-9_]{1,120}$/.test(value);

function markEvent(db: ManagementDB, event: StripeEvent, now: string) {
  return db
    .prepare("INSERT OR IGNORE INTO stripe_events(id,type,processed_at) VALUES(?,?,?)")
    .bind(event.id, event.type, now);
}

async function handleRefundOrDispute(db: ManagementDB, event: StripeEvent, now: string) {
  const charge = event.data.object;
  const intent = charge["payment_intent"];
  if (!intentId(intent)) throw new ApiError(400, "Identifiant du paiement invalide.");
  const mode = Number(event.livemode);
  if (event.type === "charge.refunded" && charge["refunded"] === true) {
    await db.batch([
      db.prepare(recordRefundSql).bind(intent, mode, now),
      db.prepare(revokeSoleGrantSql).bind(now, intent, mode),
      db
        .prepare(
          `INSERT INTO audit_log(id,actor_id,action,target_id,note,created_at)
        SELECT ?,'stripe',CASE WHEN changes()>0 THEN 'payment-refunded' ELSE 'payment-refund-review' END,id,
        CASE WHEN changes()>0 THEN 'Remboursement intégral ; accès lié révoqué.'
          ELSE 'Remboursement intégral ; vérifier l’accès et les renouvellements.' END,?
        FROM payments WHERE stripe_payment_intent=? AND livemode=1 AND status='paid'
        AND NOT EXISTS (SELECT 1 FROM stripe_events WHERE id=?) LIMIT 1`,
        )
        .bind(crypto.randomUUID(), now, intent, event.id),
      db.prepare(finalizeRefundSql).bind(intent, mode),
      markEvent(db, event, now),
    ]);
  } else {
    // A partial refund or dispute does not prove that the entire term should be revoked.
    if (event.livemode)
      await db.batch([
        db
          .prepare(
            `INSERT INTO audit_log(id,actor_id,action,target_id,note,created_at)
        SELECT ?,'stripe','payment-review',coalesce(
          (SELECT id FROM payments WHERE stripe_payment_intent=? AND livemode=1), ?),?,?
        WHERE NOT EXISTS (SELECT 1 FROM stripe_events WHERE id=?)`,
          )
          .bind(
            crypto.randomUUID(),
            intent,
            event.id,
            event.type === "charge.dispute.created"
              ? "Litige Stripe : vérification nécessaire."
              : "Remboursement partiel : vérification nécessaire.",
            now,
            event.id,
          ),
        markEvent(db, event, now),
      ]);
  }
  return received();
}

export const webhookRequest = api(async (request) => {
  const mode = stripeMode();
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!mode.enabled || !secret) throw new ApiError(503, "Stripe n’est pas configuré.");
  const raw = await limitedBody(request, 1_048_576);
  if (!(await verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)))
    throw new ApiError(400, "Signature invalide.");
  let event: StripeEvent;
  try {
    event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new ApiError(400, "Événement invalide.");
  }
  if (
    !event ||
    typeof event.id !== "string" ||
    !/^evt_[A-Za-z0-9_]{1,120}$/.test(event.id) ||
    typeof event.type !== "string" ||
    typeof event.livemode !== "boolean" ||
    !event.data?.object
  ) {
    throw new ApiError(400, "Événement invalide.");
  }
  if (!eventTypes.has(event.type) || mode.live !== event.livemode) return received();
  const db = await database();
  if (await db.prepare("SELECT id FROM stripe_events WHERE id=?").bind(event.id).first())
    return received();
  const now = new Date().toISOString();
  if (event.type === "charge.refunded" || event.type === "charge.dispute.created")
    return handleRefundOrDispute(db, event, now);

  const sessionId = event.data.object["id"];
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{1,120}$/.test(sessionId))
    throw new ApiError(400, "Session invalide.");
  const session = await stripeCall<StripeSession>(
    "checkout/sessions/" + encodeURIComponent(sessionId),
  );
  const order = session.client_reference_id
    ? await db
        .prepare("SELECT * FROM payments WHERE id=?")
        .bind(session.client_reference_id)
        .first<PaymentRow>()
    : null;
  if (!order) return received();
  if (
    session.id !== sessionId ||
    session.metadata?.["order_id"] !== order.id ||
    session.metadata?.["client_id"] !== order.client_id ||
    session.metadata?.["plan_id"] !== order.plan_id ||
    session.amount_total !== order.amount_cents ||
    session.currency !== order.currency ||
    session.currency !== "eur" ||
    session.livemode !== event.livemode ||
    Number(session.livemode) !== order.livemode ||
    (order.stripe_session_id && order.stripe_session_id !== session.id)
  ) {
    throw new ApiError(400, "La session ne correspond pas à la commande.");
  }
  if (session.payment_status === "paid" && session.status === "complete") {
    const intent = session.payment_intent;
    if (
      !intentId(intent) ||
      (order.stripe_payment_intent && order.stripe_payment_intent !== intent)
    ) {
      throw new ApiError(400, "Identifiant du paiement invalide.");
    }
    await db.batch([
      db.prepare(attachPaymentSql).bind(session.id, intent, order.id, session.id, intent),
      db.prepare(suppressRefundedFulfillmentSql).bind(order.id),
      logIfChanged(
        db,
        "stripe",
        "payment-refunded",
        order.id,
        "Remboursement reçu avant l’activation ; aucun accès délivré.",
      ),
      ...(order.livemode === 1
        ? [
            db.prepare(recordGrantSql).bind(now, now, order.id, session.id, intent),
            await grantStatement(
              db,
              order.client_id,
              order.plan_id,
              3,
              order.id,
              now,
              session.id,
              intent,
            ),
          ]
        : []),
      db.prepare(finalizePaymentSql).bind(now, order.id, session.id, intent),
      logIfChanged(
        db,
        "stripe",
        order.livemode ? "payment-paid" : "test-payment-paid",
        order.id,
        "Paiement confirmé par Stripe.",
      ),
      markEvent(db, event, now),
    ]);
  } else if (event.type === "checkout.session.async_payment_failed") {
    await db.batch([
      db
        .prepare("UPDATE payments SET status='failed' WHERE id=? AND status='pending'")
        .bind(order.id),
      logIfChanged(db, "stripe", "payment-failed", order.id, "Paiement refusé par Stripe."),
      markEvent(db, event, now),
    ]);
  }
  return received();
});
