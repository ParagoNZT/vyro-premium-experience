CREATE TABLE IF NOT EXISTS vyro_release_queue (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  version_code INTEGER NOT NULL,
  version_name TEXT NOT NULL,
  apk_url TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  changelog TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  withdrawn_at TEXT
);

CREATE TABLE IF NOT EXISTS vyro_announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS vyro_announcements_active ON vyro_announcements(revoked_at,expires_at,created_at);
