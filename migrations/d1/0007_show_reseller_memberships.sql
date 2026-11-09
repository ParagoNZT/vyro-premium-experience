-- A VYRO account can be authorized for the SHOW+ directory without changing
-- access codes, subscriptions or the SHOW+ Android applications.
CREATE TABLE IF NOT EXISTS show_reseller_memberships (
  auth_user_id TEXT PRIMARY KEY NOT NULL,
  verified_email TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1))
);
