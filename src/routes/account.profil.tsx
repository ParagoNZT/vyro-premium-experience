import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";
import { Field } from "@/components/site/AuthShell";

export const Route = createFileRoute("/account/profil")({
  head: () => ({ meta: [
    { title: "Mon profil – VYRO Premium" },
    { name: "description", content: "Vos informations de compte VYRO Premium." },
    { property: "og:title", content: "Mon profil – VYRO Premium" },
    { property: "og:description", content: "Vos informations de compte VYRO Premium." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFirstName(user?.firstName ?? "");
    setEmail(user?.email ?? "");
  }, [user?.firstName, user?.email]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !email.includes("@")) return;
    setError(""); setSaved(false); setBusy(true);
    try {
      await updateProfile({ firstName: firstName.trim(), ...(email.trim() !== user?.email ? { email: email.trim() } : {}) });
      setSaved(true);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Compte</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Vos informations de compte VYRO Premium.
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 p-7">
        <Field label="Prénom" value={firstName} onChange={setFirstName} autoComplete="given-name" />
        <Field
          label="Adresse e-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            Enregistrer
          </Button>
          {saved ? <span role="status" className="text-sm text-primary">Profil enregistré. Si vous changez d’adresse, confirmez les e-mails reçus.</span> : null}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>

      <div className="panel mt-4 p-7">
        <p className="text-sm font-medium">Clé de licence</p>
        <code className="mt-3 inline-block rounded-[8px] border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm tracking-wider">
          {user?.licenseKey || "Aucune licence attribuée"}
        </code>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Pour changer votre mot de passe ou supprimer votre compte, contactez le support.
      </p>
    </div>
  );
}
