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
  return (
    <footer className="vyro-footer screening-footer">
      <div className="vyro-wrap">
        <div className="vyro-footer-grid">
          <div>
            <Logo />
            <p>Votre lecteur multimédia pour Android TV, Google TV et Fire TV.</p>
          </div>
          {groups.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <h2>{group.label}</h2>
              {group.links.map(([to, label]) => (
                <Link key={to} to={to}>
                  {label}
                  <ArrowUpRight size={12} aria-hidden />
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="vyro-footer-end">
          <span>© 2026 VYRO Premium</span>
          <span>Aucun contenu audiovisuel fourni ou hébergé.</span>
        </div>
      </div>
    </footer>
  );
}
