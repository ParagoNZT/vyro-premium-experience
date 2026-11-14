export const logoAccept = "image/png,image/jpeg,image/webp";
export const logoMaxInputBytes = 2 * 1024 * 1024;
export const logoMaxPixels = 512;
export const logoMaxBase64Length = 1_420_000;
export const orderBrandColor = "#8163db";
const prefix = "data:image/png;base64,";
const draftKey = "vyro:reseller-brand-draft:v1";
const lifetime = 2 * 60 * 60 * 1000;
const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];
const pngEnd = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
const logoTypes = new Set(logoAccept.split(","));

export type ResellerBrandDraft = { name: string; accent: string; logo: string | null };

let memory: unknown;

type DraftEntry = ResellerBrandDraft & { expiresAt: number; owner?: string };

export function validOrderLogo(value: string): boolean {
  if (
    value.length < 60 ||
    value.length > logoMaxBase64Length ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return false;
  try {
    const header = atob(value.slice(0, 32));
    const end = atob(value.slice(-20)).slice(-12);
    if (
      !pngHeader.every((byte, i) => header.charCodeAt(i) === byte) ||
      !pngEnd.every((byte, i) => end.charCodeAt(i) === byte)
    )
      return false;
    const dimension = (i: number) =>
      header.charCodeAt(i) * 0x1000000 +
      header.charCodeAt(i + 1) * 0x10000 +
      header.charCodeAt(i + 2) * 0x100 +
      header.charCodeAt(i + 3);
    const width = dimension(16);
    const height = dimension(20);
    return width >= 1 && width <= logoMaxPixels && height >= 1 && height <= logoMaxPixels;
  } catch {
    return false;
  }
}

export function orderLogoSrc(logo: string) {
  return prefix + logo;
}

export async function prepareOrderLogo(file: File) {
  if (!logoTypes.has(file.type) || !file.size || file.size > logoMaxInputBytes) throw new Error();
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, logoMaxPixels / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error();
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const output = canvas.toDataURL("image/png").slice(prefix.length);
    if (!validOrderLogo(output)) throw new Error();
    return output;
  } finally {
    image.close();
  }
}

export function keepBrandDraft(draft: ResellerBrandDraft, owner?: string) {
  persist({ ...draft, expiresAt: Date.now() + lifetime, ...(owner ? { owner } : {}) });
}

function persist(entry: DraftEntry) {
  memory = entry;
  try {
    window.sessionStorage.setItem(draftKey, JSON.stringify(entry));
  } catch {
    // In-memory navigation still works if session storage is disabled.
  }
}

export function readBrandDraft(owner?: string, claim = false): ResellerBrandDraft | null {
  let entry = memory;
  try {
    const stored = window.sessionStorage.getItem(draftKey);
    if (stored) entry = JSON.parse(stored);
  } catch {
    // Use the in-memory draft when available.
  }
  if (!entry || typeof entry !== "object") return null;
  const draft = entry as Partial<DraftEntry>;
  if (
    typeof draft.expiresAt !== "number" ||
    draft.expiresAt < Date.now() ||
    (draft.owner && draft.owner !== owner)
  ) {
    clearBrandDraft();
    return null;
  }
  if (
    typeof draft.name !== "string" ||
    draft.name.trim().length < 2 ||
    draft.name.length > 60 ||
    typeof draft.accent !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(draft.accent)
  )
    return null;
  const logo = typeof draft.logo === "string" && validOrderLogo(draft.logo) ? draft.logo : null;
  const result = { name: draft.name, accent: draft.accent, logo };
  if (claim && owner && !draft.owner) persist({ ...result, expiresAt: draft.expiresAt, owner });
  return result;
}

export function resumeBrandDraft(owner: string) {
  return readBrandDraft(owner, true);
}

export function clearBrandDraft() {
  memory = undefined;
  try {
    window.sessionStorage.removeItem(draftKey);
  } catch {
    // Nothing persisted.
  }
}
