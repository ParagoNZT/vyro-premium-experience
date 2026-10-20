PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS clients (
 id TEXT PRIMARY KEY, auth_user_id TEXT UNIQUE, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 first_name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at TEXT NOT NULL, last_seen_at TEXT
) STRICT;
CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id),
 plan_id TEXT NOT NULL CHECK(plan_id IN ('3m','6m','12m')), amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 currency TEXT NOT NULL DEFAULT 'eur', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded')),
 stripe_session_id TEXT UNIQUE, stripe_payment_intent TEXT, created_at TEXT NOT NULL, paid_at TEXT, livemode INTEGER NOT NULL DEFAULT 0,
 request_key TEXT NOT NULL UNIQUE
) STRICT;
CREATE INDEX IF NOT EXISTS payments_client ON payments(client_id,created_at DESC);
CREATE TABLE IF NOT EXISTS licenses (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL UNIQUE REFERENCES clients(id), license_key TEXT NOT NULL UNIQUE,
 plan_id TEXT NOT NULL CHECK(plan_id IN ('3m','6m','12m')), started_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 device_limit INTEGER NOT NULL CHECK(device_limit BETWEEN 1 AND 10),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 source_payment_id TEXT REFERENCES payments(id), updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS devices (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), name TEXT NOT NULL, platform TEXT NOT NULL,
 last_seen_at TEXT NOT NULL, UNIQUE(client_id,name)
) STRICT;
CREATE INDEX IF NOT EXISTS devices_client ON devices(client_id);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, target_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS audit_recent ON audit_log(created_at DESC);
CREATE TABLE IF NOT EXISTS stripe_events (
 id TEXT PRIMARY KEY, type TEXT NOT NULL, processed_at TEXT NOT NULL
) STRICT;
