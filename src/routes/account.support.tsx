import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, LifeBuoy } from "lucide-react";
import { Button } from "@/components/site/Button";
import { PortalHeading } from "@/components/site/AuthShell";
import { SupportDesk } from "@/components/account/SupportDesk";

export const Route = createFileRoute("/account/support")({
  head: () => ({
    meta: [{ title: "Assistance client – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountSupportPage,
});

function AccountSupportPage() {
  return (
    <div className="portal-enter">
      <PortalHeading label="VYRO / Assistance" title="Comment pouvons-nous vous aider ?">
        Ouvrez une demande et suivez les réponses depuis votre compte.
      </PortalHeading>
      <SupportDesk />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="portal-panel portal-glow space-y-4 p-6">
          <LifeBuoy aria-hidden className="size-6 text-primary" />
          <h2 className="font-display text-xl font-semibold">Écrire à l’assistance</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Indiquez l’adresse de votre compte, votre appareil et le problème rencontré. N’incluez
            pas votre mot de passe ni votre clé de licence.
          </p>
          <a
            href="mailto:support@vyro-premium.app?subject=Assistance%20VYRO%20Premium"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/30 px-4 text-sm text-primary hover:border-primary"
          >
            Ouvrir mon application e-mail <ArrowUpRight aria-hidden className="size-4" />
          </a>
        </section>
        <section className="portal-panel space-y-4 p-6">
          <BookOpen aria-hidden className="size-6 text-primary" />
          <h2 className="font-display text-xl font-semibold">Consulter les guides</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Retrouvez les étapes pour installer le lecteur et connecter votre source.
          </p>
          <Button to="/support" size="sm" variant="secondary">
            Centre d’aide
          </Button>
        </section>
      </div>
    </div>
  );
}
