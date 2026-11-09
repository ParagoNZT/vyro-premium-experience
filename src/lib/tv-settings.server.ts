import { ApiError, api, expectedOrigin, identity, json, limitedBody } from "./access.server";
import type { ManagementDB } from "./db-types";
import { changed, database } from "./management.server";
import {
  portableSettings,
  tvBackupFile,
  tvSettingsAction,
  webSettingsAction,
  type TvSettingsAction,
} from "./tv-settings-contract";
import { tvProfile } from "./tv-profile-contract";

const clock = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const active = `SELECT l.client_id AS clientId, l.beta_code_hash AS codeHash,l.device_limit AS deviceLimit
  FROM licenses l JOIN clients u ON u.id=l.client_id JOIN codes c ON c.code_hash=l.beta_code_hash
  WHERE l.status='active' AND u.status='active' AND c.enabled=1 AND l.expires_at>${clock}
  AND (c.expires_at IS NULL OR c.expires_at>${clock})
  AND (c.reseller_id IS NULL OR EXISTS(SELECT 1 FROM resellers r WHERE r.id=c.reseller_id AND r.enabled=1))`;
const enabledInstallation = `FROM show_installations i JOIN codes c ON c.code_hash=i.code_hash
  WHERE c.enabled=1 AND (c.expires_at IS NULL OR c.expires_at>${clock})
  AND (c.reseller_id IS NULL OR EXISTS(SELECT 1 FROM resellers r WHERE r.id=c.reseller_id AND r.enabled=1))`;
type Licence = { clientId: string; codeHash: string };
type Job = {
  id: string;
  operation: "backup" | "restore" | "copy";
  settings: string | null;
  status: string;
  profile: string | null;
  playlist: string | null;
  scope: "settings" | "profile";
  sync_id: string | null;
};
const maxRequest = 360000;
async function readJson(request: Request, limit: number) {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  )
    throw new ApiError(415, "Format de requête invalide.");
  const raw = await limitedBody(request, limit);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)) as unknown;
  } catch {
    throw new ApiError(400, "Requête invalide.");
  }
}

async function readBackup(db: ManagementDB, id: string, userId: string) {
  const row = await db
    .prepare(
      `SELECT b.name,b.settings,b.profile FROM tv_settings_backups b
    JOIN (${active}) a ON a.clientId=b.client_id JOIN clients u ON u.id=a.clientId
    WHERE b.id=? AND u.auth_user_id=?`,
    )
    .bind(id, userId)
    .first<{ name: string; settings: string; profile: string | null }>();
  if (!row) throw new ApiError(404, "Sauvegarde introuvable.");
  const file = tvBackupFile.safeParse({
    format: "vyro-backup",
    version: 1,
    settings: JSON.parse(row.settings),
    ...(row.profile ? { profile: JSON.parse(row.profile) } : {}),
  });
  if (!file.success) throw new ApiError(409, "Sauvegarde illisible.");
  return { row, file: file.data };
}

