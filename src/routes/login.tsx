import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";
import { AuthShell, Field } from "@/components/site/AuthShell";

const searchSchema = z.object({
  redirect: z.string().optional(),
  plan: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Connexion – VYRO Premium" },
      {
        name: "description",
        content: "Connectez-vous à votre espace client VYRO Premium pour gérer votre accès, vos appareils et vos téléchargements.",
      },
      { property: "og:title", content: "Connexion – VYRO Premium" },
      { property: "og:description", content: "Accédez à votre espace client VYRO Premium." },
      { property: "og:url", content: "/login" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@") || password.length < 6) {
      setError("Adresse e-mail ou mot de passe invalide.");
      return;
    }
    setBusy(true);
    await signIn(email, password);
    setBusy(false);
    if (search.plan) navigate({ to: "/checkout", search: { plan: search.plan } });
    else navigate({ to: "/account" });
  }

  return (
    <AuthShell
      title="Content de vous revoir."
      subtitle="Connectez-vous pour retrouver votre accès VYRO Premium."
      footer={
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/register" search={search} className="text-primary hover:brightness-115">
            Créer un compte
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Adresse e-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy} variant="primary" size="md" className="mt-2 w-full">
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </AuthShell>
  );
}
