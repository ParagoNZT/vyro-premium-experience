import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/account/profil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Compte</h1>
      <div className="panel mt-8 p-7">
        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Prénom</dt>
            <dd className="mt-1.5 text-sm font-medium">{user?.firstName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Adresse e-mail</dt>
            <dd className="mt-1.5 truncate text-sm font-medium">{user?.email}</dd>
          </div>
        </dl>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Pour modifier votre adresse e-mail ou supprimer votre compte, contactez le support.
      </p>
    </div>
  );
}
