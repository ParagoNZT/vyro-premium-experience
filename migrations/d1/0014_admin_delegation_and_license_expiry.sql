CREATE TABLE vyro_admin_memberships (
  auth_user_id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL
) STRICT;

ALTER TABLE licenses ADD COLUMN manual_expiry INTEGER NOT NULL DEFAULT 0 CHECK(manual_expiry IN (0, 1));
