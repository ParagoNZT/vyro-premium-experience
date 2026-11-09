-- Extend backups without changing the settings-only protocol of SHOW+ 1.0.42.
ALTER TABLE tv_settings_devices ADD COLUMN protocol INTEGER NOT NULL DEFAULT 1 CHECK(protocol IN (1,2));
ALTER TABLE tv_settings_devices ADD COLUMN playlist TEXT;
ALTER TABLE tv_settings_devices ADD COLUMN viewer TEXT;
ALTER TABLE tv_settings_backups ADD COLUMN profile TEXT CHECK(profile IS NULL OR (length(profile)<=350000 AND json_valid(profile)));
ALTER TABLE tv_settings_jobs ADD COLUMN scope TEXT NOT NULL DEFAULT 'settings' CHECK(scope IN ('settings','profile'));
ALTER TABLE tv_settings_jobs ADD COLUMN profile TEXT CHECK(profile IS NULL OR (length(profile)<=350000 AND json_valid(profile)));
ALTER TABLE tv_settings_jobs ADD COLUMN playlist TEXT;
ALTER TABLE tv_settings_jobs ADD COLUMN source_viewer TEXT;
ALTER TABLE tv_settings_jobs ADD COLUMN target_viewer TEXT;
ALTER TABLE tv_settings_jobs ADD COLUMN failure TEXT CHECK(failure IN ('playlist','size','format'));
ALTER TABLE tv_settings_jobs ADD COLUMN sync_id TEXT;
ALTER TABLE tv_settings_jobs ADD COLUMN fingerprint TEXT;
ALTER TABLE tv_settings_jobs ADD COLUMN unchanged INTEGER NOT NULL DEFAULT 0 CHECK(unchanged IN (0,1));

CREATE TABLE tv_settings_sync (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  playlist TEXT NOT NULL,
  source_viewer TEXT NOT NULL,
  target_viewer TEXT NOT NULL,
  next_at TEXT NOT NULL,
  fingerprint TEXT,
  FOREIGN KEY(code_hash,source_id) REFERENCES tv_settings_devices(code_hash,device_hash) ON DELETE CASCADE,
  FOREIGN KEY(code_hash,target_id) REFERENCES tv_settings_devices(code_hash,device_hash) ON DELETE CASCADE,
  CHECK(source_id<>target_id)
) STRICT;
CREATE TRIGGER tv_settings_cancel_sync AFTER DELETE ON tv_settings_sync BEGIN
  DELETE FROM tv_settings_jobs WHERE sync_id=OLD.id AND status IN ('waiting_source','waiting_target');
END;
