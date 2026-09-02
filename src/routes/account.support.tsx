import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/account/support")({
  component: AccountSupportPage,
});

function AccountSupportPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Support</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Une question sur l'installation, la lecture ou votre abonnement ?
      </p>
      <div className="panel mt-8 p-7">
        <p className="text-sm">
          Écrivez à <span className="text-primary">support@vyro-premium.app</span> en indiquant
          l'adresse e-mail de votre compte, votre appareil et une description du problème.
        </p>
        <Link
          to="/support"
          className="mt-6 inline-flex rounded-[10px] bg-surface-2 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
        >
          Ouvrir le centre d'aide
        </Link>
      </div>
    </div>
  );
}
