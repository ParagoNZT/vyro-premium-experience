-- Keep older linked devices usable until SHOW+ reports their form factor.
ALTER TABLE tv_settings_devices ADD COLUMN kind TEXT NOT NULL DEFAULT 'unknown' CHECK(kind IN ('tv','mobile','unknown'));
ALTER TABLE tv_settings_pairings ADD COLUMN kind TEXT NOT NULL DEFAULT 'unknown' CHECK(kind IN ('tv','mobile','unknown'));
