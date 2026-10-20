// Used for both manual grants and verified Stripe payments. SQLite serializes each batch.
export const licenseUpsertSql = `
INSERT INTO licenses (id,client_id,license_key,plan_id,started_at,expires_at,device_limit,status,source_payment_id,updated_at,beta_code_hash)
SELECT ?,?,?,?, ?,strftime('%Y-%m-%dT%H:%M:%fZ',?,'+' || ? || ' months','floor'),?,'active',?,?,?
WHERE EXISTS (SELECT 1 FROM clients WHERE id=?)
AND (? IS NULL OR EXISTS (SELECT 1 FROM payments WHERE id=? AND status='pending'))
ON CONFLICT(client_id) DO UPDATE SET
 license_key=CASE WHEN licenses.beta_code_hash IS NULL THEN excluded.license_key ELSE licenses.license_key END,
 beta_code_hash=coalesce(licenses.beta_code_hash,excluded.beta_code_hash),
 plan_id=excluded.plan_id,
 started_at=CASE WHEN licenses.status='active' THEN licenses.started_at ELSE excluded.started_at END,
 expires_at=strftime('%Y-%m-%dT%H:%M:%fZ',max(CASE WHEN licenses.status='active' THEN licenses.expires_at ELSE excluded.started_at END,excluded.started_at),'+' || ? || ' months','floor'),
 device_limit=excluded.device_limit,status='active',source_payment_id=excluded.source_payment_id,updated_at=excluded.updated_at
`;
