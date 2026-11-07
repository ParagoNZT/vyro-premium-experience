-- Run on the beta database after importing the management tables.
ALTER TABLE licenses ADD COLUMN beta_code_hash TEXT;
CREATE UNIQUE INDEX licenses_beta_code ON licenses(beta_code_hash) WHERE beta_code_hash IS NOT NULL;
CREATE TRIGGER vyro_license_insert AFTER INSERT ON licenses WHEN NEW.beta_code_hash IS NOT NULL
BEGIN
 INSERT INTO codes(id,code_hash,name,enabled,max_devices,expires_at,created_at)
 SELECT NEW.id,NEW.beta_code_hash,substr('VYRO · '||email,1,80),
 CASE WHEN NEW.status='active' AND status='active' THEN 1 ELSE 0 END,
 NEW.device_limit,CASE WHEN NEW.expires_at='9999-12-31T23:59:59.999Z' THEN NULL ELSE NEW.expires_at END,NEW.started_at FROM clients WHERE id=NEW.client_id;
END;
CREATE TRIGGER vyro_license_update AFTER UPDATE OF status,expires_at,device_limit,beta_code_hash ON licenses WHEN NEW.beta_code_hash IS NOT NULL
BEGIN
 INSERT INTO codes(id,code_hash,name,enabled,max_devices,expires_at,created_at)
 SELECT NEW.id,NEW.beta_code_hash,substr('VYRO · '||email,1,80),
 CASE WHEN NEW.status='active' AND status='active' THEN 1 ELSE 0 END,
 NEW.device_limit,CASE WHEN NEW.expires_at='9999-12-31T23:59:59.999Z' THEN NULL ELSE NEW.expires_at END,NEW.started_at FROM clients WHERE id=NEW.client_id
 ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,max_devices=excluded.max_devices,expires_at=excluded.expires_at
 WHERE codes.code_hash=excluded.code_hash AND
 (codes.enabled<>excluded.enabled OR codes.max_devices<>excluded.max_devices OR codes.expires_at IS NOT excluded.expires_at);
END;
CREATE TRIGGER vyro_client_status AFTER UPDATE OF status ON clients WHEN OLD.status<>NEW.status
BEGIN
 UPDATE codes SET enabled=CASE WHEN NEW.status='active' AND
 (SELECT status FROM licenses WHERE beta_code_hash=codes.code_hash)='active' THEN 1 ELSE 0 END
 WHERE code_hash IN (SELECT beta_code_hash FROM licenses WHERE client_id=NEW.id);
END;
CREATE TRIGGER vyro_beta_update AFTER UPDATE OF enabled,expires_at,max_devices ON codes
WHEN OLD.enabled<>NEW.enabled OR OLD.expires_at IS NOT NEW.expires_at OR OLD.max_devices<>NEW.max_devices
BEGIN
 UPDATE codes SET enabled=0 WHERE id=NEW.id AND NEW.enabled=1 AND EXISTS
 (SELECT 1 FROM licenses l JOIN clients c ON c.id=l.client_id WHERE l.beta_code_hash=NEW.code_hash AND c.status='suspended');
 UPDATE licenses SET
 status=CASE WHEN (SELECT status FROM clients WHERE id=licenses.client_id)='suspended' THEN status
 WHEN NEW.enabled=1 THEN 'active' ELSE 'revoked' END,
 expires_at=coalesce(NEW.expires_at,'9999-12-31T23:59:59.999Z'),device_limit=NEW.max_devices,
 updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE beta_code_hash=NEW.code_hash AND
 (expires_at IS NOT coalesce(NEW.expires_at,'9999-12-31T23:59:59.999Z') OR device_limit<>NEW.max_devices OR
 ((SELECT status FROM clients WHERE id=licenses.client_id)='active' AND status<>CASE WHEN NEW.enabled=1 THEN 'active' ELSE 'revoked' END));
END;
CREATE TRIGGER vyro_beta_delete AFTER DELETE ON codes
BEGIN
 UPDATE licenses SET status='revoked',beta_code_hash=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE beta_code_hash=OLD.code_hash;
END;
