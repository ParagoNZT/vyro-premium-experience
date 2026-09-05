import { createFileRoute } from "@tanstack/react-router";
import { Download, Tv, Flame } from "lucide-react";
import { Heading, Lead, Section } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/site/Button";
import { DOWNLOADS } from "@/config/site";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Télécharger VYRO Premium – Android TV, Google TV, Fire TV" },
      {
        name: "description",
        content:
          "Téléchargez VYRO Premium pour Android TV, Google TV et Amazon Fire TV : version, taille, date de mise à jour et instructions d'installation.",
      },
      { property: "og:title", content: "Télécharger VYRO Premium" },
      {
        property: "og:description",
        content: "Fichiers d'installation et guides pour Android TV, Google TV et Fire TV.",
      },
      { property: "og:url", content: "/download" },
    ],
    links: [{ rel: "canonical", href: "/download" }],
  }),
  component: DownloadPage,
});

const ICONS = { androidtv: Tv, firetv: Flame } as const;

function DownloadPage() {
  return (
    <Section className="pt-20 md:pt-28">
      <Reveal className="max-w-2xl">
        <Heading>Télécharger VYRO Premium.</Heading>
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

              <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Version</dt>
                  <dd className="mt-1 font-medium">{target.version}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Mise à jour</dt>
                  <dd className="mt-1 font-medium">{target.updatedAt}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Taille</dt>
                  <dd className="mt-1 font-medium">{target.size}</dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button to="/account" variant="primary" size="sm">
                  <Download className="h-4 w-4" aria-hidden />
                  Télécharger
                </Button>
                <span className="text-xs text-muted-foreground">{target.file}</span>
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

              <div className="mt-7 flex items-center gap-4 border-t border-border pt-6">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=1a1a1e&color=ffffff&data=${encodeURIComponent(
                    `https://vyro.premium/download#${target.id}`,
                  )}`}
                  alt={`QR code de téléchargement pour ${target.platform}`}
                  width={80}
                  height={80}
                  loading="lazy"
                  className="h-20 w-20 rounded-[8px]"
                />
                <p className="text-xs text-muted-foreground">
                  Scannez ce code depuis un téléphone pour ouvrir la page de téléchargement, ou
                  saisissez l'adresse directement sur votre téléviseur.
                </p>
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
