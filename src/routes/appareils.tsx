import { createFileRoute, Link } from "@tanstack/react-router";
import { Tv, MonitorPlay, Flame } from "lucide-react";
import { DevicesSection, FinalCta, Heading, Lead, Section, Shot } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import uiHome from "@/assets/ui-home.jpg";

export const Route = createFileRoute("/appareils")({
  head: () => ({
    meta: [
      { title: "Appareils compatibles – VYRO Premium" },
      {
        name: "description",
        content:
          "VYRO Premium fonctionne sur Android TV, Google TV et Amazon Fire TV. Découvrez les appareils compatibles et les prérequis d'installation.",
      },
      { property: "og:title", content: "Appareils compatibles – VYRO Premium" },
      {
        property: "og:description",
        content: "Android TV, Google TV et Amazon Fire TV : les appareils compatibles VYRO Premium.",
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
];

function DevicesPage() {
  return (
    <>
      <Section className="pb-0 pt-20 md:pt-28">
        <Reveal className="max-w-3xl">
          <Heading>Une application, trois plateformes TV.</Heading>
          <Lead className="mt-6 max-w-2xl">
            VYRO Premium est conçu uniquement pour le grand écran. Aucune version mobile agrandie :
            chaque écran est dessiné pour la télécommande.
          </Lead>
        </Reveal>
        <div className="mt-12 grid gap-3 md:grid-cols-3">
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
          <Shot src={uiHome} alt="VYRO Premium affiché sur un téléviseur" />
        </Reveal>
        <Reveal className="mt-10">
          <Link
            to="/download"
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-115 hover:shadow-[0_0_28px_-8px_var(--primary)]"
          >
            Télécharger VYRO Premium
          </Link>
        </Reveal>
      </Section>

      <DevicesSection />
      <FinalCta />
    </>
  );
}
