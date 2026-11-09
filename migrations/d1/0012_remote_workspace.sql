-- Device control is independent from legacy SHOW+ licence pairing.
CREATE TABLE remote_devices (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, owner_id TEXT,
  edition TEXT NOT NULL CHECK(edition IN ('vyro','show-plus')),
  kind TEXT NOT NULL CHECK(kind IN ('tv','mobile')),
  name TEXT NOT NULL, public_key TEXT NOT NULL, paired_at TEXT, last_seen TEXT,
  proof_hash TEXT UNIQUE, proof_until TEXT, catalog TEXT,
  CHECK ((proof_hash IS NULL)=(proof_until IS NULL)),
  CHECK (catalog IS NULL OR json_valid(catalog))
) STRICT;
CREATE INDEX remote_devices_owner ON remote_devices(owner_id);
CREATE INDEX remote_devices_expiry ON remote_devices(proof_until) WHERE owner_id IS NULL;

CREATE TABLE remote_jobs (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
  device_id TEXT NOT NULL REFERENCES remote_devices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('backup','restore','layout','playlist')),
  payload TEXT CHECK(payload IS NULL OR json_valid(payload)),
  context TEXT, name TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  result TEXT CHECK(result IN ('done','failed','cancelled')),
  finished_at TEXT, sent_at TEXT
) STRICT;
CREATE INDEX remote_jobs_device ON remote_jobs(device_id,owner_id,result,expires_at);
CREATE INDEX remote_jobs_owner ON remote_jobs(owner_id,created_at DESC);

CREATE TABLE remote_backups (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, source_name TEXT NOT NULL,
  file TEXT NOT NULL CHECK(json_valid(file)), created_at TEXT NOT NULL
) STRICT;
CREATE INDEX remote_backups_owner ON remote_backups(owner_id,created_at DESC);

-- A rolling anonymous enrollment budget. The key is a digest, never an IP in plain text.
CREATE TABLE remote_pair_budget (
  bucket TEXT PRIMARY KEY, total INTEGER NOT NULL, expires_at TEXT NOT NULL
) STRICT;
CREATE INDEX remote_pair_budget_expiry ON remote_pair_budget(expires_at);

ALTER TABLE partner_orders ADD COLUMN brief TEXT;
ALTER TABLE partner_orders ADD COLUMN accent TEXT;
ALTER TABLE partner_orders ADD COLUMN wants_updates INTEGER NOT NULL DEFAULT 0 CHECK(wants_updates IN (0,1));
