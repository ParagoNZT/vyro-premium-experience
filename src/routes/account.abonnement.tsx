import { createFileRoute, Link } from "@tanstack/react-router";
import { PLANS, formatPrice } from "@/config/site";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/account/abonnement")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user } = useAuth();
  const sub = user?.subscription ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Mon abonnement</h1>

      <div className="panel mt-8 p-7">
        {sub ? (
          <dl className="grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Offre</dt>
              <dd className="mt-1.5 text-sm font-medium">{sub.planName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Statut</dt>
              <dd className="mt-1.5 text-sm font-medium text-primary">
                {sub.status === "active" ? "Actif" : "Inactif"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Expiration</dt>
              <dd className="mt-1.5 text-sm font-medium">
                {new Date(sub.expiresAt).toLocaleDateString("fr-FR")}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun accès actif sur ce compte pour le moment.
          </p>
        )}
      </div>

      <h2 className="mt-12 font-display text-lg font-medium">Prolonger votre accès</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Link
            key={plan.id}
            to="/checkout"
            search={{ plan: plan.id }}
            className="panel p-6 transition-colors duration-150 hover:border-primary/40"
          >
            <p className="text-sm font-medium">{plan.name}</p>
            <p className="mt-3 font-display text-2xl">{formatPrice(plan.price)}</p>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Le renouvellement prolonge la validité de votre licence VYRO Premium. Aucun contenu
        audiovisuel n'est inclus.
      </p>
    </div>
  );
}
