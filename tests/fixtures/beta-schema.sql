CREATE TABLE codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  max_devices INTEGER NOT NULL DEFAULT 1 CHECK (max_devices BETWEEN 1 AND 10),
  expires_at TEXT,
  created_at TEXT NOT NULL
, xtream_username TEXT, encrypted_code TEXT, reseller_id TEXT);
CREATE TABLE bindings (
  code_hash TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (code_hash, device_hash),
  FOREIGN KEY (code_hash) REFERENCES codes(code_hash) ON DELETE CASCADE
);
CREATE TABLE remote_playlists (
  code_hash TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (code_hash) REFERENCES codes(code_hash) ON DELETE CASCADE
);
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  target_code_hash TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT, sender TEXT NOT NULL DEFAULT 'SHOW+', target_group_id TEXT, reseller_id TEXT,
  FOREIGN KEY (target_code_hash) REFERENCES codes(code_hash) ON DELETE CASCADE
);
CREATE TABLE message_reads (
  message_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY (message_id, device_hash),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE TABLE message_hidden (
  message_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  hidden_at TEXT NOT NULL,
  PRIMARY KEY (message_id, device_hash),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE TABLE device_profiles (  code_hash TEXT NOT NULL,  device_hash TEXT NOT NULL,  manufacturer TEXT NOT NULL DEFAULT '',  model TEXT NOT NULL DEFAULT '',  android_version TEXT NOT NULL DEFAULT '',  sdk_int INTEGER,  app_version TEXT NOT NULL DEFAULT '',  last_seen TEXT NOT NULL,  PRIMARY KEY (code_hash, device_hash),  FOREIGN KEY (code_hash, device_hash) REFERENCES bindings(code_hash, device_hash) ON DELETE CASCADE);
CREATE TABLE watch_events (  id TEXT PRIMARY KEY,  code_hash TEXT NOT NULL,  device_hash TEXT NOT NULL,  title TEXT NOT NULL,  kind TEXT NOT NULL,  season INTEGER,  episode INTEGER,  started_at TEXT NOT NULL,  ended_at TEXT,  FOREIGN KEY (code_hash, device_hash) REFERENCES bindings(code_hash, device_hash) ON DELETE CASCADE);
CREATE TABLE beta_settings (id INTEGER PRIMARY KEY CHECK (id = 1), server_url TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE beta_sessions (token_hash TEXT PRIMARY KEY, code_hash TEXT NOT NULL, device_hash TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (code_hash, device_hash) REFERENCES bindings(code_hash, device_hash) ON DELETE CASCADE);
CREATE TABLE login_attempts (identity_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start TEXT NOT NULL);
CREATE TABLE message_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sender TEXT NOT NULL DEFAULT 'SHOW+'
);
CREATE TABLE device_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  match_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE code_aliases (alias_hash TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, encrypted_code TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (code_hash) REFERENCES codes(code_hash) ON DELETE CASCADE);
CREATE TABLE resellers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  encrypted_token TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE playlist_codes (
  code_hash TEXT PRIMARY KEY,
  activation_hash TEXT NOT NULL UNIQUE,
  encrypted_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (code_hash) REFERENCES codes(code_hash) ON DELETE CASCADE
);
CREATE TABLE playlist_activations (
  code_hash TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  PRIMARY KEY (code_hash, device_hash),
  FOREIGN KEY (code_hash, device_hash) REFERENCES bindings(code_hash, device_hash) ON DELETE CASCADE
);
CREATE TABLE beta_updates (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version_code INTEGER NOT NULL CHECK (version_code > 0),
  version_name TEXT NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  sha256 TEXT,
  updated_at TEXT NOT NULL
);