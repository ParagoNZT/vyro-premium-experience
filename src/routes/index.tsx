import { siteOrigin, useCopy } from "@/lib/site-language";
import { homeDescription, homeTitle, publicPageHead } from "@/lib/site-seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Flame,
  KeyRound,
  Monitor,
  Play,
  Smartphone,
  Tv2,
} from "lucide-react";
import { FaqSection, PricingSection } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { ProductDemo, ProductDemoTranscript } from "@/components/site/ProductDemo";
import demoStyles from "@/components/site/product-demo.css?url";
import { ScreeningRoom } from "@/components/site/ScreeningRoom";
import { DeviceHandoff } from "@/components/site/DeviceHandoff";
import handoffStyles from "@/components/site/device-handoff.css?url";
import { WorkspaceSpotlight } from "@/components/site/WorkspaceSpotlight";
import { SportsSpotlight } from "@/components/site/SportsSpotlight";
import { scenes } from "@/components/site/captures";

export const Route = createFileRoute("/")({
  head: ({ match }) => {
    const head = publicPageHead("/", match.context.language, homeTitle, homeDescription);
    return {
      ...head,
      links: [
        ...head.links,
        { rel: "stylesheet", href: handoffStyles },
        { rel: "stylesheet", href: demoStyles },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "VYRO Premium",
            alternateName: "VYRO",
            url: siteOrigin + "/",
          }),
        },
      ],
    };
  },
  component: Home,
});

const platforms = [
  { label: "Android TV", icon: Tv2 },
  { label: "Google TV", icon: Monitor },
  { label: "Fire TV", icon: Flame },
  { label: "Android mobile et tablette", icon: Smartphone },
] as const;

const features = [
  {
    scene: scenes[1],
    title: "Le direct, avec son programme.",
    description:
      "Parcourez vos chaînes, ouvrez un aperçu et voyez le programme en cours depuis le même écran.",
  },
  {
    scene: scenes[2],
    title: "Choisissez le bon titre.",
    description: "Retrouvez le synopsis, les saisons et les épisodes avant de lancer la lecture.",
  },
  {
    scene: scenes[3],
    title: "Laissez la place à l’image.",
    description:
      "Passez en plein écran et gardez le son, les sous-titres et les commandes à portée de télécommande.",
  },
] as const;

const steps = [
  {
    label: "Vérifiez votre appareil",
    description: "Vérifiez que votre téléviseur, téléphone ou tablette est compatible.",
    to: "/appareils",
    icon: Monitor,
  },
  {
    label: "Choisissez votre accès",
    description: "Retrouvez les durées de licence et gérez votre accès depuis votre compte.",
    to: "/tarifs",
    icon: KeyRound,
  },
  {
    label: "Connectez votre source",
    description: "Suivez le guide d’installation et ajoutez votre propre source multimédia à VYRO.",
    to: "/download",
    icon: Play,
  },
] as const;

