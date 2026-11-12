import { useCopy } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { FeatureRow, FinalCta, IntegrationsSection } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import { WorkspaceSpotlight } from "@/components/site/WorkspaceSpotlight";
import { PlaybackSpotlight } from "@/components/site/PlaybackSpotlight";
import { SportsSpotlight } from "@/components/site/SportsSpotlight";
import { captureCaption, homeCapture, scenes } from "@/components/site/captures";

export const Route = createFileRoute("/fonctionnalites")({
  head: ({ match }) =>
    publicPageHead(
      "/fonctionnalites",
      match.context.language,
      "L’application – VYRO Premium",
      "Explorez Sports, les réglages d’image et de son, la synchronisation entre appareils et la gestion des playlists et sauvegardes avec VYRO.",
    ),
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
  const t = useCopy();
  return (
    <>
      <section className="vyro-subhero screening-feature-intro">
        <div className="vyro-wrap vyro-block screening-inner-grid">
          <div>
            <p className="vyro-kicker">
              <i /> {t("L’APPLICATION")}
            </p>
            <h1 className="vyro-display-title">{t("Dans l’écran de VYRO.")}</h1>
            <p className="vyro-subhero-lead">
              {t(
                "Explorez les vrais écrans du lecteur et découvrez comment retrouver vos réglages d’un appareil à l’autre.",
              )}
            </p>
            <nav aria-label={t("Écrans à découvrir")} className="vyro-section-links">
              <a href="#espace-client">
                {t("Gestion à distance")} <ArrowUpRight size={15} aria-hidden />
              </a>
              <a href="#sports">
                Sports <ArrowUpRight size={15} aria-hidden />
              </a>
              <a href="#reglages-lecture">
                {t("Image et son")} <ArrowUpRight size={15} aria-hidden />
              </a>
              {scenes.map(({ id, label }) => (
                <a key={id} href={"#" + id}>
                  {t(label)} <ArrowUpRight size={15} aria-hidden />
                </a>
              ))}
            </nav>
          </div>
          <figure>
            <img
              src={homeCapture}
              alt={t("Écran d’accueil de VYRO sur téléviseur")}
              width={1600}
              height={900}
              fetchPriority="high"
              decoding="async"
            />
            <figcaption>{t(captureCaption)}</figcaption>
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
                eyebrow={"0" + (index + 1) + " / " + t(label)}
                title={t(details.title)}
                description={t(details.description)}
                points={details.points.map(t)}
                image={image}
                alt={t(alt)}
                reversed={index % 2 === 1}
              />
            </section>
          );
        })}
        <p className="vyro-capture-note">{t(captureCaption)}</p>
      </div>
      <section className="vyro-steps">
        <div className="vyro-wrap vyro-block vyro-profile-feature">
          <Reveal>
            <p className="vyro-kicker">
              <i /> {t("PROFILS")}
            </p>
            <h2 className="vyro-display-title">{t("Chacun son écran d’accueil.")}</h2>
            <p className="vyro-subhero-lead">
              {t(
                "Chaque profil retrouve ses favoris et son historique. Trakt peut synchroniser votre progression lorsque vous le connectez.",
              )}
            </p>
            <Link to="/appareils" className="vyro-inline-link">
              {t("Vérifier mon appareil")} <ArrowUpRight size={16} aria-hidden />
            </Link>
          </Reveal>
          <figure className="vyro-feature-image">
            <img
              src={homeCapture}
              width={1600}
              height={900}
              alt={t(
                "Écran d’accueil de l’application avec menu, bibliothèque et accès à Mon profil",
              )}
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
