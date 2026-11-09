import { z } from "zod";
import { api, ApiError, expectedOrigin, identity, json, limitedBody } from "./access.server";
import { database, changed } from "./management.server";
import {
  qrProof,
  remoteCatalog,
  remoteNative,
  remoteWeb,
  type RemoteDevice,
} from "./remote-contract";
import { tvBackupFile } from "./tv-settings-contract";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const digest = async (value: string) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const after = (ms: number) => new Date(Date.now() + ms).toISOString();
const validId = z.string().uuid();

async function input(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")
    throw new ApiError(415, "Format de requête invalide.");
  const raw = await limitedBody(request, 400_000);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)) as unknown;
  } catch {
    throw new ApiError(400, "Requête invalide.");
  }
}
type Device = RemoteDevice & { owner_id: string | null; catalogRaw: string | null };
type Job = {
  id: string;
  kind: string;
  context: string | null;
  payload: string | null;
  name: string;
};
const deviceColumns =
  "id,edition,kind,name,public_key AS publicKey,last_seen AS lastSeen,catalog AS catalogRaw,owner_id";
const catalogOf = (row: Device) =>
  row.catalogRaw ? remoteCatalog.parse(JSON.parse(row.catalogRaw)) : null;

export const webRemoteWorkspace = api(async (request) => {
  const user = await identity(request);
  const owner = user.id;
  const db = await database();
  const now = after(0);
  if (request.method === "GET") {
    const backup = new URL(request.url).searchParams.get("backup");
    if (backup) {
      if (!validId.safeParse(backup).success) throw new ApiError(404, "Sauvegarde introuvable.");
      const row = await db
        .prepare("SELECT file FROM remote_backups WHERE id=? AND owner_id=?")
        .bind(backup, owner)
        .first<{ file: string }>();
      if (!row) throw new ApiError(404, "Sauvegarde introuvable.");
      return json(tvBackupFile.parse(JSON.parse(row.file)));
    }
    const [devices, backups, jobs] = await Promise.all([
      db
        .prepare(
          `SELECT ${deviceColumns} FROM remote_devices WHERE owner_id=? ORDER BY paired_at DESC LIMIT 10`,
        )
        .bind(owner)
        .all<Device>(),
      db
        .prepare(
          `SELECT id,name,source_name AS source,created_at AS date,json_type(file,'$.profile') IS NOT NULL AS full
        FROM remote_backups WHERE owner_id=? ORDER BY created_at DESC,id LIMIT 30`,
        )
        .bind(owner)
        .all(),
      db
        .prepare(
          `SELECT j.id,j.name,d.name AS device,coalesce(j.result,CASE WHEN j.expires_at<=? THEN 'expired'
          WHEN j.sent_at IS NOT NULL THEN 'sent' ELSE 'waiting' END) AS status,j.created_at AS date
        FROM remote_jobs j JOIN remote_devices d ON d.id=j.device_id WHERE j.owner_id=? AND d.owner_id=j.owner_id
        ORDER BY j.created_at DESC,j.id LIMIT 25`,
        )
        .bind(now, owner)
        .all(),
    ]);
    return json({
      devices: devices.results.map(
        ({ id, name, edition, kind, lastSeen, publicKey, catalogRaw }) => ({
          id,
          name,
          edition,
          kind,
          lastSeen,
          publicKey,
          catalog: catalogRaw ? JSON.parse(catalogRaw) : null,
        }),
      ),
      backups: backups.results,
      jobs: jobs.results,
    });
  }
  if (request.headers.get("origin") !== expectedOrigin(request))
    throw new ApiError(403, "Origine refusée.");
  const parsed = remoteWeb.safeParse(await input(request));
  if (!parsed.success) throw new ApiError(400, "Vérifiez les réglages et les champs saisis.");
  const action = parsed.data;
  if (action.action === "preview" || action.action === "claim") {
    const proof = await digest(action.proof);
    if (action.action === "preview") {
      const row = await db
        .prepare(
          "SELECT name,kind,edition FROM remote_devices WHERE proof_hash=? AND proof_until>? AND owner_id IS NULL",
        )
        .bind(proof, now)
        .first();
      if (!row)
        throw new ApiError(
          404,
          "Ce QR code n’est plus valide. Générez-en un nouveau dans l’application.",
        );
      return json(row);
    }
    const result = await db
      .prepare(
        `UPDATE remote_devices SET owner_id=?1,paired_at=?2,last_seen=?2,proof_hash=NULL,proof_until=NULL
      WHERE proof_hash=?3 AND proof_until>?2 AND owner_id IS NULL
      AND (SELECT count(*) FROM remote_devices WHERE owner_id=?1)<10`,
      )
      .bind(owner, now, proof)
      .run();
    if (!changed(result))
      throw new ApiError(409, "QR code expiré, déjà utilisé, ou limite de 10 appareils atteinte.");
    return json({ ok: true });
  }
  if (action.action === "delete") {
    if (
      !changed(
        await db
          .prepare("DELETE FROM remote_backups WHERE id=? AND owner_id=?")
          .bind(action.backup, owner)
          .run(),
      )
    )
      throw new ApiError(404, "Sauvegarde introuvable.");
    return json({ ok: true });
  }
  if (action.action === "import") {
    const result = await db
      .prepare(
        `INSERT INTO remote_backups(id,owner_id,name,source_name,file,created_at)
      SELECT ?1,?2,?3,'Fichier importé',?4,?5 WHERE (SELECT count(*) FROM remote_backups WHERE owner_id=?2)<30`,
      )
      .bind(crypto.randomUUID(), owner, action.name, JSON.stringify(action.file), now)
      .run();
    if (!changed(result)) throw new ApiError(409, "La limite de 30 sauvegardes est atteinte.");
    return json({ ok: true });
  }
  if (action.action === "cancel") {
    const result = await db
      .prepare(
        `UPDATE remote_jobs SET result='cancelled',payload=NULL,finished_at=?
      WHERE id=? AND owner_id=? AND result IS NULL AND sent_at IS NULL`,
      )
      .bind(now, action.job, owner)
      .run();
    if (!changed(result)) throw new ApiError(409, "La commande a déjà été transmise ou terminée.");
    return json({ ok: true });
  }
  if (action.action === "unlink") {
    if (
      !changed(
        await db
          .prepare("DELETE FROM remote_devices WHERE id=? AND owner_id=?")
          .bind(action.device, owner)
          .run(),
      )
    )
      throw new ApiError(404, "Appareil introuvable.");
    return json({ ok: true });
  }
  const device = await db
    .prepare(`SELECT ${deviceColumns} FROM remote_devices WHERE id=? AND owner_id=?`)
    .bind(action.device, owner)
    .first<Device>();
  if (!device) throw new ApiError(404, "Appareil introuvable.");
  const catalog = catalogOf(device);
  if (!catalog) throw new ApiError(409, "Ouvrez l’application et sélectionnez le profil associé.");
  let name: string;
  let payload: unknown;
  let context: string | null = null;
  if (action.action === "backup") {
    if (action.full && !catalog.active)
      throw new ApiError(409, "Ouvrez d’abord une playlist sur l’appareil.");
    payload = { playlist: action.full ? catalog.active : null };
    name = action.name;
  } else if (action.action === "restore") {
    const row = await db
      .prepare("SELECT name,file FROM remote_backups WHERE id=? AND owner_id=?")
      .bind(action.backup, owner)
      .first<{ name: string; file: string }>();
    if (!row) throw new ApiError(404, "Sauvegarde introuvable.");
    const file = tvBackupFile.parse(JSON.parse(row.file));
    if (file.profile && file.profile.playlist !== catalog.active)
      throw new ApiError(409, "Ouvrez la même playlist sur l’appareil de destination.");
    // Resolve the snapshot only on delivery so queued commands do not retain a
    // second copy of viewing history, and deleting an unsent snapshot revokes it.
    payload = { backup: action.backup };
    name = "Restaurer : " + row.name;
  } else {
    if (action.context !== catalog.context)
      throw new ApiError(409, "Les playlists ont changé. Actualisez le panneau.");
    context = catalog.context;
    if (action.action === "layout") {
      if (action.playlist !== catalog.active || !catalog.layout || !catalog.layoutComplete)
        throw new ApiError(
          409,
          "La configuration de cette playlist n’est pas disponible à distance.",
        );
      const categories = new Set(catalog.categories.map((i) => i.id));
      const knownChannels = new Set([
        ...catalog.channels.map((i) => i.id),
        ...catalog.layout.groups.flatMap((g) => g.channels),
      ]);
      if (
        action.layout.visible?.some((i) => !categories.has(i)) ||
        new Set(action.layout.groups.map((g) => g.id)).size !== action.layout.groups.length ||
        action.layout.groups.some(
          (g) =>
            new Set(g.channels).size !== g.channels.length ||
            g.channels.some((i) => !knownChannels.has(i)),
        )
      )
        throw new ApiError(400, "Certaines catégories ou chaînes ne sont plus disponibles.");
      payload = { playlist: action.playlist, layout: action.layout };
      name = "Catégories et groupes TV";
    } else {
      const target = catalog.playlists.find((p) => p.id === action.playlist);
      if (
        device.edition !== "vyro" ||
        (action.playlist !== null && !target?.editable) ||
        (action.sealed && target?.kind === "xc") ||
        (!target && !action.sealed)
      )
        throw new ApiError(400, "Cette source ne peut pas être modifiée à distance.");
      payload = { playlist: action.playlist, name: action.name, sealed: action.sealed };
      name = (target ? "Modifier : " : "Ajouter : ") + action.name;
    }
  }
  const result = await db
    .prepare(
      `INSERT INTO remote_jobs(id,owner_id,device_id,kind,payload,context,name,created_at,expires_at)
    SELECT ?1,?2,d.id,?4,?5,?6,?7,?8,?9 FROM remote_devices d
    WHERE d.id=?3 AND d.owner_id=?2 AND (?6 IS NULL OR json_extract(d.catalog,'$.context')=?6)
    AND NOT EXISTS(SELECT 1 FROM remote_jobs j WHERE j.device_id=d.id AND j.result IS NULL AND j.expires_at>?8)
    AND (?4<>'backup' OR (SELECT count(*) FROM remote_backups WHERE owner_id=?2)<30)`,
    )
    .bind(
      crypto.randomUUID(),
      owner,
      device.id,
      action.action,
      JSON.stringify(payload),
      context,
      name,
      now,
      after(30 * 60_000),
    )
    .run();
  if (!changed(result))
    throw new ApiError(
      409,
      "Une commande est déjà en attente, la configuration a changé ou la limite de sauvegardes est atteinte.",
    );
  return json({ ok: true }, 202);
});

