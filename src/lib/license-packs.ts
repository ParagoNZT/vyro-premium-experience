import { PACKS, packDevices } from "../config/site.ts";

export type LicensePack = {
  id: string;
  name: string;
  months: number | null;
  devices: number;
  priceCents: number | null;
  enabled: number;
  updatedAt: string | null;
};

export const standardLicensePacks: LicensePack[] = PACKS.map((pack) => ({
  id: pack.id,
  name: pack.name,
  months: pack.term === "lifetime" ? null : 12,
  devices: pack.devices,
  priceCents: Math.round(pack.price * 100),
  enabled: 1,
  updatedAt: null,
}));

export const licensePackNameKey = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");

export const licensePackTerms = (pack: LicensePack) =>
  `${packDevices(pack)} · ${pack.months === null ? "sans échéance" : `${pack.months} mois`}`;
