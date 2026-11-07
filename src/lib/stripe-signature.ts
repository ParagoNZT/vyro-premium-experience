export async function verifyStripeSignature(
  raw: string | Uint8Array,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!header || !secret || header.length > 2048) return false;
  const fields = header.split(",").map((part) => part.trim().split("="));
  const timestamp = fields.find(([name]) => name === "t")?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const signatures = fields.filter(
    ([name, value]) => name === "v1" && value && /^[a-f0-9]{64}$/i.test(value),
  );
  const encoder = new TextEncoder();
  const prefix = encoder.encode(timestamp + ".");
  const payload = typeof raw === "string" ? encoder.encode(raw) : raw;
  const signed = new Uint8Array(prefix.length + payload.length);
  signed.set(prefix);
  signed.set(payload, prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  for (const [, value] of signatures) {
    const bytes = Uint8Array.from(value!.match(/../g)!, (part) => parseInt(part, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, signed)) return true;
  }
  return false;
}
