import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { AuthShell, Field } from "@/components/site/AuthShell";

const searchSchema = z.object({
  redirect: z.string().optional(),
  plan: z.string().optional(),
});

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Créer un compte – VYRO Premium" },
      {
        name: "description",
        content: "Créez votre compte VYRO Premium pour activer votre accès et télécharger l'application sur votre téléviseur.",
      },
      { property: "og:title", content: "Créer un compte – VYRO Premium" },
      { property: "og:description", content: "Créez votre compte VYRO Premium en quelques secondes." },
      { property: "og:url", content: "/register" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/register" }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !email.includes("@") || password.length < 6) {
      setError("Renseignez un prénom, un e-mail valide et un mot de passe de 6 caractères minimum.");
      return;
    }
    setBusy(true);
    await signUp(firstName.trim(), email, password);
    setBusy(false);
    if (search.plan) navigate({ to: "/checkout", search: { plan: search.plan } });
    else navigate({ to: "/account" });
  }

  return (
    <AuthShell
      title="Créez votre compte VYRO."
      subtitle="Trois informations suffisent. Rien de plus."
      footer={
        <p className="text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link to="/login" search={search} className="text-primary hover:brightness-115">
            Se connecter
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Prénom" value={firstName} onChange={setFirstName} autoComplete="given-name" />
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
          autoComplete="new-password"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full rounded-[10px] bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-115 disabled:opacity-60"
        >
          {busy ? "Création…" : "Créer mon compte"}
        </button>
      </form>
    </AuthShell>
  );
}
