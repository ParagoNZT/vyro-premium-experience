import { ApiError, api, identity, json } from "./access.server";
import { database } from "./management.server";

const releases = {
  androidtv: "vyro-premium-androidtv.apk",
  firetv: "vyro-premium-firetv.apk",
} as const;

type ObjectMetadata = { size: number };
type ReleaseBucket = {
  head(key: string): Promise<ObjectMetadata | null>;
  get(key: string): Promise<(ObjectMetadata & { body: ReadableStream<Uint8Array> }) | null>;
};

function available(object: ObjectMetadata | null): boolean {
  return Boolean(object && object.size > 0 && object.size <= 250 * 1024 * 1024);
}

export const downloadRequest = api(async (request) => {
  const user = await identity(request);
  const db = await database();
  const hasAccess = await db
    .prepare(
      `SELECT 1 FROM clients c
      JOIN licenses l ON l.client_id = c.id
      JOIN codes b ON b.code_hash = l.beta_code_hash
     WHERE c.auth_user_id = ? AND c.status = 'active'
       AND l.status = 'active' AND l.expires_at > ? AND b.enabled = 1 LIMIT 1`,
    )
    .bind(user.id, new Date().toISOString())
    .first();
  if (!hasAccess)
    throw new ApiError(403, "Une licence active est nécessaire pour télécharger VYRO.");

  let bucket: ReleaseBucket | undefined;
  try {
    bucket = (await import("cloudflare:workers")).env["VYRO_RELEASES"] as ReleaseBucket | undefined;
  } catch {
    /* Development preview without R2. */
  }
  const platform = new URL(request.url).searchParams.get("platform");
  if (platform !== null && platform !== "androidtv" && platform !== "firetv") {
    throw new ApiError(400, "Plateforme inconnue.");
  }
  if (!platform) {
    const published = bucket
      ? await Promise.all(
          Object.entries(releases).map(async ([id, key]) =>
            available(await bucket!.head(key)) ? id : null,
          ),
        )
      : [];
    return json({ platforms: published.filter(Boolean) });
  }
  if (!bucket) throw new ApiError(404, "Ce fichier d’installation n’est pas publié.");
  const key = releases[platform];
  const object = await bucket.get(key);
  if (!object) throw new ApiError(404, "Ce fichier d’installation n’est pas publié.");
  if (!available(object)) {
    await object.body.cancel().catch(() => undefined);
    throw new ApiError(404, "Ce fichier d’installation n’est pas publié.");
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(object.size),
      "Content-Disposition": 'attachment; filename="' + key + '"',
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
