export const attachPaymentSql = `UPDATE payments SET stripe_session_id=?,stripe_payment_intent=?
  WHERE id=? AND status IN ('pending','failed') AND (stripe_session_id IS NULL OR stripe_session_id=?)
  AND (stripe_payment_intent IS NULL OR stripe_payment_intent=?)`;

export const suppressRefundedFulfillmentSql = `UPDATE payments SET status='refunded' WHERE id=? AND status IN ('pending','failed')
  AND EXISTS (SELECT 1 FROM stripe_full_refunds r WHERE r.payment_intent=payments.stripe_payment_intent AND r.livemode=payments.livemode)`;

export const recordGrantSql = `INSERT INTO stripe_license_grants(payment_id,initial_term,granted_at)
  SELECT p.id, CASE WHEN EXISTS (SELECT 1 FROM licenses l WHERE l.client_id=p.client_id AND l.status='active' AND l.expires_at>?) THEN 0 ELSE 1 END, ?
  FROM payments p WHERE p.id=? AND p.status IN ('pending','failed') AND p.livemode=1 AND p.stripe_session_id=? AND p.stripe_payment_intent=?
  ON CONFLICT(payment_id) DO NOTHING`;

export const finalizePaymentSql = `UPDATE payments SET status='paid',paid_at=? WHERE id=? AND status IN ('pending','failed')
  AND stripe_session_id=? AND stripe_payment_intent=?
  AND (livemode=0 OR EXISTS (SELECT 1 FROM stripe_license_grants g WHERE g.payment_id=payments.id))`;

export const recordRefundSql = `INSERT INTO stripe_full_refunds(payment_intent,livemode,recorded_at) VALUES(?,?,?)
  ON CONFLICT(payment_intent,livemode) DO NOTHING`;

export const revokeSoleGrantSql = `UPDATE licenses SET status='revoked',updated_at=? WHERE status='active' AND source_payment_id IN (
  SELECT p.id FROM payments p JOIN stripe_license_grants g ON g.payment_id=p.id
  WHERE p.stripe_payment_intent=? AND p.livemode=? AND p.livemode=1 AND p.status='paid' AND g.initial_term=1 AND licenses.updated_at=g.granted_at
)`;

export const finalizeRefundSql = `UPDATE payments SET status='refunded'
  WHERE stripe_payment_intent=? AND livemode=? AND status IN ('paid','pending','failed')`;
