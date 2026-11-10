import { z } from "zod";
import { ApiError, api, identity, json, limitedBody } from "./access.server";
import { database } from "./database.server";

const input = z
  .object({
    action: z.enum(["activate", "check"]),
    deviceId: z.string().regex(/^[a-f0-9]{64}$/),
    name: z.string().trim().min(1).max(80),
    android: z.string().trim().max(24),
    version: z.string().trim().max(32),
  })
  .strict();

// Match the hash used by key activation so a device already activated with a key
// does not consume a second seat. The licence always comes from the verified account.
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

const eligible = `FROM licenses l JOIN clients c ON c.id=l.client_id JOIN codes b ON b.code_hash=l.beta_code_hash
  WHERE c.auth_user_id=?1 AND c.status='active' AND l.status='active' AND l.expires_at>?2
  AND b.enabled=1 AND (b.expires_at IS NULL OR b.expires_at>?2)`;

export const accountDeviceRequest = api(async (request) => {
  if (request.headers.has("origin")) throw new ApiError(403, "Requête réservée à l’application.");
  const user = await identity(request);
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")
    throw new ApiError(415, "Format de requête invalide.");
  const raw = await limitedBody(request, 2048);
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new ApiError(400, "Requête invalide.");
  }
  const parsed = input.safeParse(data);
  if (!parsed.success) throw new ApiError(400, "Appareil invalide.");

  const db = await database();
  const now = new Date().toISOString();
  const device = parsed.data;
  const deviceHash = await hash(device.deviceId);
  if (device.action === "activate") {
    await db.batch([
      db
        .prepare(
          `INSERT INTO bindings(code_hash,device_hash,created_at)
        SELECT b.code_hash,?3,?2 ${eligible}
        AND (SELECT count(*) FROM bindings x WHERE x.code_hash=b.code_hash)<min(l.device_limit,b.max_devices)
        ON CONFLICT(code_hash,device_hash) DO NOTHING`,
        )
        .bind(user.id, now, deviceHash),
      db
        .prepare(
          `INSERT INTO device_profiles(code_hash,device_hash,model,android_version,app_version,last_seen)
        SELECT b.code_hash,?3,?4,?5,?6,?2 ${eligible}
        AND EXISTS(SELECT 1 FROM bindings x WHERE x.code_hash=b.code_hash AND x.device_hash=?3)
        ON CONFLICT(code_hash,device_hash) DO UPDATE SET
          android_version=excluded.android_version,app_version=excluded.app_version,last_seen=excluded.last_seen`,
        )
        .bind(user.id, now, deviceHash, device.name, device.android, device.version),
    ]);
  }
  const licence = await db
    .prepare(
      `SELECT min(l.device_limit,b.max_devices) AS quota,
    (SELECT count(*) FROM bindings x WHERE x.code_hash=b.code_hash) AS used,
    EXISTS(SELECT 1 FROM bindings x WHERE x.code_hash=b.code_hash AND x.device_hash=?3) AS linked
    ${eligible}`,
    )
    .bind(user.id, now, deviceHash)
    .first<{ quota: number; used: number; linked: number }>();
  return json({
    status: !licence
      ? "inactive"
      : licence.linked
        ? "active"
        : licence.used >= licence.quota
          ? "quota-full"
          : "unregistered",
  });
});
