-- A public SHOW+ installation is explicitly paired to a customer licence.
CREATE TABLE IF NOT EXISTS tv_settings_devices (
  code_hash TEXT NOT NULL REFERENCES codes(code_hash) ON DELETE CASCADE,
  device_hash TEXT NOT NULL UNIQUE REFERENCES show_installations(device_hash) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  PRIMARY KEY (code_hash, device_hash)
) STRICT;

CREATE TABLE IF NOT EXISTS tv_settings_pairings (
  device_hash TEXT PRIMARY KEY NOT NULL REFERENCES show_installations(device_hash) ON DELETE CASCADE,
  proof_hash TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;

-- Consume the proof in the same statement that grants access to a device.
CREATE TRIGGER IF NOT EXISTS tv_settings_consume_pairing AFTER INSERT ON tv_settings_devices
BEGIN
  DELETE FROM tv_settings_pairings WHERE device_hash=NEW.device_hash;
END;

CREATE TABLE IF NOT EXISTS tv_settings_backups (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 64),
  source_name TEXT NOT NULL,
  settings TEXT NOT NULL CHECK (length(settings) BETWEEN 2 AND 4096 AND json_valid(settings)),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS tv_settings_backups_owner ON tv_settings_backups(client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tv_settings_jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('backup','restore','copy')),
  status TEXT NOT NULL CHECK (status IN ('waiting_source','waiting_target','done','failed')),
  name TEXT NOT NULL,
  source_id TEXT,
  source_name TEXT,
  target_id TEXT,
  target_name TEXT,
  settings TEXT CHECK (settings IS NULL OR (length(settings) BETWEEN 2 AND 4096 AND json_valid(settings))),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (code_hash, source_id) REFERENCES tv_settings_devices(code_hash, device_hash) ON DELETE CASCADE,
  FOREIGN KEY (code_hash, target_id) REFERENCES tv_settings_devices(code_hash, device_hash) ON DELETE CASCADE,
  CHECK (
    (operation = 'backup' AND source_id IS NOT NULL AND target_id IS NULL) OR
    (operation = 'restore' AND source_id IS NULL AND target_id IS NOT NULL) OR
    (operation = 'copy' AND source_id IS NOT NULL AND target_id IS NOT NULL AND source_id <> target_id)
  ),
  CHECK ((status = 'waiting_target') = (settings IS NOT NULL))
) STRICT;
CREATE INDEX IF NOT EXISTS tv_settings_jobs_owner ON tv_settings_jobs(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tv_settings_jobs_source ON tv_settings_jobs(code_hash, source_id, status, created_at);
CREATE INDEX IF NOT EXISTS tv_settings_jobs_target ON tv_settings_jobs(code_hash, target_id, status, created_at);
