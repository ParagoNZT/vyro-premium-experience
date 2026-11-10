import { z } from "zod";
import { portableSettings, tvBackupFile } from "./tv-settings-contract";
import { playlistRef, tvProfile } from "./tv-profile-contract";

const id = z.string().uuid();
const text = (n: number) => z.string().trim().min(1).max(n);
const binary = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/);
const item = z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/);
export const qrProof = z.string().regex(/^[A-F0-9]{32}$/);
export const groupLayout = z
  .object({
    visible: z.array(item).max(4000).nullable(),
    groups: z
      .array(
        z
          .object({
            id: z.string().regex(/^group-[a-f0-9-]{36}$/),
            name: text(80),
            pinned: z.boolean(),
            channels: z.array(item).max(2000),
          })
          .strict(),
      )
      .max(80),
  })
  .strict();
export const remoteCatalog = z
  .object({
    context: playlistRef,
    active: playlistRef.nullable(),
    playlists: z
      .array(
        z
          .object({
            id: playlistRef,
            name: text(80),
            kind: z.enum(["m3u", "xc"]),
            editable: z.boolean(),
          })
          .strict(),
      )
      .max(40),
    categories: z.array(z.object({ id: item, name: text(100) }).strict()).max(500),
    channels: z.array(z.object({ id: item, name: text(100) }).strict()).max(700),
    layout: groupLayout.nullable(),
    layoutComplete: z.boolean(),
  })
  .strict();
const credentials = { id, token: z.string().regex(/^[a-f0-9]{64}$/) };
export const remoteNative = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("pair"),
      ...credentials,
      edition: z.enum(["vyro", "show-plus"]),
      kind: z.enum(["tv", "mobile"]),
      name: text(80),
      publicKey: binary(360, 430),
    })
    .strict(),
  z
    .object({
      action: z.literal("poll"),
      ...credentials,
      catalog: remoteCatalog.nullable(),
      inbox: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("message-receipt"),
      ...credentials,
      messageId: id,
      receipt: z.enum(["read", "dismiss"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("complete"),
      ...credentials,
      jobId: id,
      ok: z.boolean(),
      settings: portableSettings.optional(),
      profile: tvProfile.optional(),
    })
    .strict(),
]);
export const remoteWeb = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), proof: qrProof }).strict(),
  z.object({ action: z.literal("claim"), proof: qrProof }).strict(),
  z.object({ action: z.literal("unlink"), device: id }).strict(),
  z.object({ action: z.literal("cancel"), job: id }).strict(),
  z.object({ action: z.literal("backup"), device: id, name: text(64), full: z.boolean() }).strict(),
  z.object({ action: z.literal("restore"), device: id, backup: id }).strict(),
  z.object({ action: z.literal("delete"), backup: id }).strict(),
  z.object({ action: z.literal("import"), name: text(64), file: tvBackupFile }).strict(),
  z
    .object({
      action: z.literal("layout"),
      device: id,
      context: playlistRef,
      playlist: playlistRef,
      layout: groupLayout,
    })
    .strict(),
  z
    .object({
      action: z.literal("playlist"),
      device: id,
      context: playlistRef,
      playlist: playlistRef.nullable(),
      name: text(80),
      sealed: z
        .object({ key: binary(344, 344), iv: binary(16, 16), data: binary(24, 4100) })
        .strict()
        .optional(),
    })
    .strict(),
]);
export type RemoteCatalog = z.infer<typeof remoteCatalog>;
export type RemoteWebAction = z.infer<typeof remoteWeb>;
export type RemoteDevice = {
  id: string;
  edition: "vyro" | "show-plus";
  kind: "tv" | "mobile";
  name: string;
  publicKey: string;
  lastSeen: string | null;
  catalog: RemoteCatalog | null;
};
export type RemoteOverview = {
  devices: RemoteDevice[];
  backups: { id: string; name: string; source: string; date: string; full: boolean }[];
  jobs: {
    id: string;
    name: string;
    device: string;
    status: "done" | "failed" | "cancelled" | "expired" | "waiting" | "sent";
    date: string;
  }[];
};