export const webTvSettings = api(async (request) => {
  const user = await identity(request);
  const db = await database();
  const licence = await db.prepare(`${active} AND u.auth_user_id=?`).bind(user.id).first<Licence>();
  if (!licence)
    throw new ApiError(403, "Un accès Premium actif est nécessaire pour gérer les sauvegardes.");
  if (request.method === "GET") {
    const backupId = new URL(request.url).searchParams.get("backup");
    if (backupId) return json((await readBackup(db, backupId, user.id)).file);
    const [devices, backups, jobs, sync] = await Promise.all([
      db
        .prepare(
          `SELECT d.device_hash AS id,d.name,d.last_seen AS lastSeen,d.protocol,d.kind,
        (d.playlist IS NOT NULL AND d.viewer IS NOT NULL) AS playlistReady,
        EXISTS(SELECT 1 ${enabledInstallation} AND i.device_hash=d.device_hash) AS compatible
        FROM tv_settings_devices d WHERE d.code_hash=? ORDER BY lastSeen DESC,d.device_hash LIMIT 30`,
        )
        .bind(licence.codeHash)
        .all(),
      db
        .prepare(
          `SELECT id,name,source_name AS sourceName,created_at AS createdAt,profile IS NOT NULL AS fullProfile FROM tv_settings_backups
        WHERE client_id=? ORDER BY created_at DESC,id DESC LIMIT 20`,
        )
        .bind(licence.clientId)
        .all(),
      db
        .prepare(
          `SELECT id,operation,CASE WHEN status IN ('waiting_source','waiting_target') AND expires_at<=${clock}
        THEN 'expired' ELSE status END AS status,source_name AS sourceName,target_name AS targetName,name,scope,failure,unchanged,
        created_at AS createdAt,updated_at AS updatedAt FROM tv_settings_jobs WHERE client_id=? AND code_hash=?
        ORDER BY created_at DESC,id DESC LIMIT 30`,
        )
        .bind(licence.clientId, licence.codeHash)
        .all(),
      db
        .prepare(
          `SELECT r.source_id AS sourceId,r.target_id AS targetId,r.next_at AS nextAt,
            (s.playlist IS NOT r.playlist OR d.playlist IS NOT r.playlist OR s.viewer IS NOT r.source_viewer OR d.viewer IS NOT r.target_viewer) AS paused
          FROM tv_settings_sync r
          JOIN tv_settings_devices s ON s.code_hash=r.code_hash AND s.device_hash=r.source_id
          JOIN tv_settings_devices d ON d.code_hash=r.code_hash AND d.device_hash=r.target_id
          WHERE r.client_id=? AND r.code_hash=?`,
        )
        .bind(licence.clientId, licence.codeHash)
        .first(),
    ]);
    return json({
      devices: devices.results.map((d) => ({
        ...d,
        compatible: Boolean(d["compatible"]),
        playlistReady: Boolean(d["playlistReady"]),
      })),
      backups: backups.results,
      jobs: jobs.results,
      sync,
    });
  }

  if (request.headers.get("origin") !== expectedOrigin(request))
    throw new ApiError(403, "Origine refusée.");
  const parsed = webSettingsAction.safeParse(await readJson(request, maxRequest));
  if (!parsed.success) throw new ApiError(400, "Vérifiez le nom et les appareils sélectionnés.");
  const action = parsed.data;
  if (action.action === "import") {
    const result = await db
      .prepare(
        `INSERT INTO tv_settings_backups(id,client_id,name,source_name,settings,profile,created_at)
      SELECT ?,a.clientId,?,'Fichier importé',?,?,${clock} FROM (${active} AND u.auth_user_id=?) a
      WHERE ((SELECT count(*) FROM tv_settings_backups WHERE client_id=a.clientId)
        + (SELECT count(*) FROM tv_settings_jobs WHERE client_id=a.clientId AND operation='backup'
          AND status='waiting_source' AND expires_at>${clock}))<20`,
      )
      .bind(
        crypto.randomUUID(),
        action.name,
        JSON.stringify(action.file.settings),
        action.file.profile ? JSON.stringify(action.file.profile) : null,
        user.id,
      )
      .run();
    if (!changed(result)) throw new ApiError(409, "La limite de 20 sauvegardes est atteinte.");
    return json({ ok: true });
  }
  if (action.action === "edit-groups") {
    const { row, file } = await readBackup(db, action.backupId, user.id);
    if (!file.profile) throw new ApiError(400, "Ce fichier ne contient pas de groupes.");
    const byId = new Map(file.profile.groups.map((group) => [group.id, group]));
    if (
      action.groups.length !== byId.size ||
      new Set(action.groups.map((group) => group.id)).size !== byId.size ||
      action.groups.some((group) => !byId.has(group.id))
    )
      throw new ApiError(409, "La liste des groupes a changé.");
    const updated = tvProfile.safeParse({
      ...file.profile,
      groups: action.groups.map((group) => ({ ...byId.get(group.id), ...group })),
    });
    if (!updated.success) throw new ApiError(400, "Ces groupes sont trop volumineux.");
    const result = await db
      .prepare(
        `UPDATE tv_settings_backups SET profile=? WHERE id=? AND profile=?
      AND client_id IN (SELECT clientId FROM (${active} AND u.auth_user_id=?))`,
      )
      .bind(JSON.stringify(updated.data), action.backupId, row.profile, user.id)
      .run();
    if (!changed(result))
      throw new ApiError(
        409,
        "La sauvegarde a changé. Rechargez-la avant de modifier les groupes.",
      );
    return json({ ok: true });
  }
  if (action.action === "sync-off") {
    await db
      .prepare(
        `DELETE FROM tv_settings_sync WHERE client_id IN
      (SELECT clientId FROM (${active} AND u.auth_user_id=?))`,
      )
      .bind(user.id)
      .run();
    return json({ ok: true });
  }
  if (action.action === "sync-on") {
    if (action.sourceId === action.targetId)
      throw new ApiError(400, "Choisissez deux appareils différents.");
    const result = await db
      .prepare(
        `INSERT INTO tv_settings_sync(id,client_id,code_hash,source_id,target_id,next_at,playlist,source_viewer,target_viewer)
      SELECT ?1,a.clientId,a.codeHash,s.device_hash,d.device_hash,${clock},s.playlist,s.viewer,d.viewer
      FROM (${active} AND u.auth_user_id=?2) a
      JOIN tv_settings_devices s ON s.code_hash=a.codeHash AND s.device_hash=?3
      JOIN tv_settings_devices d ON d.code_hash=a.codeHash AND d.device_hash=?4
      WHERE s.protocol=2 AND d.protocol=2 AND s.playlist IS NOT NULL AND s.playlist=d.playlist
      AND s.viewer IS NOT NULL AND d.viewer IS NOT NULL
      ON CONFLICT(client_id) DO NOTHING`,
      )
      .bind(crypto.randomUUID(), user.id, action.sourceId, action.targetId)
      .run();
    if (!changed(result))
      throw new ApiError(
        409,
        "Ouvrez la même playlist sur les deux TV avec la version à jour, ou désactivez la synchronisation existante.",
      );
    return json({ ok: true });
  }
  if (action.action === "pair") {
    const result = await db
      .prepare(
        `WITH owner AS (${active} AND u.auth_user_id=?)
      INSERT INTO tv_settings_devices(code_hash,device_hash,name,last_seen,kind)
      SELECT o.codeHash,p.device_hash,coalesce(?,p.name),${clock},p.kind FROM owner o CROSS JOIN tv_settings_pairings p
      WHERE p.proof_hash=? AND p.expires_at>${clock}
      AND EXISTS(SELECT 1 ${enabledInstallation} AND i.device_hash=p.device_hash AND i.token_hash=p.token_hash)
      AND NOT EXISTS(SELECT 1 FROM tv_settings_devices d WHERE d.device_hash=p.device_hash)
      AND (SELECT count(*) FROM tv_settings_devices d WHERE d.code_hash=o.codeHash)<o.deviceLimit`,
      )
      .bind(user.id, action.name ?? null, await digest(action.pairingCode))
      .run();
    if (!changed(result))
      throw new ApiError(409, "Code expiré ou déjà utilisé, ou limite d’appareils atteinte.");
    return json({ ok: true });
  }
  if (action.action === "unlink") {
    const result = await db
      .prepare(
        `DELETE FROM tv_settings_devices WHERE device_hash=? AND code_hash IN
      (SELECT codeHash FROM (${active} AND u.auth_user_id=?))`,
      )
      .bind(action.deviceId, user.id)
      .run();
    if (!changed(result)) throw new ApiError(404, "Appareil introuvable.");
    return json({ ok: true });
  }
  if (action.action === "delete") {
    const result = await db
      .prepare(
        `DELETE FROM tv_settings_backups WHERE id=? AND client_id IN
      (SELECT clientId FROM (${active} AND u.auth_user_id=?))`,
      )
      .bind(action.backupId, user.id)
      .run();
    if (!changed(result)) throw new ApiError(404, "Sauvegarde introuvable.");
    return json({ ok: true });
  }
  const source = action.action === "restore" ? null : action.sourceId;
  const target = action.action === "backup" ? null : action.targetId;
  if (source && source === target) throw new ApiError(400, "Choisissez deux appareils différents.");
  const now = new Date();
  const result = await db
    .prepare(
      `
    WITH owner AS (${active} AND u.auth_user_id=?1),
    available AS (
      SELECT d.device_hash AS id,d.name,d.protocol,d.playlist,d.viewer FROM owner o JOIN tv_settings_devices d ON d.code_hash=o.codeHash
      WHERE EXISTS(SELECT 1 ${enabledInstallation} AND i.device_hash=d.device_hash)
    )
    INSERT INTO tv_settings_jobs (id,client_id,code_hash,operation,status,name,source_id,source_name,
      target_id,target_name,settings,created_at,updated_at,expires_at,scope,profile,playlist,source_viewer,target_viewer)
    SELECT ?2,o.clientId,o.codeHash,?3,CASE WHEN ?3='restore' THEN 'waiting_target' ELSE 'waiting_source' END,
      coalesce(?4,snap.name,'Copie TV'),src.id,src.name,dst.id,dst.name,snap.settings,?8,?8,?9,
      CASE WHEN ?11='profile' OR snap.profile IS NOT NULL THEN 'profile' ELSE 'settings' END,
      snap.profile, CASE WHEN snap.profile IS NOT NULL THEN json_extract(snap.profile,'$.playlist') WHEN ?11='profile' THEN src.playlist END,
      src.viewer,dst.viewer
    FROM owner o LEFT JOIN available src ON src.id=?5 LEFT JOIN available dst ON dst.id=?6
    LEFT JOIN tv_settings_backups snap ON snap.id=?7 AND snap.client_id=o.clientId
    WHERE (?5 IS NULL OR src.id IS NOT NULL) AND (?6 IS NULL OR dst.id IS NOT NULL)
    AND (?3<>'restore' OR snap.id IS NOT NULL)
    AND (?11<>'profile' OR (src.protocol=2 AND src.playlist IS NOT NULL AND src.viewer IS NOT NULL
      AND (?3<>'copy' OR (dst.protocol=2 AND dst.viewer IS NOT NULL AND src.playlist=dst.playlist))))
    AND (snap.profile IS NULL OR (dst.protocol=2 AND dst.viewer IS NOT NULL AND dst.playlist=json_extract(snap.profile,'$.playlist')))
    AND NOT EXISTS (SELECT 1 FROM tv_settings_jobs j WHERE j.code_hash=o.codeHash
      AND j.status IN ('waiting_source','waiting_target') AND j.expires_at>?8
      AND (j.source_id IN (?5,?6) OR j.target_id IN (?5,?6)))
    AND (?3<>'backup' OR (
      (SELECT count(*) FROM tv_settings_backups s WHERE s.client_id=o.clientId)
      + (SELECT count(*) FROM tv_settings_jobs j WHERE j.client_id=o.clientId AND j.operation='backup'
        AND j.status='waiting_source' AND j.expires_at>?8))<20)
    AND (SELECT count(*) FROM tv_settings_jobs j WHERE j.client_id=o.clientId AND j.created_at>?10 AND j.sync_id IS NULL)<50
  `,
    )
    .bind(
      user.id,
      crypto.randomUUID(),
      action.action,
      action.action === "backup" ? action.name : null,
      source,
      target,
      action.action === "restore" ? action.backupId : null,
      now.toISOString(),
      new Date(+now + 86_400_000).toISOString(),
      new Date(+now - 86_400_000).toISOString(),
      action.action === "restore" ? "settings" : (action.scope ?? "settings"),
    )
    .run();
  if (!changed(result))
    throw new ApiError(
      409,
      "Impossible de programmer cette opération. Vérifiez les appareils, les opérations en attente et la limite de 20 sauvegardes.",
    );
  return json({ ok: true }, 202);
});

