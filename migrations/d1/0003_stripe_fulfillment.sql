-- Additive: remember refunds arriving before Checkout fulfillment and the origin of new grants.
CREATE TABLE IF NOT EXISTS stripe_full_refunds (
  payment_intent TEXT NOT NULL,
  livemode INTEGER NOT NULL CHECK (livemode IN (0,1)),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (payment_intent,livemode)
) STRICT;

CREATE TABLE IF NOT EXISTS stripe_license_grants (
  payment_id TEXT PRIMARY KEY REFERENCES payments(id),
  initial_term INTEGER NOT NULL CHECK (initial_term IN (0,1)),
  granted_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS payments_intent_mode ON payments(stripe_payment_intent,livemode)
  WHERE stripe_payment_intent IS NOT NULL;
