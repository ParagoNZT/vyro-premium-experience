export function stripeMode() {
  if (process.env["VYRO_STRIPE_ENABLED"] !== "true") return { enabled: false, live: false };
  const key = process.env["STRIPE_SECRET_KEY"];
  const webhook = process.env["STRIPE_WEBHOOK_SECRET"];
  const mode = key?.match(/^(?:sk|rk)_(test|live)_/)?.[1];
  return { enabled: Boolean(mode && webhook?.startsWith("whsec_")), live: mode === "live" };
}
