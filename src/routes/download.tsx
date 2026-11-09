import { createFileRoute } from "@tanstack/react-router";
import { Download, Tv, Flame, Smartphone } from "lucide-react";
import { Lead, Section } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/site/Button";
import { DOWNLOADS } from "@/config/site";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Télécharger VYRO Premium – Android mobile, Android TV et Fire TV" },
      {
        name: "description",
        content:
          "Fichiers et instructions d’installation pour téléphone ou tablette Android, Android TV, Google TV et Amazon Fire TV.",
      },
      { property: "og:title", content: "Télécharger VYRO Premium" },
      {
        property: "og:description",
        content:
          "Fichiers d’installation et guides pour Android mobile, Android TV, Google TV et Fire TV.",
      },
      { property: "og:url", content: "/download" },
    ],
    links: [{ rel: "canonical", href: "/download" }],
  }),
  component: DownloadPage,
});

const ICONS = { androidmobile: Smartphone, androidtv: Tv, firetv: Flame } as const;

function DownloadPage() {
  return (
    <Section className="pt-20 md:pt-28">
      <Reveal className="max-w-2xl">
        <p className="vyro-kicker">
          <i /> INSTALLATION
        </p>
        <h1 className="vyro-display-title">Télécharger VYRO Premium.</h1>
        <Lead className="mt-5">
          Choisissez votre plateforme. Le téléchargement et l'activation nécessitent un compte VYRO
          avec un accès valide.
        </Lead>
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        {DOWNLOADS.map((target, i) => {
          const Icon = ICONS[target.id as keyof typeof ICONS] ?? Tv;
          return (
            <Reveal key={target.id} delay={i * 80} className="panel flex flex-col p-7">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-medium">{target.platform}</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">{target.subtitle}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button to="/account/telechargement" variant="primary" size="sm">
                  <Download className="h-4 w-4" aria-hidden />
                  Accéder au téléchargement
                </Button>
              </div>

              <div className="mt-7 border-t border-border pt-6">
                <p className="text-sm font-medium">Installation</p>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {target.steps.map((step, idx) => (
                    <li key={step} className="flex gap-3">
                      <span className="text-primary">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        VYRO Premium ne fournit aucun contenu. Une source compatible que vous êtes autorisé à
        utiliser est nécessaire.
      </p>
    </Section>
  );
}
