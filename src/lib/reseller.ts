import { z } from "zod";

export const xcServerSchema = z.object({
  name: z.string().trim().min(1, "Nommez le serveur.").max(60),
  url: z.string().trim().max(255).regex(/^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]{1,5})?\/?$/, "Saisissez une adresse de base HTTP(S), sans chemin ni identifiants."),
});
export const resellerSchema = z.object({
  name: z.string().trim().min(1, "Saisissez le nom de votre application.").max(60),
  package_name: z.string().max(150).regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, "Exemple : com.votremarque.tv"),
  servers: z.array(xcServerSchema).min(1).max(10),
});
export type ResellerConfig = z.infer<typeof resellerSchema>;
export function exportResellerConfig(config: ResellerConfig, logoPath: string | null) {
  return { schemaVersion: 1, ...resellerSchema.parse(config), logoPath, loginFields: ["username", "password"], serverSelection: config.servers.length > 1 ? "named-server" : "preconfigured", contentIncluded: false };
}