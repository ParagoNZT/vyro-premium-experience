import { z } from "zod";

export const VYRO_UPDATE_REPOSITORY = "ParagoNZT/VYRO-Updates";
export const VYRO_LATEST_URL = `https://raw.githubusercontent.com/${VYRO_UPDATE_REPOSITORY}/main/latest.json`;

const assetPath =
  /^\/ParagoNZT\/VYRO-Updates\/releases\/download\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+\.apk$/;
export const releaseBase = z.object({
  versionCode: z.number().int().min(1).max(10_000_000),
  versionName: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,39}$/),
  apkUrl: z
    .string()
    .trim()
    .max(512)
    .refine((input) => {
      try {
        const url = new URL(input);
        return (
          url.origin === "https://github.com" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          assetPath.test(url.pathname)
        );
      } catch {
        return false;
      }
    }),
  changelog: z.string().trim().max(1200),
  sha256: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-f0-9]{64}$/),
});

export type VyroRelease = z.infer<typeof releaseBase>;
export type VyroAnnouncement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  expiresAt: string;
};
export type VyroConsole = {
  published: VyroRelease | null;
  publicationReady: boolean;
  queued: (VyroRelease & { createdAt: string }) | null;
  announcements: (VyroAnnouncement & { revokedAt: string | null })[];
};
