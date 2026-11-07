import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUpRight, Flame, Monitor, Tv2 } from "lucide-react";
import { FaqSection, PricingSection } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { Showcase } from "@/components/site/Showcase";
import { scenes } from "@/components/site/captures";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VYRO Premium — Votre TV. À votre façon." },
      {
        name: "description",
        content:
          "VYRO Premium organise votre direct, vos films et vos séries dans un lecteur conçu pour Android TV, Google TV et Fire TV.",
      },
      { property: "og:title", content: "VYRO Premium — Votre TV. À votre façon." },
      {
        property: "og:description",
        content: "Découvrez les vrais écrans du lecteur et choisissez votre accès VYRO Premium.",
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

const steps = [
  {
    label: "Vérifiez votre appareil",
    description: "Android TV, Google TV ou Fire TV.",
    to: "/appareils",
  },
  {
    label: "Choisissez votre accès",
    description: "Sélectionnez la durée qui vous convient.",
    to: "/tarifs",
  },
  {
    label: "Installez et connectez votre source",
    description: "Suivez le guide d’installation de votre appareil.",
    to: "/download",
  },
] as const;

function Home() {
  return (
    <>
      <section className="vyro-hero" aria-labelledby="hero-title">
        <div className="vyro-hero-texture" aria-hidden />
        <div className="vyro-wrap vyro-hero-grid">
          <div className="vyro-hero-copy">
            <p className="vyro-kicker">
              <i /> LE LECTEUR POUR VOTRE TÉLÉ
            </p>
            <h1 id="hero-title" className="vyro-hero-title">
              Votre TV.
              <br />
              <span>À votre façon.</span>
            </h1>
            <p className="vyro-hero-lead">
              Le direct, vos films et vos séries dans un lecteur pensé pour le grand écran et la
              télécommande.
            </p>
            <div className="vyro-hero-actions">
              <Link className="vyro-cta" to="/tarifs">
                Choisir mon accès <ArrowUpRight size={18} aria-hidden />
              </Link>
              <a className="vyro-cta vyro-cta-outline" href="#experience">
                Découvrir <ArrowDown size={17} aria-hidden />
              </a>
            </div>
          </div>
          <Showcase />
        </div>
        <div className="vyro-wrap">
          <div className="vyro-compat">
            <span className="vyro-kicker">COMPATIBLE AVEC</span>
            <ul>
              {platforms.map(({ label, icon: Icon }) => (
                <li key={label}>
                  <Icon size={20} aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
            <Link to="/appareils">
              Vérifier mon appareil <ArrowUpRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section id="experience" className="vyro-wrap vyro-block">
        <Reveal className="vyro-section-head">
          <div>
            <p className="vyro-kicker">
              <i /> 01 / L’APPLICATION
            </p>
            <h2 className="vyro-display-title">Du direct au cinéma.</h2>
          </div>
          <p>
            Retrouvez les programmes du moment, parcourez vos titres et lancez la lecture depuis la
            même interface.
          </p>
        </Reveal>
        <div className="vyro-feature-grid">
          {[scenes[1], scenes[2], scenes[3]].map(
            ({ id, label, name, image, alt, icon: Icon }, index) => (
              <Reveal key={id} delay={index * 55} className="vyro-feature-card">
                <Link to="/fonctionnalites" hash={id}>
                  <div className="vyro-feature-image">
                    <img
                      src={image}
                      alt={alt}
                      width={1600}
                      height={900}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="vyro-feature-content">
                    <span className="vyro-kicker">
                      <Icon size={15} aria-hidden /> {label}
                    </span>
                    <h3>{name}</h3>
                    <ArrowUpRight className="vyro-feature-arrow" size={19} aria-hidden />
                  </div>
                </Link>
              </Reveal>
            ),
          )}
        </div>
      </section>

      <section className="vyro-steps">
        <div className="vyro-wrap vyro-block vyro-steps-grid">
          <Reveal>
            <p className="vyro-kicker">
              <i /> 02 / PREMIERS PAS
            </p>
            <h2 className="vyro-display-title">Prêt pour ce soir.</h2>
            <p>
              La licence donne accès au lecteur VYRO. Vous y connectez une source compatible que
              vous êtes autorisé à utiliser.
            </p>
            <Link className="vyro-inline-link" to="/support">
              Consulter le centre d’aide <ArrowRight size={17} aria-hidden />
            </Link>
          </Reveal>
          <ol>
            {steps.map(({ label, description, to }, index) => (
              <li key={to}>
                <Link to={to}>
                  <span className="vyro-step-number">0{index + 1}</span>
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowUpRight size={20} aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <PricingSection />
      <FaqSection compact />
      <section className="vyro-wrap vyro-last">
        <Reveal className="vyro-last-panel">
          <div>
            <p className="vyro-kicker">
              <i /> DÉJÀ CLIENT ?
            </p>
            <h2 className="vyro-display-title">Retrouvez votre accès.</h2>
          </div>
          <Link className="vyro-cta" to="/account">
            Ouvrir mon espace <ArrowUpRight size={18} aria-hidden />
          </Link>
        </Reveal>
      </section>
    </>
  );
}
