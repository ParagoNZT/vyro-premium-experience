import { z } from "zod";

// The app uses stable IDs only. No stream URLs, titles, usernames, device IDs or keys.
const item = z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/);
export const playlistRef = z.string().regex(/^[a-f0-9]{64}$/);
const millis = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const episode = z.number().int().min(1).max(99999).optional();
const groupId = z
  .string()
  .regex(/^group-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
const group = z
  .object({
    id: groupId,
    name: z.string().trim().min(1).max(80),
    pinned: z.boolean(),
    channels: z.array(item).max(2000),
  })
  .strict();
export const tvProfile = z
  .object({
    version: z.literal(1),
    playlist: playlistRef,
    groups: z.array(group).max(80),
    visible: z.array(item).max(4000).nullable(),
    favorites: z.array(item).max(4000),
    watchlist: z.array(item).max(4000),
    history: z
      .array(
        z
          .object({
            id: item,
            position: millis,
            duration: millis,
            updated: millis,
            series: item.optional(),
            season: episode,
            episode,
          })
          .strict(),
      )
      .max(2000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.groups.length !== new Set(value.groups.map((g) => g.id)).size ||
      value.history.length !== new Set(value.history.map((h) => h.id)).size ||
      new TextEncoder().encode(JSON.stringify(value)).length > 350000
    ) {
      ctx.addIssue({ code: "custom", message: "Données trop volumineuses ou en double" });
    }
  });

export const tvProfileEdits = z
  .array(
    z
      .object({
        id: groupId,
        name: z.string().trim().min(1).max(80),
        pinned: z.boolean(),
      })
      .strict(),
  )
  .max(80);
export const tvProfileFailure = z.enum(["playlist", "size", "format"]);
