// D1 batches are transactional. Recheck eligibility and the binding count in SQL.
export const licenseUpsertSql = `
INSERT INTO licenses (id,client_id,license_key,plan_id,started_at,expires_at,device_limit,status,source_payment_id,updated_at,beta_code_hash)
SELECT ?,?,?,?, ?,strftime('%Y-%m-%dT%H:%M:%fZ',?,'+' || ? || ' months','floor'),?,'active',?,?,?
WHERE EXISTS (SELECT 1 FROM clients WHERE id=? AND ((status='active' AND auth_user_id IS NOT NULL) OR ? IS NOT NULL))
AND (? IS NULL OR EXISTS (
 SELECT 1 FROM payments WHERE id=? AND client_id=? AND status IN ('pending','failed') AND livemode=1 AND stripe_session_id=? AND stripe_payment_intent=?
))
ON CONFLICT(client_id) DO UPDATE SET
 license_key=CASE WHEN licenses.beta_code_hash IS NULL THEN excluded.license_key ELSE licenses.license_key END,
 beta_code_hash=coalesce(licenses.beta_code_hash,excluded.beta_code_hash),
 plan_id=excluded.plan_id,
 started_at=CASE WHEN licenses.status='active' AND licenses.expires_at>excluded.started_at THEN licenses.started_at ELSE excluded.started_at END,
 expires_at=CASE WHEN licenses.status='active' AND licenses.expires_at='${NO_LICENSE_EXPIRY}' THEN licenses.expires_at
   ELSE strftime('%Y-%m-%dT%H:%M:%fZ',max(CASE WHEN licenses.status='active' THEN licenses.expires_at ELSE excluded.started_at END,excluded.started_at),'+' || ? || ' months','floor') END,
 device_limit=CASE WHEN licenses.status='active' AND licenses.expires_at='${NO_LICENSE_EXPIRY}' AND licenses.pack_id IS NOT NULL
   THEN licenses.device_limit ELSE max(excluded.device_limit, licenses.device_limit, (SELECT count(*) FROM bindings WHERE code_hash=licenses.beta_code_hash)) END,
 status='active',source_payment_id=excluded.source_payment_id,updated_at=excluded.updated_at,manual_expiry=0,
 pack_id=CASE WHEN licenses.status='active' AND licenses.expires_at='${NO_LICENSE_EXPIRY}' THEN licenses.pack_id ELSE NULL END,
 pack_name=CASE WHEN licenses.status='active' AND licenses.expires_at='${NO_LICENSE_EXPIRY}' THEN licenses.pack_name ELSE NULL END
`;

// Paid orders never use this statement. An exact expiry replaces the current term,
// with the same key and a quota that never drops below the current binding count.
export const licenseThroughSql = `
INSERT INTO licenses (id,client_id,license_key,plan_id,started_at,expires_at,device_limit,status,updated_at,beta_code_hash,manual_expiry)
SELECT ?,?,?,'12m',?,?,?,'active',?,?,1
WHERE EXISTS (SELECT 1 FROM clients WHERE id=? AND status='active' AND auth_user_id IS NOT NULL)
AND (? IS NULL OR EXISTS (SELECT 1 FROM licenses WHERE id=? AND client_id=? AND status<>'revoked'))
ON CONFLICT(client_id) DO UPDATE SET
 license_key=CASE WHEN licenses.beta_code_hash IS NULL THEN excluded.license_key ELSE licenses.license_key END,
 beta_code_hash=coalesce(licenses.beta_code_hash,excluded.beta_code_hash),
 started_at=CASE WHEN licenses.status='active' AND licenses.expires_at>excluded.started_at THEN licenses.started_at ELSE excluded.started_at END,
 expires_at=excluded.expires_at,device_limit=excluded.device_limit,status='active',
 source_payment_id=NULL,updated_at=excluded.updated_at,manual_expiry=1,pack_id=NULL,pack_name=NULL
WHERE (SELECT count(*) FROM bindings WHERE code_hash=licenses.beta_code_hash)<=excluded.device_limit
AND (licenses.status<>'active' OR licenses.expires_at<>'${NO_LICENSE_EXPIRY}')
`;
import { NO_LICENSE_EXPIRY } from "./license-dates.ts";

// Extend a finite term from its current end; never replace a live lifetime
// licence with a finite term. A catalog version check also catches concurrent edits.
export const licensePackUpsertSql = `
INSERT INTO licenses (id,client_id,license_key,plan_id,started_at,expires_at,device_limit,
 status,updated_at,beta_code_hash,pack_id,pack_name)
SELECT ?1,?2,?3,'12m',?4,CASE WHEN ?5 IS NULL THEN '${NO_LICENSE_EXPIRY}'
 ELSE strftime('%Y-%m-%dT%H:%M:%fZ',?4,'+'||?5||' months','floor') END,?6,'active',?4,?7,?8,?9
WHERE EXISTS (SELECT 1 FROM clients WHERE id=?2 AND status='active' AND auth_user_id IS NOT NULL)
AND (?10 IS NULL OR EXISTS (SELECT 1 FROM vyro_custom_packs WHERE id=?8 AND enabled=1 AND updated_at=?10))
ON CONFLICT(client_id) DO UPDATE SET
 license_key=CASE WHEN licenses.beta_code_hash IS NULL THEN excluded.license_key ELSE licenses.license_key END,
 beta_code_hash=coalesce(licenses.beta_code_hash,excluded.beta_code_hash),
 plan_id=excluded.plan_id,
 started_at=CASE WHEN licenses.status='active' AND licenses.expires_at>?4 THEN licenses.started_at ELSE ?4 END,
 expires_at=CASE WHEN ?5 IS NULL THEN '${NO_LICENSE_EXPIRY}'
  ELSE strftime('%Y-%m-%dT%H:%M:%fZ',max(CASE WHEN licenses.status='active' THEN licenses.expires_at ELSE ?4 END,?4),'+'||?5||' months','floor') END,
 device_limit=excluded.device_limit,status='active',source_payment_id=NULL,updated_at=?4,manual_expiry=0,
 pack_id=excluded.pack_id,pack_name=excluded.pack_name
WHERE (SELECT count(*) FROM bindings WHERE code_hash=licenses.beta_code_hash)<=excluded.device_limit
AND (?5 IS NULL OR (licenses.status<>'active' OR licenses.expires_at<>'${NO_LICENSE_EXPIRY}')
 AND strftime('%Y-%m-%dT%H:%M:%fZ',max(CASE WHEN licenses.status='active' THEN licenses.expires_at ELSE ?4 END,?4),'+'||?5||' months','floor') IS NOT NULL)
`;
