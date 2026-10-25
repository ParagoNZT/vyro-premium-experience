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

  useEffect(() => {
    setFirstName(user?.firstName ?? "");
    setEmail(user?.email ?? "");
  }, [user?.firstName, user?.email]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !email.includes("@")) return;
    updateProfile({ firstName: firstName.trim(), email: email.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          <Button type="submit" variant="primary" size="sm">
            Enregistrer
          </Button>
          {saved ? <span className="text-sm text-primary">Modifications enregistrées.</span> : null}
        </div>
      </form>

      <div className="panel mt-4 p-7">
        <p className="text-sm font-medium">Clé de licence</p>
        <code className="mt-3 inline-block rounded-[8px] border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm tracking-wider">
          {user?.licenseKey}
        </code>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Pour changer votre mot de passe ou supprimer votre compte, contactez le support.
      </p>
    </div>
  );
}
