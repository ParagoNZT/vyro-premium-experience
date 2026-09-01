import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Heading, Lead, Section } from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Centre d'aide – VYRO Premium" },
      {
        name: "description",
        content:
          "Guides d'installation, connexion Xtream Codes ou M3U, problèmes de lecture, gestion du compte et de l'abonnement : le centre d'aide VYRO Premium.",
      },
      { property: "og:title", content: "Centre d'aide – VYRO Premium" },
      {
        property: "og:description",
        content: "Guides d'installation, de connexion et de dépannage pour VYRO Premium.",
      },
      { property: "og:url", content: "/support" },
    ],
    links: [{ rel: "canonical", href: "/support" }],
  }),
  component: SupportPage,
});

const ARTICLES = [
  {
    category: "Installation",
    title: "Installer VYRO Premium sur Android TV ou Google TV",
    body: "Autorisez l'installation depuis des sources inconnues, téléchargez le fichier depuis votre espace client, ouvrez-le puis installez. Connectez-vous ensuite avec votre compte VYRO pour activer votre licence.",
  },
  {
    category: "Installation",
    title: "Installer VYRO Premium sur Amazon Fire TV",
    body: "Activez les options développeur puis « Applications de sources inconnues ». Transférez le fichier d'installation, lancez-le, puis ouvrez VYRO Premium depuis l'écran d'accueil.",
  },
  {
    category: "Connexion",
    title: "Connecter une source Xtream Codes",
    body: "Dans VYRO Premium, ouvrez Réglages puis Sources. Choisissez Xtream Codes et saisissez l'URL du serveur, votre identifiant et votre mot de passe fournis par le service que vous utilisez. VYRO importe ensuite les catégories, chaînes et contenus disponibles.",
  },
  {
    category: "Connexion",
    title: "Connecter une liste M3U",
    body: "Dans Réglages puis Sources, choisissez M3U et collez l'URL de votre liste. Vous pouvez ajouter une URL EPG (XMLTV) pour afficher le guide des programmes.",
  },
  {
    category: "Lecture",
    title: "Résoudre un problème de lecture",
    body: "Vérifiez d'abord votre connexion réseau, puis testez une autre chaîne ou un autre contenu pour identifier si le problème vient de la source. Dans les réglages du lecteur, essayez le moteur de lecture alternatif, puis relancez l'application.",
  },
  {
    category: "Compte",
    title: "Mot de passe oublié ou accès impossible",
    body: "Utilisez le lien de réinitialisation depuis la page de connexion. Si l'adresse e-mail n'est plus accessible, contactez le support depuis cette page.",
  },
  {
    category: "Abonnement",
    title: "Renouveler ou prolonger l'accès",
    body: "Rendez-vous dans votre espace client, section Mon abonnement, puis choisissez une nouvelle durée. Le temps restant est conservé et prolongé.",
  },
  {
    category: "Abonnement",
    title: "Ce que couvre l'abonnement",
    body: "L'abonnement couvre uniquement la licence d'utilisation de l'application VYRO Premium. Aucune chaîne, aucun film et aucune série n'est fourni, hébergé ou vendu par VYRO Premium.",
  },
  {
    category: "Contact",
    title: "Contacter le support",
    body: "Écrivez à support@vyro-premium.app en indiquant l'adresse e-mail de votre compte, votre appareil et une description du problème. Une réponse est apportée sous 24 à 48 heures ouvrées.",
  },
];

function SupportPage() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ARTICLES;
    return ARTICLES.filter((a) =>
      `${a.category} ${a.title} ${a.body}`.toLowerCase().includes(q),
    );
  }, [query]);

  const categories = useMemo(
    () => Array.from(new Set(results.map((a) => a.category))),
    [results],
  );

  return (
    <Section className="pt-20 md:pt-28">
      <Reveal className="max-w-2xl">
        <Heading>Centre d'aide.</Heading>
        <Lead className="mt-5">
          Installation, connexion de votre source, lecture, compte et abonnement.
        </Lead>
      </Reveal>

      <Reveal delay={60} className="mt-9 max-w-xl">
        <div className="flex items-center gap-3 rounded-[10px] border border-border bg-surface px-4 py-3 focus-within:border-primary/50">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans la documentation"
            aria-label="Rechercher dans la documentation"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </Reveal>

      <div className="mt-12 space-y-12">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="font-display text-lg font-medium">{category}</h2>
            <Accordion type="single" collapsible className="mt-3 w-full">
              {results
                .filter((a) => a.category === category)
                .map((article) => (
                  <AccordionItem key={article.title} value={article.title} className="border-border">
                    <AccordionTrigger className="py-4 text-left text-[15px] font-normal hover:no-underline">
                      {article.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-[14.5px] leading-relaxed text-muted-foreground">
                      {article.body}
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </div>
        ))}
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun résultat. Écrivez-nous à support@vyro-premium.app.
          </p>
        ) : null}
      </div>
    </Section>
  );
}