async function digest(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

type TvIdentity = Licence & { deviceHash: string; tokenHash: string };
const jobGuard = `client_id=?2 AND code_hash=?3 AND expires_at>${clock}
  AND EXISTS(SELECT 1 FROM (${active}) a WHERE a.clientId=?2 AND a.codeHash=?3)
  AND EXISTS(SELECT 1 ${enabledInstallation} AND i.device_hash=?4 AND i.token_hash=?5)`;

async function complete(
  db: ManagementDB,
  tv: TvIdentity,
  action: Extract<TvSettingsAction, { action: "complete" }>,
) {
  const phase = action.phase === "capture" ? "waiting_source" : "waiting_target";
  const actorColumn = action.phase === "capture" ? "source_id" : "target_id";
  const args = [action.jobId, tv.clientId, tv.codeHash, tv.deviceHash, tv.tokenHash] as const;
  const guard = `id=?1 AND ${jobGuard} AND ${actorColumn}=?4`;
  const job = await db
    .prepare(
      `SELECT id,operation,status,scope,playlist,profile,sync_id FROM tv_settings_jobs WHERE ${guard}`,
    )
    .bind(...args)
    .first<Job>();
  if (!job) throw new ApiError(404, "Opération indisponible.");
  // Acknowledgements may be retried after a successful write or a lost response.
  if (job.status !== phase) {
    if (
      job.status === "done" ||
      job.status === "failed" ||
      (job.operation === "copy" && phase === "waiting_source" && job.status === "waiting_target")
    ) {
      return json({ ok: true });
    }
    throw new ApiError(409, "Cette étape n’est pas prête.");
  }
  const pending = `${guard} AND status='${phase}'`;
  if (job.scope === "profile" && action.version !== 2)
    throw new ApiError(409, "Mise à jour SHOW+ nécessaire.");
  if (
    action.phase === "capture" &&
    action.ok &&
    ((job.scope === "profile" && action.profile?.playlist !== job.playlist) ||
      (job.scope === "settings" && action.profile))
  )
    throw new ApiError(409, "La playlist a changé.");
  if (!action.ok || action.phase === "apply") {
    const update = db
      .prepare(
        `UPDATE tv_settings_jobs SET status=?6,settings=NULL,profile=NULL,failure=?7,updated_at=${clock}
      WHERE ${pending}`,
      )
      .bind(...args, action.ok ? "done" : "failed", action.failure ?? null);
    if (job.sync_id && action.ok) {
      await db.batch([
        db
          .prepare(
            `UPDATE tv_settings_sync SET fingerprint=(SELECT fingerprint FROM tv_settings_jobs WHERE ${pending})
          WHERE id=?6 AND EXISTS(SELECT 1 FROM tv_settings_jobs WHERE ${pending})`,
          )
          .bind(...args, job.sync_id),
        update,
      ]);
    } else await update.run();
  } else if (job.operation === "copy") {
    const prefs = JSON.stringify(action.settings);
    const profile = action.profile ? JSON.stringify(action.profile) : null;
    const fingerprint = job.sync_id ? await digest(prefs + ":" + profile) : null;
    const same = `sync_id IS NOT NULL AND EXISTS(SELECT 1 FROM tv_settings_sync s
      WHERE s.id=tv_settings_jobs.sync_id AND s.fingerprint=?8)`;
    await db
      .prepare(
        `UPDATE tv_settings_jobs SET status=CASE WHEN ${same} THEN 'done' ELSE 'waiting_target' END,
        settings=CASE WHEN ${same} THEN NULL ELSE ?6 END,profile=CASE WHEN ${same} THEN NULL ELSE ?7 END,
        fingerprint=?8,unchanged=CASE WHEN ${same} THEN 1 ELSE 0 END,updated_at=${clock}
      WHERE ${pending}`,
      )
      .bind(...args, prefs, profile, fingerprint)
      .run();
  } else {
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO tv_settings_backups (id,client_id,name,source_name,settings,created_at,profile)
        SELECT id,client_id,name,source_name,?6,${clock},?7 FROM tv_settings_jobs WHERE ${pending}`,
        )
        .bind(
          ...args,
          JSON.stringify(action.settings),
          action.profile ? JSON.stringify(action.profile) : null,
        ),
      db
        .prepare(
          `UPDATE tv_settings_jobs SET status='done',updated_at=${clock} WHERE ${pending}
        AND EXISTS(SELECT 1 FROM tv_settings_backups b WHERE b.id=?1 AND b.client_id=?2)`,
        )
        .bind(...args),
    ]);
  }
  return json({ ok: true });
}

async function scheduleSync(db: ManagementDB, tv: TvIdentity, playlist: string, viewer: string) {
  const rule = await db
    .prepare(
      `SELECT id FROM tv_settings_sync WHERE client_id=? AND code_hash=?
    AND source_id=? AND playlist=? AND source_viewer=? AND next_at<=${clock}`,
    )
    .bind(tv.clientId, tv.codeHash, tv.deviceHash, playlist, viewer)
    .first<{ id: string }>();
  if (!rule) return;
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO tv_settings_jobs (id,client_id,code_hash,operation,status,name,source_id,source_name,
      target_id,target_name,created_at,updated_at,expires_at,scope,playlist,sync_id,source_viewer,target_viewer)
      SELECT ?1,r.client_id,r.code_hash,'copy','waiting_source','Synchronisation automatique',s.device_hash,s.name,
        d.device_hash,d.name,${clock},${clock},strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day'),'profile',?3,r.id,r.source_viewer,r.target_viewer
      FROM tv_settings_sync r JOIN tv_settings_devices s ON s.code_hash=r.code_hash AND s.device_hash=r.source_id
      JOIN tv_settings_devices d ON d.code_hash=r.code_hash AND d.device_hash=r.target_id
      WHERE r.id=?2 AND r.next_at<=${clock} AND r.playlist=?3 AND s.playlist=?3 AND d.playlist=?3 AND d.protocol=2
      AND s.viewer=r.source_viewer AND d.viewer=r.target_viewer
      AND EXISTS(SELECT 1 FROM (${active}) a WHERE a.clientId=r.client_id AND a.codeHash=r.code_hash)
      AND EXISTS(SELECT 1 ${enabledInstallation} AND i.device_hash=d.device_hash)
      AND NOT EXISTS(SELECT 1 FROM tv_settings_jobs j WHERE j.code_hash=r.code_hash AND j.expires_at>${clock}
        AND j.status IN ('waiting_source','waiting_target')
        AND (j.source_id IN (r.source_id,r.target_id) OR j.target_id IN (r.source_id,r.target_id)))`,
      )
      .bind(id, rule.id, playlist),
    db
      .prepare(
        `UPDATE tv_settings_sync SET next_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','+15 minutes')
      WHERE id=? AND EXISTS(SELECT 1 FROM tv_settings_jobs WHERE id=?)`,
      )
      .bind(rule.id, id),
  ]);
}

