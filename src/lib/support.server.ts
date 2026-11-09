import { z } from "zod";
import { api, ApiError, body, identity, json } from "./access.server";
import { database } from "./management.server";

const text = z.string().trim().min(2).max(4000);
const statuses = z.enum(["open", "processing", "waiting", "closed"]);
const ticketStatus = "CASE WHEN status='open' AND processing=1 THEN 'processing' ELSE status END";
const categories = z.enum(["application", "account", "payment", "other"]);
const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    subject: z.string().trim().min(4).max(120),
    category: categories,
    message: text,
  }),
  z.object({ action: z.literal("reply"), id: z.string().uuid(), message: text }),
  z.object({ action: z.literal("status"), id: z.string().uuid(), status: statuses }),
]);

export type Ticket = {
  id: string;
  subject: string;
  category: z.infer<typeof categories>;
  status: z.infer<typeof statuses>;
  updatedAt: string;
  email?: string;
};
export type TicketReply = {
  id: string;
  author: "customer" | "support";
  message: string;
  createdAt: string;
};
export type TicketDetail = { ticket: Ticket; replies: TicketReply[] };

export const supportRequest = api(async (request) => {
  const query = new URL(request.url).searchParams;
  const admin = query.get("view") === "admin";
  const user = await identity(request, admin);
  const db = await database();
  const scope = admin ? "1=1" : "owner_id=?";
  const args = admin ? [] : [user.id];
  const columns =
    `id,subject,category,${ticketStatus} AS status,updated_at AS updatedAt` +
    (admin ? ",email" : "");
  if (request.method === "GET") {
    const id = query.get("id");
    if (id !== null) {
      if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, "Ticket invalide.");
      const ticket = await db
        .prepare(`SELECT ${columns} FROM support_tickets WHERE id=? AND ${scope}`)
        .bind(id, ...args)
        .first<Ticket>();
      if (!ticket) throw new ApiError(404, "Ticket introuvable.");
      const { results: replies } = await db
        .prepare(
          `SELECT id,author_kind AS author,body AS message,created_at AS createdAt
        FROM support_replies WHERE ticket_id=? ORDER BY created_at,id LIMIT 500`,
        )
        .bind(id)
        .all<TicketReply>();
      return json({ ticket, replies });
    }
    const filter = statuses.safeParse(query.get("status"));
    const page = Math.max(0, Math.min(10000, Number.parseInt(query.get("page") ?? "0", 10) || 0));
    const { results } = await db
      .prepare(
        `SELECT ${columns} FROM support_tickets WHERE ${scope}
      ${filter.success ? `AND (${ticketStatus})=?` : ""} ORDER BY updated_at DESC,id LIMIT 26 OFFSET ?`,
      )
      .bind(...args, ...(filter.success ? [filter.data] : []), page * 25)
      .all<Ticket>();
    return json({ tickets: results.slice(0, 25), hasMore: results.length > 25 });
  }
  const parsed = action.safeParse(await body(request));
  if (!parsed.success) throw new ApiError(400, "Vérifiez les informations du ticket.");
  const value = parsed.data;
  const now = new Date().toISOString();
  if (value.action === "create") {
    const recent = new Date(Date.now() - 86400000).toISOString();
    const id = crypto.randomUUID();
    const [written] = await db.batch([
      db
        .prepare(
          `INSERT INTO support_tickets (id,owner_id,email,subject,category,created_at,updated_at)
        SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM support_tickets WHERE owner_id=? AND created_at>?)<10`,
        )
        .bind(id, user.id, user.email, value.subject, value.category, now, now, user.id, recent),
      db
        .prepare(
          `INSERT INTO support_replies(id,ticket_id,author_id,author_kind,body,created_at)
        SELECT ?,id,?,'customer',?,? FROM support_tickets WHERE id=? AND owner_id=?`,
        )
        .bind(crypto.randomUUID(), user.id, value.message, now, id, user.id),
    ]);
    if (!written?.meta.changes)
      throw new ApiError(429, "Vous avez atteint la limite de demandes pour aujourd’hui.");
    return json({ id }, 201);
  }
  if (value.action === "status") {
    if (!admin && value.status !== "closed")
      throw new ApiError(403, "Seul le support peut modifier ce statut.");
    const result = await db
      .prepare(
        `UPDATE support_tickets SET status=?,processing=?,updated_at=? WHERE id=? AND ${scope}`,
      )
      .bind(
        value.status === "processing" ? "open" : value.status,
        Number(value.status === "processing"),
        now,
        value.id,
        ...args,
      )
      .run();
    if (!result.meta.changes) throw new ApiError(404, "Ticket introuvable.");
    return json({ id: value.id });
  }
  const replyId = crypto.randomUUID();
  const [written] = await db.batch([
    db
      .prepare(
        `INSERT INTO support_replies(id,ticket_id,author_id,author_kind,body,created_at)
      SELECT ?,id,?,?,?,? FROM support_tickets WHERE id=? AND ${scope} AND status<>'closed'
      AND (SELECT count(*) FROM support_replies WHERE ticket_id=support_tickets.id)<500`,
      )
      .bind(
        replyId,
        user.id,
        admin ? "support" : "customer",
        value.message,
        now,
        value.id,
        ...args,
      ),
    db
      .prepare(
        `UPDATE support_tickets SET processing=CASE WHEN ?='open' AND status='open' THEN processing ELSE 0 END,
      status=?,updated_at=? WHERE id=?
      AND EXISTS(SELECT 1 FROM support_replies WHERE id=? AND ticket_id=support_tickets.id)`,
      )
      .bind(admin ? "waiting" : "open", admin ? "waiting" : "open", now, value.id, replyId),
  ]);
  if (!written?.meta.changes)
    throw new ApiError(409, "Impossible de répondre à ce ticket. Vérifiez son statut.");
  return json({ id: value.id });
});
