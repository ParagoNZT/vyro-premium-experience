import { z } from "zod";
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-client"), email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), firstName: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("grant-license"), clientId: z.string().uuid(), planId: z.enum(["3m","6m","12m"]), deviceLimit: z.number().int().min(1).max(10), note: z.string().trim().min(1).max(300) }),
  z.object({ action: z.literal("revoke-license"), licenseId: z.string().uuid(), note: z.string().trim().min(1).max(300) }),
  z.object({ action: z.literal("client-status"), clientId: z.string().uuid(), status: z.enum(["active","suspended"]), note: z.string().trim().min(1).max(300) }),
]);
export const deviceSchema = z.discriminatedUnion("action", [
 z.object({ action: z.literal("add"), name: z.string().trim().min(1).max(80), platform: z.enum(["Android TV","Google TV","Amazon Fire TV"]) }),
 z.object({ action: z.literal("remove"), id: z.string().regex(/^[a-f0-9]{64}$/) }),
]);
export const checkoutSchema = z.object({ planId: z.enum(["3m","6m","12m"]), requestKey: z.string().uuid() });
