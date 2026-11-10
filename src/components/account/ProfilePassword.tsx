import { useState, type FormEvent } from "react";
import { Button } from "@/components/site/Button";
import { Field, PortalNotice } from "@/components/site/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";

function verificationClient() {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key || key.startsWith("sb_secret_")) throw new Error("Connexion indisponible");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "vyro-password-" + crypto.randomUUID(),
    },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
        if (key.startsWith("sb_publishable_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export function ProfilePassword({ userId }: { userId: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    if (next !== confirmation) {
      setError("Les deux nouveaux mots de passe doivent être identiques.");
      return;
    }
    if (!current || next.length < 12 || current === next) {
      setError("Choisissez un mot de passe différent, de 12 caractères minimum.");
      return;
    }
    setBusy(true);
    let verifier: ReturnType<typeof verificationClient> | undefined;
    let keepSession = false;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id !== userId || !user.email) {
        setError("Reconnectez-vous avant de modifier le mot de passe.");
        return;
      }
      verifier = verificationClient();
      const checked = await verifier.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (checked.error || checked.data.user?.id !== userId || !checked.data.session) {
        setError("Le mot de passe actuel n’a pas pu être vérifié.");
        return;
      }
      // Use the freshly verified session so a login in another tab cannot
      // redirect this password change to a different account.
      const { error } = await verifier.auth.updateUser({
        password: next,
        current_password: current,
      });
      if (error) {
        setError(
          "Impossible de modifier le mot de passe. Vérifiez le mot de passe actuel et choisissez un nouveau mot de passe.",
        );
      } else {
        try {
          const {
            data: { session: main },
          } = await supabase.auth.getSession();
          if (main?.user.id === userId) {
            const { error: transferError } = await supabase.auth.setSession({
              access_token: checked.data.session.access_token,
              refresh_token: checked.data.session.refresh_token,
            });
            keepSession = !transferError;
          }
        } catch {
          // The password already changed; the user can sign in with the new one.
        }
        setCurrent("");
        setNext("");
        setConfirmation("");
        setNotice(
          keepSession
            ? "Votre mot de passe a été mis à jour."
            : "Mot de passe mis à jour. Reconnectez-vous avec le nouveau mot de passe.",
        );
      }
    } catch {
      setError("Le service de connexion est indisponible.");
    } finally {
      if (verifier && !keepSession)
        void verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="portal-panel max-w-2xl space-y-4 p-5 sm:p-7"
      aria-busy={busy}
    >
      <h2 className="font-display text-xl font-semibold">Modifier le mot de passe</h2>
      <Field
        label="Mot de passe actuel"
        value={current}
        onChange={setCurrent}
        type="password"
        autoComplete="current-password"
        maxLength={256}
        required
      />
      <Field
        label="Nouveau mot de passe"
        value={next}
        onChange={setNext}
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={256}
        hint="12 caractères minimum."
        required
      />
      <Field
        label="Confirmer le nouveau mot de passe"
        value={confirmation}
        onChange={setConfirmation}
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={256}
        required
      />
      {error && <PortalNotice error>{error}</PortalNotice>}
      {notice && <PortalNotice>{notice}</PortalNotice>}
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Enregistrement…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
