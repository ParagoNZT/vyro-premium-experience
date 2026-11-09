import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Flame,
  KeyRound,
  Monitor,
  Play,
  Tv2,
} from "lucide-react";
import { FaqSection, PricingSection } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { ScreeningRoom } from "@/components/site/ScreeningRoom";
import { scenes } from "@/components/site/captures";

const title = "VYRO Premium — La soirée est à vous";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      {
        name: "description",
        content:
          "VYRO Premium réunit votre direct, vos films et vos séries dans un lecteur conçu pour Android TV, Google TV et Fire TV.",
      },
      { property: "og:title", content: title },
      {
        property: "og:description",
        content: "Explorez les vrais écrans de VYRO Premium et choisissez votre accès.",
      },
      { property: "og:url", content: "https://vyro-player.app/" },
    ],
    links: [{ rel: "canonical", href: "https://vyro-player.app/" }],
  }),
  component: Home,
});

const platforms = [
  { label: "Android TV", icon: Tv2 },
  { label: "Google TV", icon: Monitor },
  { label: "Fire TV", icon: Flame },
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
    label: "Vérifiez votre télé",
    description: "Repérez votre téléviseur ou boîtier dans la liste des appareils compatibles.",
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
  return (
    <div className="screening-home">
      <section className="screening-hero" aria-labelledby="screening-title">
        <div className="screening-beams" aria-hidden />
        <div className="screening-hero-inner">
          <div className="screening-intro">
            <p className="screening-edition">
              <i aria-hidden /> LE LECTEUR POUR VOTRE TV
            </p>
            <h1 id="screening-title">
              La soirée <span>est à vous.</span>
            </h1>
            <p className="screening-lead">
              Votre direct, vos films et vos séries dans un lecteur pensé pour le grand écran et la
              télécommande.
            </p>
            <div className="screening-actions">
              <a className="screening-button screening-button-primary" href="#projection">
                <Play size={16} fill="currentColor" aria-hidden /> Voir VYRO en action
              </a>
              <Link className="screening-button screening-button-ghost" to="/tarifs">
                Choisir mon accès <ArrowUpRight size={17} aria-hidden />
              </Link>
            </div>
          </div>
          <ScreeningRoom />
        </div>
      </section>
      <section className="screening-devices" aria-label="Appareils compatibles">
        <div className="screening-wrap">
          <p className="screening-kicker">SUR VOTRE TÉLÉ</p>
          <ul>
            {platforms.map(({ label, icon: Icon }) => (
              <li key={label}>
                <Icon size={22} aria-hidden /> {label}
              </li>
            ))}
          </ul>
          <Link className="screening-text-link" to="/appareils">
            Vérifier mon appareil <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
      </section>
      <section
        id="experience"
        className="screening-wrap screening-section"
        aria-labelledby="screening-experience"
      >
        <Reveal className="screening-section-head">
          <div>
            <p className="screening-kicker">
              <span>01</span> / DANS LE LECTEUR
            </p>
            <h2 id="screening-experience">
              De la grille
              <br /> au <em>plein écran.</em>
            </h2>
          </div>
          <p>
            Retrouvez ce qui passe, parcourez vos titres et lancez la lecture depuis la même
            interface.
          </p>
        </Reveal>
        <div className="screening-features">
          {features.map(({ scene, title: featureTitle, description }, index) => (
            <Reveal key={scene.id} className="screening-feature" delay={index * 65}>
              <Link to="/fonctionnalites" hash={scene.id}>
                <div className="screening-feature-copy">
                  <p className="screening-kicker">
                    <scene.icon size={15} aria-hidden /> {scene.label}
                  </p>
                  <h3>{featureTitle}</h3>
                  <p>{description}</p>
                  <span className="screening-feature-arrow" aria-hidden>
                    <ArrowUpRight size={19} />
                  </span>
                </div>
                <div className="screening-feature-image">
                  <img
                    src={scene.image}
                    width={1600}
                    height={900}
                    alt={scene.alt}
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
                <span>02</span> / PREMIERS PAS
              </p>
              <h2 id="screening-start">VYRO sur votre télé.</h2>
            </div>
            <p>
              Vous apportez votre source compatible. VYRO s’occupe de la lecture et de la
              navigation.
            </p>
          </Reveal>
          <ol className="screening-steps">
            {steps.map(({ label, description, to, icon: Icon }, index) => (
              <Reveal as="li" key={to} delay={index * 65}>
                <Link to={to}>
                  <span className="screening-step-top">
                    <Icon size={23} aria-hidden /> <span aria-hidden>0{index + 1}</span>
                  </span>
                  <h3>{label}</h3>
                  <p>{description}</p>
                  <ArrowUpRight size={18} aria-hidden />
                </Link>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
      <div className="screening-pricing">
        <p className="screening-kicker screening-center-kicker">
          <span>03</span> / LES OFFRES
        </p>
        <PricingSection />
      </div>
      <div className="screening-help">
        <p className="screening-kicker screening-center-kicker">
          <span>04</span> / AIDE
        </p>
        <FaqSection compact />
        <Link className="screening-text-link screening-help-link" to="/support">
          Consulter le centre d’aide <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <section className="screening-wrap screening-end" aria-labelledby="screening-end-title">
        <Reveal className="screening-end-card">
          <div>
            <p className="screening-kicker">DÉJÀ CLIENT ?</p>
            <h2 id="screening-end-title">Votre accès, vos appareils.</h2>
          </div>
          <Link className="screening-button screening-button-primary" to="/account">
            Ouvrir mon espace <ArrowUpRight size={17} aria-hidden />
          </Link>
        </Reveal>
        <a className="screening-to-top screening-text-link" href="#main">
          Retour en haut <ArrowDown size={15} aria-hidden />
        </a>
      </section>
    </div>
  );
}
