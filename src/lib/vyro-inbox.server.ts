import { z } from "zod";
import { api, ApiError, identity, json, body } from "./access.server";
import { database, changed } from "./management.server";
import type { ManagementDB } from "./db-types";

const id = z.string().uuid();
const send = z
  .object({
    action: z.literal("send"),
    client: id,
    title: z.string().trim().min(3).max(100),
    body: z.string().trim().min(3).max(1000),
  })
  .strict();
const receipt = z
  .object({
    action: z.enum(["read", "dismiss"]),
    id,
  })
  .strict();

export type InboxMessage = {
  id: string;
  sender: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};
export type MessageRecipient = { id: string; username: string; email: string; devices: number };

export async function readPrivateInbox(
  db: ManagementDB,
  owner: string,
  device?: { id: string; tokenHash: string },
) {
  const { results } = await db
    .prepare(
      `SELECT m.id,m.sender_name AS sender,m.title,m.body,m.created_at AS createdAt,
    (m.read_at IS NOT NULL) AS read FROM vyro_private_messages m
    WHERE m.recipient_id=? AND m.expires_at>? AND m.revoked_at IS NULL AND m.dismissed_at IS NULL
    AND EXISTS(SELECT 1 FROM clients c WHERE c.auth_user_id=m.recipient_id AND c.status='active')
    ${
      device
        ? `AND EXISTS(SELECT 1 FROM remote_devices d WHERE d.id=? AND d.token_hash=?
       AND d.owner_id=m.recipient_id AND d.edition='vyro')`
        : ""
    }
    ORDER BY m.created_at DESC,m.id LIMIT 25`,
    )
    .bind(owner, new Date().toISOString(), ...(device ? [device.id, device.tokenHash] : []))
    .all<Omit<InboxMessage, "read"> & { read: number }>();
  return results.map((item) => ({ ...item, read: Boolean(item.read) }));
}

export async function privateInboxReceipt(
  db: ManagementDB,
  owner: string,
  message: string,
  action: "read" | "dismiss",
  device?: { id: string; tokenHash: string },
) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE vyro_private_messages AS m SET read_at=coalesce(read_at,?1),
    dismissed_at=CASE WHEN ?2='dismiss' THEN coalesce(dismissed_at,?1) ELSE dismissed_at END
    WHERE m.id=?3 AND m.recipient_id=?4 AND m.revoked_at IS NULL AND m.expires_at>?1
    AND EXISTS(SELECT 1 FROM clients c WHERE c.auth_user_id=m.recipient_id AND c.status='active')
    ${
      device
        ? `AND EXISTS(SELECT 1 FROM remote_devices d WHERE d.id=?5 AND d.token_hash=?6
      AND d.owner_id=m.recipient_id AND d.edition='vyro')`
        : ""
    }`,
    )
    .bind(now, action, message, owner, ...(device ? [device.id, device.tokenHash] : []))
    .run();
}

export const vyroInbox = api(async (request) => {
  const params = new URL(request.url).searchParams;
  const admin = params.get("view") === "admin";
  const user = await identity(request, admin);
  const db = await database();
  if (request.method === "GET") {
    if (!admin) return json({ messages: await readPrivateInbox(db, user.id) });
    const q = (params.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2) return json({ recipients: [] });
    const { results } = await db
      .prepare(
        `SELECT c.id,c.first_name AS username,c.email,
      (SELECT count(*) FROM remote_devices d WHERE d.owner_id=c.auth_user_id AND d.edition='vyro') AS devices
      FROM clients c WHERE c.status='active' AND c.auth_user_id IS NOT NULL
        AND (instr(lower(c.first_name),lower(?1))>0 OR instr(lower(c.email),lower(?1))>0)
      ORDER BY (lower(c.first_name)=lower(?1)) DESC,c.first_name COLLATE NOCASE,c.id LIMIT 12`,
      )
      .bind(q)
      .all<MessageRecipient>();
    return json({ recipients: results });
  }
  const payload = await body(request);
  if (!admin) {
    const parsed = receipt.safeParse(payload);
    if (!parsed.success) throw new ApiError(400, "Action de messagerie invalide.");
    await privateInboxReceipt(db, user.id, parsed.data.id, parsed.data.action);
    return json({ ok: true });
  }
  const parsed = send.safeParse(payload);
  if (!parsed.success) throw new ApiError(400, "Vérifiez le destinataire et le contenu.");
  const { client, title, body: message } = parsed.data;
  const now = new Date();
  const username = user.user_metadata?.["first_name"];
  const sender =
    (typeof username === "string"
      ? username
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, 80)
      : "") || "Équipe VYRO";
  const result = await db
    .prepare(
      `INSERT INTO vyro_private_messages(id,recipient_id,sender_id,sender_name,title,body,created_at,expires_at)
    SELECT ?,c.auth_user_id,?,?,?,?,?,? FROM clients c WHERE c.id=? AND c.status='active' AND c.auth_user_id IS NOT NULL`,
    )
    .bind(
      crypto.randomUUID(),
      user.id,
      sender,
      title,
      message,
      now.toISOString(),
      new Date(now.getTime() + 30 * 86400_000).toISOString(),
      client,
    )
    .run();
  if (!changed(result)) throw new ApiError(404, "Ce compte client n’est plus disponible.");
  return json({ ok: true }, 201);
});
