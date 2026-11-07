export function stripeMode() {
  const key = process.env["STRIPE_SECRET_KEY"];
  const webhook = process.env["STRIPE_WEBHOOK_SECRET"];
  const mode = key?.match(/^(?:sk|rk)_(test|live)_/)?.[1];
  return { enabled: Boolean(mode && webhook?.startsWith("whsec_")), live: mode === "live" };
}
