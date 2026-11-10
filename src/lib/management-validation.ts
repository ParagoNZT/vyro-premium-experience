import { z } from "zod";
export const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-client"),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    firstName: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("grant-license"),
    clientId: z.string().uuid(),
    planId: z.enum(["3m", "6m", "12m"]),
    deviceLimit: z.number().int().min(1).max(10),
    note: z.string().trim().min(1).max(300),
  }),
  z.object({
    action: z.literal("revoke-license"),
    licenseId: z.string().uuid(),
    note: z.string().trim().min(1).max(300),
  }),
  z.object({
    action: z.literal("grant-license-until"),
    clientId: z.string().uuid(),
    expectedLicenseId: z.string().uuid().optional(),
    through: z.string().date("Choisissez une date de fin valide.").min(10).max(10),
    deviceLimit: z.number().int().min(1).max(10),
    note: z.string().trim().min(1).max(300),
  }),
  z
    .object({
      action: z.literal("grant-pack"),
      clientId: z.string().uuid(),
      packId: z.string().min(1).max(36),
      version: z.string().datetime().nullable(),
      note: z.string().trim().min(1).max(300),
    })
    .strict(),
  z.object({
    action: z.literal("save-pack"),
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(80),
    months: z.number().int().min(1).max(120).nullable(),
    devices: z.number().int().min(1).max(10),
    priceCents: z.number().int().min(0).max(999999).nullable(),
  }),
  z.object({
    action: z.literal("pack-availability"),
    id: z.string().uuid(),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("client-admin-role"),
    clientId: z.string().uuid(),
    grant: z.boolean(),
    note: z.string().trim().min(1).max(300),
  }),
  z.object({
    action: z.literal("client-status"),
    clientId: z.string().uuid(),
    status: z.enum(["active", "suspended"]),
    note: z.string().trim().min(1).max(300),
  }),
]);
export const deviceSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    name: z.string().trim().min(1).max(80),
    platform: z.enum(["Android TV", "Google TV", "Amazon Fire TV"]),
  }),
  z.object({ action: z.literal("remove"), id: z.string().regex(/^[a-f0-9]{64}$/) }),
]);
export const checkoutSchema = z.object({
  planId: z.enum(["3m", "6m", "12m"]),
  requestKey: z.string().uuid(),
});
