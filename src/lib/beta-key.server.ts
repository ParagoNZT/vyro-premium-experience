import { z } from "zod";
import { api, identity, body, json, ApiError } from "./access.server";
import { database, logStatement } from "./management.server";

const input = z.object({ id: z.string().uuid(), action: z.enum(["reveal", "share"]) });

export const betaKeyRequest = api(async (request) => {
  const user = await identity(request, true);
  const parsed = input.safeParse(await body(request));
  if (!parsed.success) throw new ApiError(400, "Accès invalide.");
  if (parsed.data.action !== "reveal")
    throw new ApiError(409, "Les clés de partage se gèrent dans VYRO Studio.");
  const db = await database();
  const code = await db
    .prepare(
      `SELECT c.id,l.license_key FROM codes c JOIN licenses l ON l.beta_code_hash=c.code_hash
    WHERE c.id=? OR l.id=? LIMIT 1`,
    )
    .bind(parsed.data.id, parsed.data.id)
    .first<{ id: string; license_key: string }>();
  if (!code || !/^VYRO-[A-F0-9]{24}$/.test(code.license_key)) {
    throw new ApiError(
      404,
      "Clé du site introuvable. Les accès historiques se gèrent dans VYRO Studio.",
    );
  }
  await logStatement(
    db,
    user.id,
    "access-key-viewed",
    code.id,
    "Clé consultée par l’administrateur ; valeur non journalisée.",
  ).run();
  return json({ code: code.license_key });
});
