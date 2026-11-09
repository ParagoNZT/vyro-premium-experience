// Runs inside the existing authenticated SHOW+ control plane. The site owns
// all writes; a client can report capability, pull its own commands, and ack.
export function createPartnerRuntime(
  showScope,
  { json, ApiError, installation, binding, readBody },
) {
  const validId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
  const registeredApp = async (env, codeHash) =>
    env.DB.prepare(
      `
    SELECT a.id,a.name,a.enabled,a.server_url AS url,a.server_updated_at AS updatedAt
    FROM partner_apps a WHERE a.id=coalesce(
      (SELECT app_id FROM partner_app_devices WHERE code_hash=?),
      (SELECT 'show-plus' FROM codes c WHERE c.code_hash=? AND ${showScope}))
  `,
    )
      .bind(codeHash, codeHash)
      .first();

  async function requestedApp(env, body) {
    if (body.partnerAppId === undefined || body.partnerAppId === "") return null;
    if (
      typeof body.partnerAppId !== "string" ||
      !validId.test(body.partnerAppId) ||
      typeof body.partnerPackage !== "string" ||
      body.partnerPackage.length > 140
    )
      throw new ApiError("Application partenaire invalide.", 400);
    const app = await env.DB.prepare(
      `SELECT id,name FROM partner_apps
      WHERE id=? AND package_name=? AND enabled=1`,
    )
      .bind(body.partnerAppId, body.partnerPackage)
      .first();
    if (!app) throw new ApiError("Application partenaire indisponible.", 403);
    return app;
  }

  async function ensureIdentity(env, codeHash, requested) {
    const assigned = await env.DB.prepare(
      "SELECT app_id AS app FROM partner_app_devices WHERE code_hash=?",
    )
      .bind(codeHash)
      .first();
    if ((assigned?.app ?? null) !== (requested?.id ?? null))
      throw new ApiError("Cette installation appartient à une autre application.", 403);
  }

  async function managedServer(env, codeHash) {
    const app = await registeredApp(env, codeHash);
    if (app && app.id !== "show-plus") {
      // New brands must never inherit the SHOW+ XC domain.
      return app.enabled && app.url ? app : null;
    }
    if (app?.url && app.enabled) return app;
    return env.DB.prepare(
      "SELECT server_url AS url,updated_at AS updatedAt FROM beta_settings WHERE id=1",
    ).first();
  }

  async function deviceRequest(request, env) {
    const body = await readBody(request, 4096);
    const auth = await installation(body, env, async (value) =>
      [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
    );
    if (!auth) throw new ApiError("Installation non autorisée.", 403);
    await binding(env, auth.codeHash, auth.deviceHash);
    const app = await registeredApp(env, auth.codeHash);
    if (!app?.enabled) throw new ApiError("Application partenaire indisponible.", 403);
    const now = new Date().toISOString();
    const path = new URL(request.url).pathname;
    if (path.endsWith("/update")) {
      if (app.id === "show-plus") throw new ApiError("Utilisez le canal SHOW+.", 400);
      const release = await env.DB.prepare(
        `SELECT r.version_code AS versionCode,r.version_name AS versionName,
        r.apk_url AS apkUrl,r.sha256,r.changelog FROM partner_releases r WHERE r.app_id=?
        AND (r.initial=1 OR EXISTS(SELECT 1 FROM partner_update_periods p WHERE p.app_id=r.app_id
          AND p.starts_at<=r.published_at AND p.ends_at>r.published_at))
        ORDER BY r.version_code DESC LIMIT 1`,
      )
        .bind(app.id)
        .first();
      return json(
        release ?? {
          versionCode: 0,
          versionName: "Aucune mise à jour",
          apkUrl: "",
          changelog: "",
          sha256: null,
        },
      );
    }
    if (body.ack !== undefined) {
      const ack = body.ack;
      if (
        !ack ||
        typeof ack !== "object" ||
        !validId.test(ack.id) ||
        !["applied", "failed"].includes(ack.outcome)
      )
        throw new ApiError("Accusé de réception invalide.", 400);
      const state = await env.DB.prepare(
        `UPDATE partner_commands SET completed_at=?,outcome=?
        WHERE id=? AND code_hash=? AND app_id=? AND completed_at IS NULL AND expires_at>?
        RETURNING id`,
      )
        .bind(now, ack.outcome, ack.id, auth.codeHash, app.id, now)
        .first();
      const prior =
        state ||
        (await env.DB.prepare(
          "SELECT id FROM partner_commands WHERE id=? AND code_hash=? AND app_id=?",
        )
          .bind(ack.id, auth.codeHash, app.id)
          .first());
      if (!prior) throw new ApiError("Commande introuvable.", 404);
      return json({ ok: true });
    }
    const capability = await env.DB.prepare(
      "SELECT reported_at AS reportedAt FROM partner_client_capabilities WHERE code_hash=?",
    )
      .bind(auth.codeHash)
      .first();
    if (!capability || Date.parse(now) - Date.parse(capability.reportedAt) > 86400000)
      await env.DB.prepare(
        `INSERT INTO partner_client_capabilities(code_hash,reported_at) VALUES (?,?)
        ON CONFLICT(code_hash) DO UPDATE SET reported_at=excluded.reported_at`,
      )
        .bind(auth.codeHash, now)
        .run();
    const { results } = await env.DB.prepare(
      `SELECT id,kind FROM partner_commands WHERE app_id=? AND code_hash=?
      AND expires_at>? AND completed_at IS NULL ORDER BY created_at,id LIMIT 8`,
    )
      .bind(app.id, auth.codeHash, now)
      .all();
    return json({ commands: results });
  }
  return { registeredApp, requestedApp, ensureIdentity, managedServer, deviceRequest };
}
