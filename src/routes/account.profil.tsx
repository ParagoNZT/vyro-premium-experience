import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";
import { Field, PortalHeading, PortalNotice } from "@/components/site/AuthShell";
import { PrivateInbox } from "@/components/account/PrivateInbox";
import { ProfilePassword } from "@/components/account/ProfilePassword";

export const Route = createFileRoute("/account/profil")({
  head: () => ({
    meta: [{ title: "Mon profil – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  return user ? <ProfileContent key={user.id} userId={user.id} /> : null;
}

function ProfileContent({ userId }: { userId: string }) {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user?.firstName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameChanged = username.trim() !== user?.firstName;
  const emailChanged = email.trim() !== user?.email;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !user || (!nameChanged && !emailChanged)) return;
    setNotice("");
    setError("");
    if (!username.trim()) {
      setError("Renseignez votre nom d’utilisateur.");
      return;
    }
    setBusy(true);
    try {
      await updateProfile({
        ...(nameChanged ? { firstName: username.trim() } : {}),
        ...(emailChanged ? { email: email.trim() } : {}),
      });
      setNotice(
        emailChanged
          ? "Vérifiez votre boîte e-mail pour confirmer le changement d’adresse."
          : "Votre nom d’utilisateur a été mis à jour.",
      );
    } catch (issue) {
      setError(
        issue instanceof Error && !(issue instanceof TypeError)
          ? issue.message
          : "Modification impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-enter space-y-5">
      <PortalHeading label="VYRO / Profil" title="Mon profil">
        Gérez votre nom d’utilisateur, votre adresse e-mail, votre mot de passe et vos messages.
      </PortalHeading>
      <form
        onSubmit={onSubmit}
        className="portal-panel max-w-2xl space-y-5 p-5 sm:p-7"
        aria-busy={busy}
      >
        <h2 className="font-display text-xl font-semibold">Informations du compte</h2>
        <Field
          label="Nom d’utilisateur"
          value={username}
          onChange={setUsername}
          autoComplete="nickname"
          required
          maxLength={80}
        />
        <Field
          label="Adresse e-mail"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          hint="Un changement d’adresse peut nécessiter une confirmation par e-mail."
        />
        {notice && <PortalNotice>{notice}</PortalNotice>}
        {error && <PortalNotice error>{error}</PortalNotice>}
        <Button type="submit" size="sm" disabled={busy || (!nameChanged && !emailChanged)}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
      <ProfilePassword userId={userId} />
      <PrivateInbox />
      <div className="portal-panel max-w-2xl space-y-3 p-5 sm:p-7">
        <h2 className="font-display text-lg font-semibold">Besoin d’aide avec votre compte ?</h2>
        <p className="text-sm text-muted-foreground">
          Le lien « Mot de passe oublié ? » se trouve sur la page de connexion.
        </p>
        <Button to="/account/support" variant="secondary" size="sm">
          Contacter l’assistance
        </Button>
      </div>
    </div>
  );
}
