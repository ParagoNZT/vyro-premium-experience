export type VerifiedIdentity = {
  id: string;
  email: string;
  email_confirmed_at: string;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
  last_sign_in_at?: string;
};

// Pass only the current identity returned by the Supabase Auth server.
export function isAdminIdentity(
  user: Partial<VerifiedIdentity>,
  configuredId?: string,
  configuredEmail?: string,
) {
  const id = configuredId?.trim();
  return Boolean(
    id &&
    user.id === id &&
    !user.is_anonymous &&
    user.email_confirmed_at &&
    user.email &&
    (!configuredEmail?.trim() ||
      user.email.trim().toLowerCase() === configuredEmail.trim().toLowerCase()),
  );
}
