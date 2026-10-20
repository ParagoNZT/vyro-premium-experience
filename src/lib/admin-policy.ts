type Identity = { id: string; email?: string | undefined; email_confirmed_at?: string | undefined; is_anonymous?: boolean | undefined };

// Only call with the identity returned by Supabase Auth getUser(token).
// No role from user_metadata, browser state, or an unverified JWT is accepted.
export function isAdminIdentity(user: Identity, configuredEmail: string | undefined) {
  return Boolean(configuredEmail?.trim() && user.id && !user.is_anonymous && user.email_confirmed_at &&
    user.email?.trim().toLowerCase() === configuredEmail.trim().toLowerCase());
}
