CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('application','account','payment','other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','waiting','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS support_tickets_owner ON support_tickets(owner_id,updated_at);
CREATE INDEX IF NOT EXISTS support_tickets_status ON support_tickets(status,updated_at);

CREATE TABLE IF NOT EXISTS support_replies (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_kind TEXT NOT NULL CHECK(author_kind IN ('customer','support')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS support_replies_thread ON support_replies(ticket_id,created_at);
