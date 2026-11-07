import { Film, LayoutGrid, Play, Radio } from "lucide-react";
import home from "@/assets/vyro-home.jpg";
import live from "@/assets/vyro-live.jpg";
import series from "@/assets/vyro-series.jpg";
import player from "@/assets/vyro-player.jpg";
import details from "@/assets/vyro-details.jpg";

export const scenes = [
  {
    id: "bibliotheque",
    label: "Bibliothèque",
    name: "Parcourez votre bibliothèque",
    image: series,
    alt: "Catalogue de séries avec synopsis, affiches et sélection à la télécommande",
    icon: LayoutGrid,
  },
  {
    id: "direct",
    label: "En direct",
    name: "Retrouvez le direct et le programme",
    image: live,
    alt: "Écran du direct avec catégories, chaîne sélectionnée, aperçu et programme en cours",
    icon: Radio,
  },
  {
    id: "fiche",
    label: "Fiche détaillée",
    name: "Choisissez quoi regarder",
    image: details,
    alt: "Fiche détaillée avec synopsis et commandes de lecture",
    icon: Film,
  },
  {
    id: "lecture",
    label: "Lecteur",
    name: "Passez en plein écran",
    image: player,
    alt: "Lecture en plein écran avec le bandeau de contrôle ouvert",
    icon: Play,
  },
] as const;

export const homeCapture = home;
export const captureCaption =
  "Captures réelles d’une version de développement de l’application. Contenus affichés à titre d’illustration, non inclus.";
