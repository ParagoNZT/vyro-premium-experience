import { useCopy } from "@/lib/site-language";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./Logo";

const groups = [
  {
    label: "Produit",
    links: [
      ["/fonctionnalites", "L’application"],
      ["/appareils", "Appareils"],
      ["/tarifs", "Tarifs"],
      ["/revendeurs", "Revendeurs"],
      ["/download", "Télécharger"],
    ],
  },
  {
    label: "Compte",
    links: [
      ["/login", "Se connecter"],
      ["/register", "Créer un compte"],
      ["/support", "Assistance"],
      ["/faq", "Questions fréquentes"],
    ],
  },
  {
    label: "Informations légales",
    links: [
      ["/legal/conditions", "Conditions d’utilisation"],
      ["/legal/confidentialite", "Confidentialité"],
      ["/legal/mentions", "Mentions légales"],
      ["/legal/remboursement", "Remboursement"],
    ],
  },
] as const;

export function Footer() {
  const t = useCopy();
  return (
    <footer className="vyro-footer screening-footer">
      <div className="vyro-wrap">
        <div className="vyro-footer-grid">
          <div>
            <Logo />
            <p>{t("Votre lecteur multimédia pour Android TV, Google TV et Fire TV.")}</p>
          </div>
          {groups.map((group) => (
            <nav key={t(group.label)} aria-label={t(group.label)}>
              <h2>{t(group.label)}</h2>
              {group.links.map(([to, label]) => (
                <Link key={to} to={to}>
                  {t(label)}
                  <ArrowUpRight size={12} aria-hidden />
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="vyro-footer-end">
          <span>© 2026 VYRO Premium</span>
          <span>{t("Aucun contenu audiovisuel fourni ou hébergé.")}</span>
        </div>
      </div>
    </footer>
  );
}
