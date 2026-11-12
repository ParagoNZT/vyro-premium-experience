import { useCopy } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Tv, MonitorPlay, Flame, Smartphone } from "lucide-react";
import { FinalCta, Lead, Section, Shot } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { captureCaption, homeCapture } from "@/components/site/captures";

export const Route = createFileRoute("/appareils")({
  head: ({ match }) => {
    const head = publicPageHead(
      "/appareils",
      match.context.language,
      "Appareils compatibles – VYRO Premium",
      "VYRO Premium fonctionne sur Android TV, Google TV, Amazon Fire TV, téléphone et tablette Android.",
    );
    return {
      ...head,
      meta: [
        ...head.meta,
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
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
  const t = useCopy();
  return (
    <>
      <Section className="pb-0 pt-20 md:pt-28">
        <Reveal className="max-w-3xl">
          <p className="vyro-kicker">
            <i /> {t("COMPATIBILITÉ")}
          </p>
          <h1 className="vyro-display-title">{t("Du téléviseur au téléphone.")}</h1>
          <Lead className="mt-6 max-w-2xl">
            {t(
              "Utilisez la télécommande sur TV ou le tactile sur téléphone et tablette Android. Retrouvez vos réglages et votre profil sur vos appareils associés.",
            )}
          </Lead>
        </Reveal>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DETAILS.map(({ icon: Icon, name, text }, i) => (
            <Reveal key={t(name)} delay={i * 70} className="panel p-6">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-4 font-display text-lg font-medium">{t(name)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(text)}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120} className="relative mt-14">
          <div aria-hidden className="halo -inset-10 -z-10" />
          <Shot src={homeCapture} alt={t("Écran d’accueil de l’application sur un téléviseur")} />
          <p className="vyro-capture-note">{t(captureCaption)}</p>
        </Reveal>
        <Reveal className="mt-10">
          <Link
            to="/download"
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_22px_-14px_var(--primary)]"
          >
            {t("Télécharger VYRO Premium")}
          </Link>
        </Reveal>
      </Section>

      <FinalCta />
    </>
  );
}