export const nativeRemoteWorkspace = api(async (request) => {
  if (request.headers.has("origin")) throw new ApiError(403, "Requête réservée à l’application.");
  const parsed = remoteNative.safeParse(await input(request));
  if (!parsed.success) throw new ApiError(400, "Version de l’application incompatible.");
  const action = parsed.data;
  const token = await digest(action.token);
  const db = await database();
  const now = after(0);
  if (action.action === "pair") {
    const ip = request.headers.get("cf-connecting-ip") ?? "local";
    const bucket = await digest("pair:" + now.slice(0, 13) + ":" + ip);
    const allowance = await db
      .prepare(
        `INSERT INTO remote_pair_budget(bucket,total,expires_at) VALUES(?,1,?)
      ON CONFLICT(bucket) DO UPDATE SET total=total+1 WHERE total<40`,
      )
      .bind(bucket, after(3_600_000))
      .run();
    if (!changed(allowance))
      throw new ApiError(429, "Patientez avant de demander un nouveau code.");
    try {
      const key = await crypto.subtle.importKey(
        "spki",
        Uint8Array.from(atob(action.publicKey), (c) => c.charCodeAt(0)),
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"],
      );
      if ((key.algorithm as RsaHashedKeyAlgorithm).modulusLength !== 2048) throw new Error();
    } catch {
      throw new ApiError(400, "Clé de l’appareil invalide.");
    }
    const proof = qrProof.parse(hex(crypto.getRandomValues(new Uint8Array(16))).toUpperCase());
    const expires = after(300_000);
    const [result] = await db.batch([
      db
        .prepare(
          `INSERT INTO remote_devices(id,token_hash,edition,kind,name,public_key,proof_hash,proof_until)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(id) DO UPDATE SET proof_hash=?7,proof_until=?8,name=?5
        WHERE owner_id IS NULL AND token_hash=?2 AND public_key=?6 AND edition=?3 AND kind=?4`,
        )
        .bind(
          action.id,
          token,
          action.edition,
          action.kind,
          action.name,
          action.publicKey,
          await digest(proof),
          expires,
        ),
      db
        .prepare(
          `DELETE FROM remote_devices WHERE owner_id IS NULL AND id IN
        (SELECT id FROM remote_devices WHERE owner_id IS NULL AND proof_until<? LIMIT 100)`,
        )
        .bind(now),
      db
        .prepare(
          `DELETE FROM remote_pair_budget WHERE bucket IN (SELECT bucket FROM remote_pair_budget WHERE expires_at<? LIMIT 100)`,
        )
        .bind(now),
    ]);
    if (!result || !changed(result)) throw new ApiError(409, "Cet appareil est déjà associé.");
    return json({ proof, expires });
  }
  const device = await db
    .prepare(`SELECT ${deviceColumns} FROM remote_devices WHERE id=? AND token_hash=?`)
    .bind(action.id, token)
    .first<Device>();
  if (!device?.owner_id) return json({ linked: false });
  const owner = device.owner_id;
  if (action.action === "poll") {
    const raw = action.catalog ? JSON.stringify(action.catalog) : null;
    await db.batch([
      db
        .prepare(
          `UPDATE remote_devices SET catalog=?1,last_seen=?2 WHERE id=?3 AND owner_id=?4 AND token_hash=?5
        AND (catalog IS NOT ?1 OR last_seen<?6)`,
        )
        .bind(raw, now, device.id, owner, token, after(-120_000)),
      db
        .prepare(
          `UPDATE remote_jobs SET payload=NULL WHERE device_id=? AND owner_id=? AND expires_at<=? AND payload IS NOT NULL`,
        )
        .bind(device.id, owner, now),
    ]);
    if (!raw) return json({ linked: true, job: null });
    const job = await db
      .prepare(
        `UPDATE remote_jobs SET sent_at=coalesce(sent_at,?1) WHERE id=(
      SELECT j.id FROM remote_jobs j JOIN remote_devices d ON d.id=j.device_id AND d.owner_id=j.owner_id
      WHERE j.device_id=?2 AND j.owner_id=?3 AND d.token_hash=?4 AND j.result IS NULL AND j.expires_at>?1
      ORDER BY j.created_at,j.id LIMIT 1)
      RETURNING id,kind,context,payload,name`,
      )
      .bind(now, device.id, owner, token)
      .first<Job>();
    if (!job) return json({ linked: true, job: null });
    let payload: unknown = job.payload ? JSON.parse(job.payload) : null;
    if (job.kind === "restore") {
      const reference = z.object({ backup: validId }).parse(payload);
      const saved = await db
        .prepare("SELECT file FROM remote_backups WHERE id=? AND owner_id=?")
        .bind(reference.backup, owner)
        .first<{ file: string }>();
      if (!saved) {
        await db
          .prepare(
            `UPDATE remote_jobs SET result='cancelled',payload=NULL,finished_at=?
          WHERE id=? AND owner_id=? AND result IS NULL`,
          )
          .bind(now, job.id, owner)
          .run();
        return json({ linked: true, job: null });
      }
      payload = tvBackupFile.parse(JSON.parse(saved.file));
    }
    return json({ linked: true, job: { ...job, payload } });
  }
  const job = await db
    .prepare(
      `SELECT id,kind,context,payload,name FROM remote_jobs
    WHERE id=? AND device_id=? AND owner_id=? AND result IS NULL AND sent_at IS NOT NULL AND expires_at>?`,
    )
    .bind(action.jobId, device.id, owner, now)
    .first<Job>();
  if (!job) return json({ ok: true });
  const commands = [];
  const ok = action.ok;
  if (ok && job.kind === "backup") {
    const target = JSON.parse(job.payload ?? "{}") as { playlist?: string | null };
    if (!action.settings || (target.playlist ?? null) !== (action.profile?.playlist ?? null))
      throw new ApiError(400, "La sauvegarde ne correspond pas à la playlist demandée.");
    const file = tvBackupFile.parse({
      format: "vyro-backup",
      version: 1,
      settings: action.settings,
      ...(action.profile ? { profile: action.profile } : {}),
    });
    commands.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO remote_backups(id,owner_id,name,source_name,file,created_at)
      SELECT j.id,j.owner_id,j.name,d.name,?1,?2 FROM remote_jobs j JOIN remote_devices d ON d.id=j.device_id AND d.owner_id=j.owner_id
      WHERE j.id=?3 AND j.device_id=?4 AND j.owner_id=?5 AND d.token_hash=?6 AND j.result IS NULL AND j.expires_at>?2
      AND (SELECT count(*) FROM remote_backups WHERE owner_id=?5)<30`,
        )
        .bind(JSON.stringify(file), now, job.id, device.id, owner, token),
    );
  }
  commands.push(
    db
      .prepare(
        `UPDATE remote_jobs SET result=CASE WHEN ?1=0 OR (kind='backup' AND NOT EXISTS(
    SELECT 1 FROM remote_backups WHERE id=remote_jobs.id AND owner_id=?5)) THEN 'failed' ELSE 'done' END,
    payload=NULL,finished_at=?2 WHERE id=?3 AND device_id=?4 AND owner_id=?5 AND result IS NULL AND expires_at>?2
    AND EXISTS(SELECT 1 FROM remote_devices WHERE id=?4 AND owner_id=?5 AND token_hash=?6)`,
      )
      .bind(ok ? 1 : 0, now, job.id, device.id, owner, token),
  );
  await db.batch(commands);
  return json({ ok: true });
});
