import { createFileRoute } from "@tanstack/react-router";
import {
  FeatureRow,
  FinalCta,
  Heading,
  IntegrationsSection,
  Lead,
  Section,
} from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import uiLive from "@/assets/ui-livetv.jpg";
import uiVod from "@/assets/ui-vod.jpg";
import uiPlayer from "@/assets/ui-player.jpg";
import uiGuide from "@/assets/ui-guide.jpg";
import uiContinue from "@/assets/ui-continue.jpg";

export const Route = createFileRoute("/fonctionnalites")({
  head: () => ({
    meta: [
      { title: "Fonctionnalités – VYRO Premium" },
      {
        name: "description",
        content:
          "Live TV, films et séries, lecteur optimisé TV, guide des programmes, profils et synchronisation : découvrez l'interface VYRO Premium en détail.",
      },
      { property: "og:title", content: "Fonctionnalités – VYRO Premium" },
      {
        property: "og:description",
        content: "L'interface VYRO Premium en détail : Live TV, VOD, lecteur, guide TV et profils.",
      },
      { property: "og:url", content: "/fonctionnalites" },
    ],
    links: [{ rel: "canonical", href: "/fonctionnalites" }],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <>
      <Section className="pb-0 pt-20 md:pt-28">
        <Reveal className="max-w-3xl">
          <Heading>
            Tout ce dont vous avez besoin.
            <br />
            <span className="text-muted-foreground">Rien de superflu.</span>
          </Heading>
          <Lead className="mt-6 max-w-2xl">
            Chaque écran de VYRO Premium a été dessiné pour être lu à trois mètres et piloté à la
            télécommande.
          </Lead>
        </Reveal>
      </Section>

      <Section className="space-y-24 md:space-y-36">
        <FeatureRow
          eyebrow="Live TV"
          title="La télévision en direct, réinventée."
          description="Naviguez rapidement entre vos catégories et vos chaînes grâce à une interface entièrement pensée pour la télécommande."
          points={[
            "Navigation instantanée au D-pad",
            "Guide des programmes",
            "Informations EPG",
            "Aperçu des chaînes",
            "Favoris et historique récent",
            "Changement rapide de chaîne",
          ]}
          image={uiLive}
          alt="Interface Live TV de VYRO Premium"
        />
        <FeatureRow
          reversed
          eyebrow="Films & séries"
          title="Votre bibliothèque devient une véritable expérience cinéma."
          description="VYRO Premium transforme une simple liste de contenus en une interface riche avec affiches, synopsis, notes, bandes-annonces et informations détaillées."
          points={[
            "Affiches et visuels haute définition",
            "Synopsis et casting",
            "Notes TMDB, IMDb et Rotten Tomatoes",
            "Bandes-annonces",
            "Suivi des saisons et épisodes",
            "Recherche rapide",
          ]}
          image={uiVod}
          alt="Fiche VOD de VYRO Premium"
        />
        <FeatureRow
          eyebrow="Lecteur"
          title="Appuyez sur Lecture. VYRO s'occupe du reste."
          description="VYRO Premium sélectionne automatiquement le moteur de lecture adapté à votre flux. Vous n'avez aucun réglage technique à connaître."
          points={[
            "Lecteur optimisé TV",
            "Pistes audio",
            "Sous-titres",
            "Format d'image ajustable",
            "Vitesse de lecture pour la VOD",
            "Reprise de lecture automatique",
          ]}
          image={uiPlayer}
          alt="Lecteur vidéo de VYRO Premium"
        />
        <FeatureRow
          reversed
          eyebrow="Guide TV"
          title="Votre programme en un coup d'œil."
          description="Le programme en cours, les suivants et toutes les informations détaillées, avec accès direct à la chaîne depuis le guide."
          image={uiGuide}
          alt="Guide TV de VYRO Premium"
        />
        <FeatureRow
          eyebrow="Profils"
          title="À chacun son espace."
          description="Chaque membre du foyer retrouve ses favoris, son historique et sa progression. Un code PIN peut protéger un profil lorsque vous le souhaitez."
          points={[
            "Profils séparés",
            "Favoris personnels",
            "Historique",
            "Progression de lecture",
            "Protection PIN",
          ]}
          image={uiContinue}
          alt="Profils et Continuer à regarder dans VYRO Premium"
        />
      </Section>

      <IntegrationsSection />
      <FinalCta />
    </>
  );
}
