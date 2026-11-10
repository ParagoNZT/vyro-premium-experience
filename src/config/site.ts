/**
 * Single source of truth for commercial content.
 * Prices, plans, downloads and integrations are edited here only.
 */

export type Plan = {
  id: "3m" | "6m" | "12m";
  months: number;
  name: string;
  price: number; // TTC, en euros
  currency: string;
};

export const CURRENCY = "EUR";

// Historical terms used by existing licences, receipts and the admin grant form.
export const PLANS: Plan[] = [
  {
    id: "3m",
    months: 3,
    name: "3 mois",
    price: 24.9,
    currency: CURRENCY,
  },
  {
    id: "6m",
    months: 6,
    name: "6 mois",
    price: 44.9,
    currency: CURRENCY,
  },
  {
    id: "12m",
    months: 12,
    name: "12 mois",
    price: 79.9,
    currency: CURRENCY,
  },
];

export const PACK_IDS = ["solo", "maison", "famille", "a-vie"] as const;
export type PackId = (typeof PACK_IDS)[number];
export type Pack = {
  id: PackId;
  name: string;
  price: number;
  devices: 1 | 3 | 5;
  term: "annual" | "lifetime";
};

// Public catalogue. These IDs are separate from the historical payment and licence terms.
const packById: Record<PackId, Omit<Pack, "id">> = {
  solo: { name: "Solo", price: 9.99, devices: 1, term: "annual" },
  maison: { name: "Maison", price: 19.99, devices: 3, term: "annual" },
  famille: { name: "Famille", price: 29.99, devices: 5, term: "annual" },
  "a-vie": { name: "À vie", price: 49.99, devices: 5, term: "lifetime" },
};
export const getPack = (id: PackId): Pack => ({ id, ...packById[id] });
export const PACKS = PACK_IDS.map(getPack);
export const packDevices = (pack: Pack) =>
  `${pack.devices} appareil${pack.devices === 1 ? "" : "s"}`;
export const packBilling = (pack: Pack) => (pack.term === "annual" ? "par an" : "paiement unique");
export const PACK_ORDER_NOTICE = "Les achats en ligne sont indisponibles pour le moment.";

export const PLAN_INCLUDED = [
  "Lecteur TV et mobile Android",
  "Direct et guide TV avec votre source",
  "Films et séries de votre source",
  "Gestion des playlists à distance",
  "Sauvegarde et restauration",
  "Synchronisation entre appareils compatibles",
  "Mises à jour",
  "Support",
];

export const formatPrice = (value: number, currency = CURRENCY) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);

export const getPlan = (id: string) => PLANS.find((p) => p.id === id);

export type Integration = {
  name: string;
  description: string;
  status: "available" | "soon" | "not-integrated";
};

export const INTEGRATIONS: Integration[] = [
  { name: "TMDB", description: "Affiches, synopsis, casting et métadonnées.", status: "available" },
  { name: "Trakt", description: "Progression de lecture synchronisée.", status: "available" },
  {
    name: "MDBList",
    description: "Les listes et notes MDBList ne sont pas encore prises en charge.",
    status: "not-integrated",
  },
  { name: "IntroDB", description: "Détection des génériques.", status: "soon" },
  { name: "SubDL", description: "Recherche de sous-titres.", status: "soon" },
];

export type DownloadTarget = {
  id: string;
  platform: string;
  subtitle: string;
  steps: string[];
};

export const DOWNLOADS: DownloadTarget[] = [
  {
    id: "androidmobile",
    platform: "Android mobile et tablette",
    subtitle: "VYRO Premium pour téléphones et tablettes Android compatibles.",
    steps: [
      "Vérifiez la disponibilité de l’APK VYRO dans votre espace client sur le téléphone ou la tablette.",
      "Ouvrez le fichier. Si Android le demande, autorisez l’installation pour cette source.",
      "Lancez VYRO Premium et connectez votre source compatible.",
    ],
  },
  {
    id: "androidtv",
    platform: "Android TV / Google TV",
    subtitle: "Boîtiers, TV Sony, Philips, TCL, Nvidia Shield, Chromecast avec Google TV.",
    steps: [
      "Autorisez l'installation d'applications depuis des sources inconnues.",
      "Téléchargez le fichier d'installation VYRO Premium.",
      "Ouvrez le fichier depuis votre gestionnaire de fichiers, puis installez.",
      "Lancez VYRO Premium et connectez-vous avec votre compte.",
    ],
  },
  {
    id: "firetv",
    platform: "Amazon Fire TV",
    subtitle: "Fire TV Stick, Fire TV Cube, téléviseurs Fire TV.",
    steps: [
      "Activez « Applications de sources inconnues » dans les options développeur.",
      "Installez le fichier VYRO Premium via votre outil de transfert habituel.",
      "Lancez VYRO Premium depuis votre écran d'accueil.",
      "Connectez-vous avec votre compte VYRO.",
    ],
  },
];

