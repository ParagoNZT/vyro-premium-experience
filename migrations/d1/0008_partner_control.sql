CREATE TABLE IF NOT EXISTS partner_apps (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  name TEXT NOT NULL,
  package_name TEXT NOT NULL UNIQUE,
  server_url TEXT,
  server_updated_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);
INSERT OR IGNORE INTO partner_apps (id,name,package_name) VALUES ('show-plus','SHOW+','com.vyro.tv.beta');

CREATE TABLE IF NOT EXISTS partner_app_devices (
  code_hash TEXT PRIMARY KEY REFERENCES codes(code_hash) ON DELETE CASCADE,
  app_id TEXT NOT NULL REFERENCES partner_apps(id)
);
CREATE INDEX IF NOT EXISTS partner_app_devices_app ON partner_app_devices(app_id);
CREATE TABLE IF NOT EXISTS partner_client_capabilities (
  code_hash TEXT PRIMARY KEY REFERENCES codes(code_hash) ON DELETE CASCADE,
  reported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_commands (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES partner_apps(id),
  code_hash TEXT NOT NULL REFERENCES codes(code_hash) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('playlist','epg')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  outcome TEXT CHECK(outcome IN ('applied','failed'))
);
CREATE INDEX IF NOT EXISTS partner_commands_target ON partner_commands(code_hash,completed_at,expires_at);

CREATE TABLE IF NOT EXISTS partner_orders (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  email TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('app','updates')),
  app_id TEXT REFERENCES partner_apps(id),
  name TEXT,
  package_name TEXT,
  cents INTEGER NOT NULL CHECK((kind='app' AND cents=10000) OR (kind='updates' AND cents=2000)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
  created_at TEXT NOT NULL,
  paid_at TEXT,
  decided_by TEXT,
  receipt TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_pending_app ON partner_orders(package_name) WHERE kind='app' AND status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS partner_pending_updates ON partner_orders(app_id) WHERE kind='updates' AND status='pending';
CREATE INDEX IF NOT EXISTS partner_orders_owner ON partner_orders(owner_id,created_at);

CREATE TABLE IF NOT EXISTS partner_update_periods (
  order_id TEXT PRIMARY KEY REFERENCES partner_orders(id),
  app_id TEXT NOT NULL REFERENCES partner_apps(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  CHECK(starts_at < ends_at)
);
CREATE INDEX IF NOT EXISTS partner_period_app ON partner_update_periods(app_id,ends_at);

CREATE TABLE IF NOT EXISTS partner_releases (
  app_id TEXT NOT NULL REFERENCES partner_apps(id),
  version_code INTEGER NOT NULL,
  version_name TEXT NOT NULL,
  apk_url TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  changelog TEXT NOT NULL,
  published_at TEXT NOT NULL,
  initial INTEGER NOT NULL DEFAULT 0 CHECK(initial IN (0,1)),
  PRIMARY KEY(app_id,version_code)
);

CREATE TABLE IF NOT EXISTS partner_audit (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES partner_apps(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS partner_audit_app ON partner_audit(app_id,created_at);
