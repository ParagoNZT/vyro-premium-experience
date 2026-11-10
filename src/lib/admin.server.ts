import { api, identity, json } from "./access.server";

export const adminResponse = api(async (request) => {
  const user = await identity(request, true);
  return json({
    id: user.id,
    email: user.email,
    role: user.adminRole,
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
  });
});