export const nativeTvSettings = api(async (request) => {
  // This endpoint accepts only the native TV's existing licence+device proof, never a browser session.
  if (request.headers.has("origin"))
    throw new ApiError(403, "Requête réservée à l’application TV.");
  const parsed = tvSettingsAction.safeParse(await readJson(request, maxRequest));
  if (!parsed.success) throw new ApiError(400, "Requête TV incompatible.");
  const action = parsed.data;
  const db = await database();
  const [tokenHash, deviceHash] = await Promise.all([
    digest(action.token),
    digest(action.deviceId),
  ]);
  const install = await db
    .prepare(`SELECT i.device_hash ${enabledInstallation} AND i.device_hash=? AND i.token_hash=?`)
    .bind(deviceHash, tokenHash)
    .first();
  if (!install) throw new ApiError(403, "Installation SHOW+ non reconnue.");
  if (action.action === "pair") {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
      b.toString(16).padStart(2, "0"),
    )
      .join("")
      .toUpperCase();
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const result = await db
      .prepare(
        `INSERT INTO tv_settings_pairings(device_hash,proof_hash,token_hash,name,expires_at,kind)
      SELECT i.device_hash,?,?,?,?,? ${enabledInstallation} AND i.device_hash=? AND i.token_hash=?
      AND NOT EXISTS(SELECT 1 FROM tv_settings_devices d WHERE d.device_hash=i.device_hash)
      ON CONFLICT(device_hash) DO UPDATE SET proof_hash=excluded.proof_hash,token_hash=excluded.token_hash,
        name=excluded.name,expires_at=excluded.expires_at,kind=excluded.kind`,
      )
      .bind(
        await digest(code),
        tokenHash,
        action.name,
        expiresAt,
        action.kind ?? "unknown",
        deviceHash,
        tokenHash,
      )
      .run();
    if (!changed(result))
      throw new ApiError(
        409,
        "Cet appareil est déjà associé. Dissociez-le dans l’espace client avant de changer de compte.",
      );
    return json({ pairingCode: code.match(/.{4}/g)?.join("-"), expiresAt });
  }
  const linked = await db
    .prepare(
      `${active} AND EXISTS(SELECT 1 FROM tv_settings_devices d
    WHERE d.code_hash=l.beta_code_hash AND d.device_hash=?)`,
    )
    .bind(deviceHash)
    .first<Licence>();
  if (!linked) {
    if (action.action === "poll") return json({ linked: false, command: null });
    throw new ApiError(403, "Cet appareil n’est pas lié à un accès TV actif.");
  }
  const tv = { ...linked, deviceHash, tokenHash };
  if (action.action === "complete") return complete(db, tv, action);
  await db
    .prepare(
      `UPDATE tv_settings_devices SET last_seen=${clock},protocol=?1,playlist=?2,viewer=?6,kind=coalesce(?7,kind)
    WHERE code_hash=?3 AND device_hash=?4 AND (last_seen<?5 OR protocol<>?1 OR playlist IS NOT ?2 OR viewer IS NOT ?6
      OR (?7 IS NOT NULL AND kind<>?7))`,
    )
    .bind(
      action.version,
      action.version === 2 ? (action.playlist ?? null) : null,
      tv.codeHash,
      tv.deviceHash,
      new Date(Date.now() - 120_000).toISOString(),
      action.version === 2 ? (action.viewer ?? null) : null,
      action.kind ?? null,
    )
    .run();
  if (action.version === 2 && action.playlist && action.viewer)
    await scheduleSync(db, tv, action.playlist, action.viewer);
  const job = await db
    .prepare(
      `SELECT id,operation,status,settings,scope,profile,playlist FROM tv_settings_jobs
    WHERE ?1=1 AND ${jobGuard} AND ((status='waiting_source' AND source_id=?4) OR (status='waiting_target' AND target_id=?4))
    AND (scope='settings' OR (playlist=?6 AND CASE WHEN status='waiting_source' THEN source_viewer ELSE target_viewer END=?7))
    ORDER BY created_at,id LIMIT 1`,
    )
    .bind(
      1,
      tv.clientId,
      tv.codeHash,
      tv.deviceHash,
      tv.tokenHash,
      action.version === 2 ? (action.playlist ?? null) : null,
      action.version === 2 ? (action.viewer ?? null) : null,
    )
    .first<Job>();
  if (!job) return json({ linked: true, command: null });
  const scope =
    job.scope === "profile"
      ? { scope: job.scope, playlist: job.playlist, viewer: action.viewer }
      : {};
  if (job.status === "waiting_source")
    return json({ linked: true, command: { id: job.id, phase: "capture", ...scope } });
  const snapshot = portableSettings.safeParse(job.settings ? JSON.parse(job.settings) : null);
  if (!snapshot.success) throw new ApiError(409, "Sauvegarde incompatible avec cette version.");
  const profile = job.profile ? tvProfile.safeParse(JSON.parse(job.profile)) : null;
  if ((profile && !profile.success) || (job.scope === "profile" && !profile))
    throw new ApiError(409, "Sauvegarde de profil incompatible.");
  return json({
    linked: true,
    command: {
      id: job.id,
      phase: "apply",
      settings: snapshot.data,
      ...scope,
      ...(profile?.success ? { profile: profile.data } : {}),
    },
  });
});
