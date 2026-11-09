import { createFileRoute, Link } from "@tanstack/react-router";
import { Tv, MonitorPlay, Flame, Smartphone } from "lucide-react";
import { FinalCta, Lead, Section, Shot } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { captureCaption, homeCapture } from "@/components/site/captures";

export const Route = createFileRoute("/appareils")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Appareils compatibles – VYRO Premium" },
      {
        name: "description",
        content:
          "VYRO Premium fonctionne sur Android TV, Google TV, Amazon Fire TV, téléphone et tablette Android.",
      },
      { property: "og:title", content: "Appareils compatibles – VYRO Premium" },
      {
        property: "og:description",
        content:
          "Téléviseurs, boîtiers, téléphones et tablettes Android compatibles avec VYRO Premium.",
      },
      { property: "og:url", content: "/appareils" },
    ],
    links: [{ rel: "canonical", href: "/appareils" }],
  }),
  component: DevicesPage,
});

const DETAILS = [
  {
    icon: Tv,
    name: "Android TV",
    text: "Boîtiers Android TV, Nvidia Shield, box opérateurs compatibles et téléviseurs sous Android TV.",
  },
  {
    icon: MonitorPlay,
    name: "Google TV",
    text: "Chromecast avec Google TV, téléviseurs Sony, Philips, TCL et Hisense sous Google TV.",
  },
  {
    icon: Flame,
    name: "Amazon Fire TV",
    text: "Fire TV Stick, Fire TV Stick 4K, Fire TV Cube et téléviseurs intégrant Fire TV.",
  },
  {
    icon: Smartphone,
    name: "Android mobile et tablette",
    text: "Une interface tactile pour regarder votre direct, vos films et vos séries sur les téléphones et tablettes compatibles.",
  },
];

function DevicesPage() {
  return (
    <>
      <Section className="pb-0 pt-20 md:pt-28">
        <Reveal className="max-w-3xl">
          <p className="vyro-kicker">
            <i /> COMPATIBILITÉ
          </p>
          <h1 className="vyro-display-title">Du téléviseur au téléphone.</h1>
          <Lead className="mt-6 max-w-2xl">
            Utilisez la télécommande sur TV ou le tactile sur téléphone et tablette Android.
            Retrouvez vos réglages et votre profil sur vos appareils associés.
          </Lead>
        </Reveal>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DETAILS.map(({ icon: Icon, name, text }, i) => (
            <Reveal key={name} delay={i * 70} className="panel p-6">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-4 font-display text-lg font-medium">{name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120} className="relative mt-14">
          <div aria-hidden className="halo -inset-10 -z-10" />
          <Shot src={homeCapture} alt="Écran d’accueil de l’application sur un téléviseur" />
          <p className="vyro-capture-note">{captureCaption}</p>
        </Reveal>
        <Reveal className="mt-10">
          <Link
            to="/download"
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_22px_-14px_var(--primary)]"
          >
            Télécharger VYRO Premium
          </Link>
        </Reveal>
      </Section>

      <FinalCta />
    </>
  );
}
