// A URL can contain playlist credentials. Only the paired Android key can open this envelope.
export async function sealPlaylistUrl(publicKey: string, raw: string, deviceId: string) {
  const url = new URL(raw.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    !url.hostname.includes(".") ||
    /^(\d+\.){3}\d+$|\.(local|localhost|internal)\.?$/i.test(url.hostname) ||
    url.href.length > 2048
  )
    throw new Error("Saisissez une adresse HTTPS publique de playlist M3U.");
  const b64 = (bytes: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))));
  const spki = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0));
  const deviceKey = await crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(deviceId) },
    key,
    new TextEncoder().encode(url.href),
  );
  const encryptedKey = await crypto.subtle.encrypt(
    "RSA-OAEP",
    deviceKey,
    await crypto.subtle.exportKey("raw", key),
  );
  return { key: b64(encryptedKey), iv: b64(iv), data: b64(data) };
}
