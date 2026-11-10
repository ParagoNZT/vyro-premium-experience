import {
  Activity,
  CalendarClock,
  CreditCard,
  DownloadCloud,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Monitor,
  Package,
  Users,
} from "lucide-react";

export const adminSections = {
  overview: {
    title: "Vue d’ensemble",
    description: "Retrouvez vos chiffres clés et les dernières opérations sur votre service.",
    Icon: LayoutDashboard,
  },
  clients: {
    title: "Clients",
    description:
      "Créez les fiches, gérez leur statut et attribuez des licences aux clients inscrits.",
    Icon: Users,
  },
  licenses: {
    title: "Licences",
    description: "Vérifiez les échéances et les quotas d’appareils des licences VYRO.",
    Icon: KeyRound,
  },
  packs: {
    title: "Packs",
    description: "Retrouvez les offres VYRO et créez vos propres packs de licences.",
    Icon: Package,
  },
  beta: {
    title: "Accès TV",
    description:
      "Retrouvez les accès VYRO, bêta et revendeurs. Sélectionnez un accès pour voir sa fiche.",
    Icon: Monitor,
  },
  payments: {
    title: "Paiements",
    description: "Consultez l’état de Stripe et l’historique des transactions réelles et de test.",
    Icon: CreditCard,
  },
  partners: {
    title: "Applications partenaires",
    description: "Gérez les demandes d’applications et les périodes de mises à jour.",
    Icon: Package,
  },
  deadlines: {
    title: "Échéances",
    description: "Anticipez les fins de licences, d’accès TV et de couverture des mises à jour.",
    Icon: CalendarClock,
  },
  vyro: {
    title: "Application VYRO",
    description: "Publiez les mises à jour et les messages de l’application VYRO originale.",
    Icon: DownloadCloud,
  },
  support: {
    title: "Support",
    description: "Consultez les tickets clients, répondez et suivez leur statut.",
    Icon: LifeBuoy,
  },
  audit: {
    title: "Journal",
    description: "Consultez les opérations enregistrées, leurs motifs et leurs auteurs.",
    Icon: Activity,
  },
} as const;

export type AdminSection = keyof typeof adminSections;

export const adminNavigation = Object.entries(adminSections) as Array<
  [AdminSection, (typeof adminSections)[AdminSection]]
>;

export function isAdminSection(value: unknown): value is AdminSection {
  return typeof value === "string" && Object.hasOwn(adminSections, value);
}
