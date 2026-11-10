CREATE TABLE vyro_private_messages (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  read_at TEXT,
  dismissed_at TEXT,
  revoked_at TEXT
) STRICT;
CREATE INDEX vyro_private_messages_recipient ON vyro_private_messages(recipient_id,created_at DESC,id);
