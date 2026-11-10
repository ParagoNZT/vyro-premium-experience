import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { FeatureRow, FinalCta, IntegrationsSection } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { WorkspaceSpotlight } from "@/components/site/WorkspaceSpotlight";
import { PlaybackSpotlight } from "@/components/site/PlaybackSpotlight";
import { SportsSpotlight } from "@/components/site/SportsSpotlight";
import { captureCaption, homeCapture, scenes } from "@/components/site/captures";

export const Route = createFileRoute("/fonctionnalites")({
  head: () => ({
    meta: [
      { title: "L’application – VYRO Premium" },
      {
        name: "description",
        content:
          "Explorez Sports, les réglages d’image et de son, la synchronisation entre appareils et la gestion des playlists et sauvegardes avec VYRO.",
      },
      { property: "og:url", content: "https://vyro-player.app/fonctionnalites" },
    ],
    links: [{ rel: "canonical", href: "https://vyro-player.app/fonctionnalites" }],
  }),
  component: FeaturesPage,
});

const content = [
  {
    title: "Une bibliothèque à parcourir à la télécommande.",
    description:
      "Vos films et séries s’affichent avec leurs visuels et leurs informations pour choisir plus facilement quoi regarder.",
    points: ["Affiches et synopsis", "Favoris et historique", "Saisons et épisodes", "Recherche"],
  },
  {
    title: "Le programme au même endroit que le direct.",
    description:
      "Parcourez vos catégories et vos chaînes, affichez un aperçu et voyez le programme en cours avec un guide compatible.",
    points: [
      "Aperçu des chaînes",
      "Programme en cours et à venir",
      "Guide TV avec EPG compatible",
      "Navigation à la télécommande",
    ],
  },
  {
    title: "Les détails avant d’appuyer sur Lecture.",
    description:
      "Retrouvez le synopsis et les informations disponibles pour un titre. Les fiches sont enrichies par les services de métadonnées compatibles.",
    points: [
      "Fiche par titre",
      "Casting et notes selon disponibilité",
      "Choix des épisodes",
      "Accès à la lecture",
    ],
  },
  {
    title: "Vos commandes, en plein écran.",
    description:
      "Réglez le son, les sous-titres et le format d’image sans quitter la lecture. Reprenez là où vous vous êtes arrêté sur les contenus compatibles.",
    points: ["Pistes audio", "Sous-titres", "Format d’image", "Reprise de lecture"],
  },
];

function FeaturesPage() {
  return (
    <>
      <section className="vyro-subhero screening-feature-intro">
        <div className="vyro-wrap vyro-block screening-inner-grid">
          <div>
            <p className="vyro-kicker">
              <i /> L’APPLICATION
            </p>
            <h1 className="vyro-display-title">Dans l’écran de VYRO.</h1>
            <p className="vyro-subhero-lead">
              Explorez les vrais écrans du lecteur et découvrez comment retrouver vos réglages d’un
              appareil à l’autre.
            </p>
            <nav aria-label="Écrans à découvrir" className="vyro-section-links">
              <a href="#espace-client">
                Gestion à distance <ArrowUpRight size={15} aria-hidden />
              </a>
              <a href="#sports">
                Sports <ArrowUpRight size={15} aria-hidden />
              </a>
              <a href="#reglages-lecture">
                Image et son <ArrowUpRight size={15} aria-hidden />
              </a>
              {scenes.map(({ id, label }) => (
                <a key={id} href={"#" + id}>
                  {label} <ArrowUpRight size={15} aria-hidden />
                </a>
              ))}
            </nav>
          </div>
          <figure>
            <img
              src={homeCapture}
              alt="Écran d’accueil de VYRO sur téléviseur"
              width={1600}
              height={900}
              fetchPriority="high"
              decoding="async"
            />
            <figcaption>{captureCaption}</figcaption>
          </figure>
        </div>
      </section>
      <WorkspaceSpotlight detailed />
      <SportsSpotlight detailed />
      <div className="vyro-wrap vyro-block vyro-detail-scenes">
        {scenes.map(({ id, label, image, alt }, index) => {
          const details = content[index];
          if (!details) return null;
          return (
            <section id={id} className="vyro-detail-scene" key={id}>
              <FeatureRow
                eyebrow={"0" + (index + 1) + " / " + label}
                {...details}
                image={image}
                alt={alt}
                reversed={index % 2 === 1}
              />
            </section>
          );
        })}
        <p className="vyro-capture-note">{captureCaption}</p>
      </div>
      <section className="vyro-steps">
        <div className="vyro-wrap vyro-block vyro-profile-feature">
          <Reveal>
            <p className="vyro-kicker">
              <i /> PROFILS
            </p>
            <h2 className="vyro-display-title">Chacun son écran d’accueil.</h2>
            <p className="vyro-subhero-lead">
              Chaque profil retrouve ses favoris et son historique. Trakt peut synchroniser votre
              progression lorsque vous le connectez.
            </p>
            <Link to="/appareils" className="vyro-inline-link">
              Vérifier mon appareil <ArrowUpRight size={16} aria-hidden />
            </Link>
          </Reveal>
          <figure className="vyro-feature-image">
            <img
              src={homeCapture}
              width={1600}
              height={900}
              alt="Écran d’accueil de l’application avec menu, bibliothèque et accès à Mon profil"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
      </section>
      <PlaybackSpotlight />
      <IntegrationsSection />
      <FinalCta />
    </>
  );
}
