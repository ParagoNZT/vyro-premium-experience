import { z } from "zod";
import { api, ApiError, body, identity, json, limitedBody } from "./access.server";
import { database } from "./management.server";
import {
  releaseBase,
  VYRO_LATEST_URL,
  VYRO_UPDATE_REPOSITORY,
  type VyroConsole,
  type VyroAnnouncement,
} from "./vyro-app-contract";
import type { ManagementDB } from "./db-types";

const publishedContract = releaseBase.extend({
  sha256: z
    .string()
    .regex(/^(?:[a-fA-F0-9]{64})?$/)
    .default(""),
});
const changes = z.discriminatedUnion("action", [
  releaseBase.extend({ action: z.literal("release"), confirmed: z.literal(true) }),
  z.object({ action: z.literal("withdraw"), versionCode: z.number().int().positive() }),
  z.object({
    action: z.literal("announce"),
    title: z.string().trim().min(3).max(100),
    body: z.string().trim().min(3).max(1000),
    days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    confirmed: z.literal(true),
  }),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() }),
]);

async function githubFile(url: string, max: number, accept = "application/json") {
  // Workers support manual redirect handling. Read only the exact repository host.
  const result = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(4500),
    headers: { Accept: accept, "Cache-Control": "no-cache", "User-Agent": "VYRO Release Console" },
  });
  if (!result.ok) return null;
  return new TextDecoder("utf-8", { fatal: true }).decode(await limitedBody(result, max));
}

async function readPublished() {
  const endpoints = [
    [VYRO_LATEST_URL, "application/json"],
    [
      `https://api.github.com/repos/${VYRO_UPDATE_REPOSITORY}/contents/latest.json?ref=main`,
      "application/vnd.github.raw+json",
    ],
  ] as const;
  for (const [url, accept] of endpoints) {
    try {
      const raw = await githubFile(url, 4096, accept);
      if (raw === null) continue;
      const parsed = publishedContract.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      /* The API is a second read path for the same public file. */
    }
  }
  return null;
}

async function signingReferenceAvailable() {
  try {
    const result = await githubFile(
      `https://raw.githubusercontent.com/${VYRO_UPDATE_REPOSITORY}/main/trusted-signer.sha256`,
      256,
      "text/plain",
    );
    return result !== null && /^[a-f0-9]{64}$/.test(result.trim());
  } catch {
    return false;
  }
}

const queueSql = `SELECT version_code AS versionCode,version_name AS versionName,apk_url AS apkUrl,sha256,
  changelog,created_at AS createdAt FROM vyro_release_queue WHERE slot=1 AND withdrawn_at IS NULL`;

export async function getVyroReleaseQueue(db: ManagementDB) {
  const queued = await db.prepare(queueSql).bind().first<NonNullable<VyroConsole["queued"]>>();
  if (!queued) return { release: null };
  return { release: releaseBase.parse(queued) };
}

export const vyroReleaseQueueRequest = api(async () =>
  json(await getVyroReleaseQueue(await database())),
);

export const vyroAnnouncementsRequest = api(async () => {
  const db = await database();
  const { results } = await db
    .prepare(
      `SELECT id,title,body,created_at AS createdAt,expires_at AS expiresAt
    FROM vyro_announcements WHERE revoked_at IS NULL AND expires_at>?
    ORDER BY created_at DESC,id LIMIT 20`,
    )
    .bind(new Date().toISOString())
    .all<VyroAnnouncement>();
  return json({ announcements: results });
});

export const vyroConsoleRequest = api(async (request) => {
  const user = await identity(request, true);
  const db = await database();
  const now = new Date().toISOString();
  if (request.method === "GET") {
    const [published, publicationReady, queued, announcements] = await Promise.all([
      readPublished(),
      signingReferenceAvailable(),
      db.prepare(queueSql).bind().first<NonNullable<VyroConsole["queued"]>>(),
      db
        .prepare(
          `SELECT id,title,body,created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt
        FROM vyro_announcements ORDER BY created_at DESC,id LIMIT 50`,
        )
        .bind()
        .all<VyroConsole["announcements"][number]>(),
    ]);
    return json({ published, publicationReady, queued, announcements: announcements.results });
  }
  const parsed = changes.safeParse(await body(request));
  if (!parsed.success) throw new ApiError(400, "Vérifiez les champs et la confirmation.");
  const data = parsed.data;
  if (data.action === "release") {
    const [current, ready] = await Promise.all([readPublished(), signingReferenceAvailable()]);
    if (!ready)
      throw new ApiError(
        503,
        "Le certificat officiel de VYRO doit être configuré avant la diffusion.",
      );
    if (!current) throw new ApiError(503, "Le canal de mise à jour ne répond pas. Réessayez.");
    if (data.versionCode <= current.versionCode)
      throw new ApiError(409, "Le numéro de build doit dépasser la version diffusée.");
    await db
      .prepare(
        `INSERT INTO vyro_release_queue
      (slot,version_code,version_name,apk_url,sha256,changelog,actor_id,created_at)
      VALUES (1,?,?,?,?,?,?,?) ON CONFLICT(slot) DO UPDATE SET version_code=excluded.version_code,
      version_name=excluded.version_name,apk_url=excluded.apk_url,sha256=excluded.sha256,changelog=excluded.changelog,
      actor_id=excluded.actor_id,created_at=excluded.created_at,withdrawn_at=NULL`,
      )
      .bind(
        data.versionCode,
        data.versionName,
        data.apkUrl,
        data.sha256,
        data.changelog,
        user.id,
        now,
      )
      .run();
    return json({ ok: true }, 202);
  }
  if (data.action === "withdraw") {
    const current = await readPublished();
    if (!current || current.versionCode >= data.versionCode)
      throw new ApiError(409, "Cette version a déjà été diffusée ou le canal ne répond pas.");
    const result = await db
      .prepare(
        "UPDATE vyro_release_queue SET withdrawn_at=? WHERE slot=1 AND version_code=? AND withdrawn_at IS NULL",
      )
      .bind(now, data.versionCode)
      .run();
    if (!result.meta.changes) throw new ApiError(409, "La demande de publication a changé.");
    return json({ ok: true });
  }
  if (data.action === "announce") {
    await db
      .prepare(
        `INSERT INTO vyro_announcements(id,title,body,actor_id,created_at,expires_at)
      VALUES (?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        data.title,
        data.body,
        user.id,
        now,
        new Date(Date.now() + data.days * 86400000).toISOString(),
      )
      .run();
    return json({ ok: true }, 201);
  }
  const result = await db
    .prepare("UPDATE vyro_announcements SET revoked_at=? WHERE id=? AND revoked_at IS NULL")
    .bind(now, data.id)
    .run();
  if (!result.meta.changes) throw new ApiError(404, "Annonce déjà retirée ou introuvable.");
  return json({ ok: true });
});
