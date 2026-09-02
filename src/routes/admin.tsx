import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Espace d'administration — réservé, non listé dans la navigation publique.
 * Les écrans (utilisateurs, licences, abonnements, appareils, plans, paiements,
 * codes promo, versions APK, annonces, FAQ, tickets) seront ajoutés ici une fois
 * le backend et le contrôle de rôle serveur en place.
 */
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administration – VYRO Premium" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLayout,
});

const MODULES = [
  "Utilisateurs",
  "Licences",
  "Abonnements",
  "Appareils",
  "Plans tarifaires",
  "Paiements",
  "Codes promotionnels",
  "Versions de l'application",
  "Liens APK",
  "Annonces",
  "FAQ",
  "Tickets support",
];

function AdminLayout() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-20 md:px-8">
      <h1 className="font-display text-2xl font-semibold">Administration VYRO</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Espace réservé. Les modules ci-dessous seront activés une fois le backend et le contrôle des
        rôles côté serveur en place.
      </p>
      <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module) => (
          <li key={module} className="panel px-4 py-3 text-sm text-muted-foreground">
            {module}
          </li>
        ))}
      </ul>
      <Outlet />
    </div>
  );
}
