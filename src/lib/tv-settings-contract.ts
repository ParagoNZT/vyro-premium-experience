import { z } from "zod";
import { playlistRef, tvProfile, tvProfileEdits, tvProfileFailure } from "./tv-profile-contract";

// Only portable, non-secret app settings. The Android v1 codec uses these same keys.
export const portableSettings = z
  .object({
    version: z.literal(1),
    theme: z.enum([
      "PURPLE",
      "EMERALD",
      "OCEAN",
      "VIOLET",
      "CRIMSON",
      "AMBER",
      "ROSE",
      "CYAN",
      "CUSTOM",
    ]),
    appearanceMode: z.enum(["DARK", "LIGHT", "SYSTEM"]),
    customAccentHex: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
    vodPlayerStyle: z.enum(["MODERN", "CLASSIC"]),
    audioLanguage: z.enum(["AUTO", "FRENCH", "ORIGINAL"]),
    subtitlePreference: z.enum(["AUTO", "FRENCH", "FORCED", "OFF"]),
    subtitleSize: z.enum(["SMALL", "NORMAL", "LARGE"]),
    subtitleTextColor: z.enum(["WHITE", "YELLOW", "CYAN"]),
    subtitleFont: z.enum(["DEFAULT", "SANS_SERIF", "SERIF", "MONOSPACE"]),
    subtitleBackground: z.enum(["NONE", "TRANSLUCENT", "BLACK"]),
    interfaceScale: z.enum(["COMPACT", "STANDARD", "LARGE"]),
    animationLevel: z.enum(["FULL", "REDUCED", "OFF"]),
    sidebarStyle: z.enum(["SIMPLE", "ADVANCED"]),
    metadataLanguage: z.enum(["FRENCH", "ENGLISH", "SYSTEM"]),
    posterSource: z.enum(["PROVIDER", "TMDB"]),
    vodPosterColumns: z.number().int().min(4).max(10),
    showLivePreview: z.boolean(),
    showNextProgramme: z.boolean(),
    resumePlayback: z.boolean(),
    autoplayNextEpisode: z.boolean(),
    vodFullscreen: z.boolean(),
    hideWatched: z.boolean(),
    favoritesFirst: z.boolean(),
    oledMode: z.boolean(),
    categoriesVisible: z.boolean(),
    compactLandscape: z.boolean(),
    homeContinueWatching: z.boolean(),
    homeNewMovies: z.boolean(),
    homeNewSeries: z.boolean(),
    homeSeriesUpdates: z.boolean(),
    homeTopTmdb: z.boolean(),
    tmdbLogos: z.boolean(),
    tmdbBackdrops: z.boolean(),
    tmdbSynopsis: z.boolean(),
  })
  .strict();

const device = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().uuid();
const proof = { token: z.string().regex(/^SHOWP-[A-F0-9]{64}$/), deviceId: device };
const deviceKind = z.enum(["tv", "mobile"]);
export const tvSettingsAction = z
  .discriminatedUnion("action", [
    z
      .object({
        action: z.literal("poll"),
        version: z.union([z.literal(1), z.literal(2)]),
        playlist: playlistRef.optional(),
        viewer: playlistRef.optional(),
        kind: deviceKind.optional(),
        ...proof,
      })
      .strict(),
    z
      .object({
        action: z.literal("pair"),
        version: z.union([z.literal(1), z.literal(2)]),
        name: z.string().trim().min(1).max(80),
        kind: deviceKind.optional(),
        ...proof,
      })
      .strict(),
    z
      .object({
        action: z.literal("complete"),
        version: z.union([z.literal(1), z.literal(2)]),
        ...proof,
        jobId: id,
        phase: z.enum(["capture", "apply"]),
        ok: z.boolean(),
        settings: portableSettings.optional(),
        profile: tvProfile.optional(),
        failure: tvProfileFailure.optional(),
      })
      .strict(),
  ])
  .refine((value) =>
    value.action === "poll"
      ? !!value.playlist === !!value.viewer && (value.version === 2 || !value.playlist)
      : value.action !== "complete" ||
        ((value.phase === "capture" && value.ok) === (value.settings !== undefined) &&
          (!value.profile || (value.version === 2 && value.phase === "capture" && value.ok)) &&
          (!value.failure || (value.version === 2 && !value.ok))),
  );

export const tvBackupFile = z
  .object({
    format: z.literal("vyro-backup"),
    version: z.literal(1),
    settings: portableSettings,
    profile: tvProfile.optional(),
  })
  .strict();

export const webSettingsAction = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("backup"),
      sourceId: device,
      name: z.string().trim().min(1).max(64),
      scope: z.enum(["settings", "profile"]).optional(),
    })
    .strict(),
  z.object({ action: z.literal("restore"), backupId: id, targetId: device }).strict(),
  z
    .object({
      action: z.literal("copy"),
      sourceId: device,
      targetId: device,
      scope: z.enum(["settings", "profile"]).optional(),
    })
    .strict(),
  z.object({ action: z.literal("delete"), backupId: id }).strict(),
  z
    .object({
      action: z.literal("pair"),
      name: z.string().trim().min(1).max(64).optional(),
      pairingCode: z
        .string()
        .trim()
        .toUpperCase()
        .transform((value) => value.replaceAll("-", ""))
        .pipe(z.string().regex(/^[A-F0-9]{16}$/)),
    })
    .strict(),
  z.object({ action: z.literal("unlink"), deviceId: device }).strict(),
  z
    .object({
      action: z.literal("import"),
      name: z.string().trim().min(1).max(64),
      file: tvBackupFile,
    })
    .strict(),
  z.object({ action: z.literal("edit-groups"), backupId: id, groups: tvProfileEdits }).strict(),
  z.object({ action: z.literal("sync-on"), sourceId: device, targetId: device }).strict(),
  z.object({ action: z.literal("sync-off") }).strict(),
]);

export type TvSettingsAction = z.infer<typeof tvSettingsAction>;
