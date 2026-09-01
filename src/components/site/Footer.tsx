import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { to: "/fonctionnalites", label: "Fonctionnalités" },
      { to: "/tarifs", label: "Tarifs" },
      { to: "/download", label: "Télécharger" },
      { to: "/appareils", label: "Appareils" },
    ],
  },
  {
    title: "Assistance",
    links: [
      { to: "/support", label: "Centre d'aide" },
      { to: "/support", label: "Installation" },
      { to: "/faq", label: "FAQ" },
      { to: "/support", label: "Contact" },
    ],
  },
  {
    title: "Légal",
    links: [
      { to: "/legal/conditions", label: "Conditions d'utilisation" },
      { to: "/legal/confidentialite", label: "Politique de confidentialité" },
      { to: "/legal/mentions", label: "Mentions légales" },
      { to: "/legal/remboursement", label: "Politique de remboursement" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="min-w-0">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Une expérience TV rapide et élégante pour Android TV, Google TV et Fire TV.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title} className="min-w-0">
              <h3 className="text-[13px] font-medium tracking-wide text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.label}`}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 VYRO Premium.</p>
          <p className="max-w-lg sm:text-right">
            VYRO Premium ne fournit ni n'héberge aucun contenu audiovisuel.
          </p>
        </div>
      </div>
    </footer>
  );
}
