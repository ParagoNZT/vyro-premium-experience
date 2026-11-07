import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";
import { Field, PortalHeading, PortalNotice } from "@/components/site/AuthShell";

export const Route = createFileRoute("/account/profil")({
  head: () => ({
    meta: [{ title: "Mon profil – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameChanged = firstName.trim() !== user?.firstName;
  const emailChanged = email.trim() !== user?.email;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !user || (!nameChanged && !emailChanged)) return;
    setNotice("");
    setError("");
    if (!firstName.trim()) {
      setError("Renseignez votre prénom.");
      return;
    }
    setBusy(true);
    try {
      await updateProfile({
        ...(nameChanged ? { firstName: firstName.trim() } : {}),
        ...(emailChanged ? { email: email.trim() } : {}),
      });
      setNotice(
        emailChanged
          ? "Vérifiez votre boîte e-mail pour confirmer le changement d’adresse."
          : "Votre prénom a été mis à jour.",
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
    <div className="portal-enter">
      <PortalHeading label="VYRO / Profil" title="Mes informations">
        Gérez les informations utilisées pour votre compte.
      </PortalHeading>
      <form
        onSubmit={onSubmit}
        className="portal-panel mt-7 max-w-2xl space-y-5 p-5 sm:p-7"
        aria-busy={busy}
      >
        <Field
          label="Prénom"
          value={firstName}
          onChange={setFirstName}
          autoComplete="given-name"
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
      <div className="portal-panel mt-4 max-w-2xl space-y-3 p-5 sm:p-7">
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
