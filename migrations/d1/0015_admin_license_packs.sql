CREATE TABLE vyro_custom_packs (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 80),
 name_key TEXT NOT NULL UNIQUE,
 months INTEGER CHECK(months IS NULL OR months BETWEEN 1 AND 120),
 devices INTEGER NOT NULL CHECK(devices BETWEEN 1 AND 10),
 price_cents INTEGER CHECK(price_cents IS NULL OR price_cents BETWEEN 0 AND 999999),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL
) STRICT;

ALTER TABLE licenses ADD COLUMN pack_id TEXT;
ALTER TABLE licenses ADD COLUMN pack_name TEXT;