function Home() {
  const t = useCopy();
  return (
    <div className="screening-home">
      <section className="screening-hero" aria-labelledby="screening-title">
        <div className="screening-beams" aria-hidden />
        <div className="screening-hero-inner">
          <div className="screening-intro">
            <p className="screening-edition">
              <i aria-hidden /> {t("SUR TV, TÉLÉPHONE ET TABLETTE")}
            </p>
            <h1 id="screening-title">
              {t("La soirée")} <span>{t("est à vous.")}</span>
            </h1>
            <p className="screening-lead">
              {t(
                "Votre direct, vos films et vos séries sur le grand écran, votre téléphone et votre tablette Android.",
              )}
            </p>
            <div className="screening-actions">
              <ProductDemo />
              <Link className="screening-button screening-button-ghost" to="/tarifs">
                {t("Choisir mon accès")} <ArrowUpRight size={17} aria-hidden />
              </Link>
            </div>
            <a href="#synchronisation" className="screening-text-link">
              {t("Synchronisation et gestion à distance")} <ArrowDown size={16} aria-hidden />
            </a>
          </div>
          <ScreeningRoom />
          <ProductDemoTranscript />
        </div>
      </section>
      <section className="screening-devices" aria-label={t("Appareils compatibles")}>
        <div className="screening-wrap">
          <p className="screening-kicker">{t("SUR VOS APPAREILS")}</p>
          <ul>
            {platforms.map(({ label, icon: Icon }) => (
              <li key={t(label)}>
                <Icon size={22} aria-hidden /> {t(label)}
              </li>
            ))}
          </ul>
          <Link className="screening-text-link" to="/appareils">
            {t("Vérifier mon appareil")} <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
      </section>
      <DeviceHandoff />
      <WorkspaceSpotlight />
      <SportsSpotlight />
      <section
        id="experience"
        className="screening-wrap screening-section"
        aria-labelledby="screening-experience"
      >
        <Reveal className="screening-section-head">
          <div>
            <p className="screening-kicker">
              <span>01</span> {t("/ DANS LE LECTEUR")}
            </p>
            <h2 id="screening-experience">
              {t("De la grille")}
              <br /> {t("au")} <em>{t("plein écran.")}</em>
            </h2>
          </div>
          <p>
            {t(
              "Retrouvez ce qui passe, parcourez vos titres et lancez la lecture depuis la même interface.",
            )}
          </p>
        </Reveal>
        <div className="screening-features">
          {features.map(({ scene, title: featureTitle, description }, index) => (
            <Reveal key={scene.id} className="screening-feature" delay={index * 65}>
              <Link to="/fonctionnalites" hash={scene.id}>
                <div className="screening-feature-copy">
                  <p className="screening-kicker">
                    <scene.icon size={15} aria-hidden /> {t(scene.label)}
                  </p>
                  <h3>{t(featureTitle)}</h3>
                  <p>{t(description)}</p>
                  <span className="screening-feature-arrow" aria-hidden>
                    <ArrowUpRight size={19} />
                  </span>
                </div>
                <div className="screening-feature-image">
                  <img
                    src={scene.image}
                    width={1600}
                    height={900}
                    alt={t(scene.alt)}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="screening-onboard" aria-labelledby="screening-start">
        <div className="screening-wrap screening-section">
          <Reveal className="screening-section-head">
            <div>
              <p className="screening-kicker">
                <span>02</span> {t("/ PREMIERS PAS")}
              </p>
              <h2 id="screening-start">{t("VYRO sur votre télé.")}</h2>
            </div>
            <p>
              {t(
                "Vous apportez votre source compatible. VYRO s’occupe de la lecture et de la navigation.",
              )}
            </p>
          </Reveal>
          <ol className="screening-steps">
            {steps.map(({ label, description, to, icon: Icon }, index) => (
              <Reveal as="li" key={to} delay={index * 65}>
                <Link to={to}>
                  <span className="screening-step-top">
                    <Icon size={23} aria-hidden /> <span aria-hidden>0{index + 1}</span>
                  </span>
                  <h3>{t(label)}</h3>
                  <p>{t(description)}</p>
                  <ArrowUpRight size={18} aria-hidden />
                </Link>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
      <div className="screening-pricing">
        <p className="screening-kicker screening-center-kicker">
          <span>03</span> {t("/ LES OFFRES")}
        </p>
        <PricingSection />
      </div>
      <div className="screening-help">
        <p className="screening-kicker screening-center-kicker">
          <span>04</span> {t("/ AIDE")}
        </p>
        <FaqSection compact />
        <Link className="screening-text-link screening-help-link" to="/support">
          {t("Consulter le centre d’aide")} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <section className="screening-wrap screening-end" aria-labelledby="screening-end-title">
        <Reveal className="screening-end-card">
          <div>
            <p className="screening-kicker">{t("DÉJÀ CLIENT ?")}</p>
            <h2 id="screening-end-title">{t("Votre accès, vos appareils.")}</h2>
          </div>
          <Link className="screening-button screening-button-primary" to="/account">
            {t("Ouvrir mon espace")} <ArrowUpRight size={17} aria-hidden />
          </Link>
        </Reveal>
        <a className="screening-to-top screening-text-link" href="#main">
          {t("Retour en haut")} <ArrowDown size={15} aria-hidden />
        </a>
      </section>
    </div>
  );
}
