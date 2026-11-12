import { useCopy } from "@/lib/site-language";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import broadcasts from "@/assets/showplus-fire-tv-sports.png";
import competitions from "@/assets/showplus-fire-tv-competitions.png";
import { Reveal } from "./Reveal";

const captures = [
  {
    src: broadcasts,
    alt: "Écran Sports sur Fire TV : une rencontre de football et les diffusions du guide TV",
    caption: "Les diffusions repérées dans le guide TV",
  },
  {
    src: competitions,
    alt: "Écran Sports sur Fire TV : compétitions, résultats et rencontres à venir",
    caption: "Les compétitions, les résultats et les prochaines rencontres",
  },
];

export function SportsSpotlight({ detailed = false }: { detailed?: boolean }) {
  const t = useCopy();
  return (
    <section
      id="sports"
      className="sports-spotlight screening-wrap screening-section"
      aria-labelledby="sports-title"
    >
      <div className={detailed ? undefined : "sports-spotlight__teaser"}>
        <Reveal className="workspace-spotlight__intro">
          <p className="workspace-spotlight__kicker">{t("Sports · Sur TV")}</p>
          <h2 id="sports-title">
            {t("Le sport,")} <em>{t("au programme.")}</em>
          </h2>
          <p>
            {t(
              "Repérez les diffusions sportives dans le guide TV de votre playlist. Parcourez aussi les compétitions, les résultats et les prochaines rencontres lorsque ces données sont disponibles.",
            )}
          </p>
        </Reveal>
        <div className="sports-spotlight__captures">
          {(detailed ? captures : captures.slice(0, 1)).map(({ src, alt, caption }) => (
            <figure className="sports-spotlight__capture" key={src}>
              <img
                src={src}
                alt={t(alt)}
                width={1920}
                height={1080}
                loading="lazy"
                decoding="async"
              />
              <figcaption>{t(caption)}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="workspace-spotlight__foot">
        <p>
          {t(
            "Captures de SHOW+ sur Fire TV Stick. Les chaînes affichées dépendent de la playlist utilisée. VYRO ne fournit aucun flux.",
          )}
        </p>
        {!detailed && (
          <div className="workspace-spotlight__actions">
            <Link to="/fonctionnalites" hash="sports" className="screening-text-link">
              {t("Découvrir l’écran Sports")} <ArrowUpRight size={16} aria-hidden />
            </Link>
            <Link to="/fonctionnalites" hash="reglages-lecture" className="screening-text-link">
              {t("Réglages image et son")} <ArrowUpRight size={16} aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