export const FAQ = [
  {
    q: "Qu'est-ce que VYRO Premium ?",
    a: "VYRO Premium est un lecteur et gestionnaire multimédia pour téléviseurs. Il organise et lit les contenus provenant de la source compatible que vous connectez : Live TV, films, séries, guide des programmes et progression de lecture, dans une interface pensée pour la télécommande.",
  },
  {
    q: "Est-ce que VYRO fournit des chaînes TV ?",
    a: "Non. VYRO Premium ne fournit, n'héberge et ne distribue aucune chaîne, aucun film, aucune série et aucun flux vidéo. Aucun abonnement IPTV n'est inclus ni vendu.",
  },
  {
    q: "De quoi ai-je besoin ?",
    a: "Un téléphone ou une tablette Android compatible, ou un appareil Android TV, Google TV ou Amazon Fire TV, ainsi qu’une source multimédia que vous êtes autorisé à utiliser.",
  },
  {
    q: "Quels appareils sont compatibles ?",
    a: "Téléphones et tablettes Android compatibles, Android TV, Google TV et Amazon Fire TV.",
  },
  {
    q: "Puis-je installer VYRO sur plusieurs appareils ?",
    a: "Les packs annuels couvrent 1, 3 ou 5 appareils. Le pack À vie couvre 5 appareils sur le même compte. Vous pouvez vérifier le quota de votre licence actuelle depuis l’espace client.",
  },
  {
    q: "Comment retrouver mes réglages sur un autre appareil ?",
    a: "Avec une version compatible de VYRO, associez les deux appareils à votre compte. Dans Gestion à distance, créez une sauvegarde, puis restaurez-la sur le second appareil. Pour les favoris, les groupes et l’historique, ouvrez la même playlist sur les deux appareils. Vous pouvez aussi exporter puis importer la configuration en JSON.",
  },
  {
    q: "Comment installer VYRO Premium ?",
    a: "Si vous avez une licence active, retrouvez les fichiers disponibles et les instructions correspondant à votre appareil dans votre espace client, section « Télécharger VYRO ».",
  },
  {
    q: "Comment connecter mon service ?",
    a: "VYRO Premium prend en charge la connexion par Xtream Codes (URL du serveur, identifiant, mot de passe) et par liste M3U avec EPG optionnel. Les guides détaillés se trouvent dans le centre d'aide.",
  },
  {
    q: "Puis-je gérer mes playlists depuis le site ?",
    a: "Oui. Avec un appareil VYRO compatible et associé, la section Gestion à distance permet de renommer vos playlists, d’ajouter ou modifier une URL M3U HTTPS et de gérer les catégories et groupes de la playlist ouverte.",
  },
  {
    q: "Puis-je récupérer ma progression ?",
    a: "Oui. La progression de lecture est enregistrée sur votre profil VYRO. Si vous activez Trakt, elle est également synchronisée avec votre compte Trakt.",
  },
  {
    q: "Quelle est la différence entre les packs annuels et le pack À vie ?",
    a: "Les packs annuels couvrent 12 mois, sans renouvellement automatique. Le pack À vie couvre 5 appareils sans échéance annuelle, avec un seul paiement.",
  },
  {
    q: "Puis-je acheter un pack maintenant ?",
    a: PACK_ORDER_NOTICE,
  },
];

export const DISCLAIMER =
  "VYRO Premium ne fournit, n'héberge et ne distribue aucune chaîne TV, aucun film, aucune série et aucun flux vidéo. Vous devez connecter votre propre source ou service auquel vous êtes légalement autorisé à accéder.";
