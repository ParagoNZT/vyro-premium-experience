import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DevicesSection,
  DisclaimerSection,
  FaqSection,
  FeatureRow,
  FinalCta,
  Heading,
  IntegrationsSection,
  Lead,
  PricingSection,
  Section,
  Shot,
} from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import uiHome from "@/assets/ui-home.jpg";
import uiLive from "@/assets/ui-livetv.jpg";
import uiVod from "@/assets/ui-vod.jpg";
import uiPlayer from "@/assets/ui-player.jpg";
import uiGuide from "@/assets/ui-guide.jpg";
import uiContinue from "@/assets/ui-continue.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VYRO Premium – L'expérience IPTV pensée pour votre TV" },
      {
        name: "description",
        content:
          "Découvrez VYRO Premium, une application IPTV moderne conçue pour Android TV, Google TV et Fire TV. Une interface rapide, élégante et entièrement pensée pour la télévision.",
      },
      { property: "og:title", content: "VYRO Premium – L'expérience IPTV pensée pour votre TV" },
      {
        property: "og:description",
        content:
          "Live TV, films, séries et guide TV réunis dans une interface premium pour Android TV, Google TV et Fire TV.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="halo left-1/2 top-0 h-[620px] w-[1100px] -translate-x-1/2 -translate-y-1/3" />
      <div className="relative mx-auto max-w-4xl px-5 pb-4 pt-24 text-center md:px-8 md:pt-36">
        <Reveal>
          <h1 className="text-balance font-display text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Votre télévision.
            <br />
            <span className="text-muted-foreground">Comme elle aurait toujours dû être.</span>
          </h1>
        </Reveal>
        <Reveal delay={90}>
          <Lead className="mx-auto mt-7 max-w-2xl">
            VYRO Premium réunit Live TV, films, séries, guide TV et vos contenus dans une expérience
            rapide, élégante et pensée pour votre téléviseur.
          </Lead>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/tarifs"
              className="inline-flex w-full items-center justify-center rounded-[10px] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-115 hover:shadow-[0_0_36px_-8px_var(--primary)] sm:w-auto"
            >
              Obtenir VYRO Premium
            </Link>
            <Link
              to="/fonctionnalites"
              className="inline-flex w-full items-center justify-center rounded-[10px] bg-surface-2 px-6 py-3 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent sm:w-auto"
            >
              Découvrir l'application
            </Link>
          </div>
          <p className="mt-6 text-[13px] text-muted-foreground">Android TV · Google TV · Fire TV</p>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-14 max-w-6xl px-5 md:px-8">
        <div aria-hidden className="halo -inset-x-10 -top-20 bottom-0 -z-10" />
        <Reveal delay={120}>
          <Shot
            src={uiHome}
            alt="Écran d'accueil de l'application VYRO Premium sur téléviseur"
            priority
          />
        </Reveal>
      </div>
    </section>
  );
}

function Home() {
  return (
    <>
      <Hero />
      <DevicesSection />

      <Section id="experience" className="pb-0">
        <Reveal className="max-w-3xl">
          <Heading>
            Tout ce dont vous avez besoin.
            <br />
            <span className="text-muted-foreground">Rien de superflu.</span>
          </Heading>
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
          alt="Interface Live TV de VYRO Premium avec catégories, chaînes et aperçu"
        />
        <FeatureRow
          reversed
          eyebrow="Films & séries"
          title="Votre bibliothèque devient une véritable expérience cinéma."
          description="VYRO Premium transforme une simple liste de contenus en une interface riche avec affiches, synopsis, notes, bandes-annonces et informations détaillées."
          points={[
            "Affiches et fonds d'écran",
            "Synopsis et casting",
            "Notes TMDB, IMDb et Rotten Tomatoes",
            "Bandes-annonces",
            "Saisons et épisodes",
            "Recherche rapide",
          ]}
          image={uiVod}
          alt="Fiche détaillée d'un film dans VYRO Premium"
        />
        <FeatureRow
          eyebrow="Lecteur"
          title="Appuyez sur Lecture. VYRO s'occupe du reste."
          description="Un lecteur optimisé pour la télévision : il choisit automatiquement le bon moteur vidéo pour votre flux, sans réglage technique de votre part."
          points={[
            "Pistes audio multiples",
            "Sous-titres",
            "Changement de format d'image",
            "Vitesse de lecture pour la VOD",
            "Reprise de lecture",
            "Large compatibilité de codecs et formats",
          ]}
          image={uiPlayer}
          alt="Lecteur vidéo VYRO Premium avec sélection des pistes audio et sous-titres"
        />
        <FeatureRow
          reversed
          eyebrow="Guide TV"
          title="Votre programme en un coup d'œil."
          description="Le programme en cours, les suivants, les informations détaillées et l'accès direct à une chaîne depuis le guide."
          points={[
            "Programme actuel",
            "Programmes suivants",
            "Navigation rapide",
            "Informations détaillées",
            "Accès direct à la chaîne",
          ]}
          image={uiGuide}
          alt="Guide des programmes TV de VYRO Premium en pleine largeur"
        />
        <FeatureRow
          eyebrow="Profils & synchronisation"
          title="À chacun son espace. Et sa progression."
          description="Des profils séparés avec favoris, historique et progression de lecture. Reprenez exactement où vous vous êtes arrêté, sur n'importe quel appareil connecté à votre compte."
          points={[
            "Profils séparés",
            "Favoris personnels",
            "Historique",
            "Progression de lecture",
            "Protection PIN lorsqu'elle est configurée",
            "Synchronisation Trakt en option",
          ]}
          image={uiContinue}
          alt="Section Continuer à regarder avec profils dans VYRO Premium"
        />
      </Section>

      <IntegrationsSection />
      <PricingSection />
      <DisclaimerSection />
      <FaqSection compact />
      <FinalCta />
    </>
  );
}
