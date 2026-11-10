import { ApiError } from "./api-error.ts";
import type { ManagementDB } from "./db-types";

export async function database(): Promise<ManagementDB> {
  let db: ManagementDB | undefined;
  try {
    db = (await import("cloudflare:workers")).env["VYRO_DB"] as ManagementDB | undefined;
  } catch {
    // Non-Worker preview.
  }
  if (!db) throw new ApiError(503, "La base de gestion n’est pas encore reliée.");
  return db;
}
