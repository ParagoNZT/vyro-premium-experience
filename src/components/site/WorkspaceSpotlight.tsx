import { useCopy } from "@/lib/site-language";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, HardDrive, ListVideo, MonitorSmartphone } from "lucide-react";
import { Reveal } from "./Reveal";

const capabilities = [
  {
    icon: MonitorSmartphone,
    title: "Synchronisation entre appareils",
    description:
      "Transférez vos favoris, vos groupes et votre progression de lecture : sauvegardez un appareil, puis restaurez la configuration sur l’autre.",
  },
  {
    icon: HardDrive,
    title: "Sauvegarde, import et export",
    description:
      "Conservez vos configurations dans votre compte. Exportez-les en fichier JSON et réimportez-les au besoin. Le fichier ne contient ni URL de playlist ni mot de passe.",
  },
  {
    icon: ListVideo,
    title: "Playlists à distance",
    description:
      "Ajoutez ou modifiez une URL M3U HTTPS, renommez vos playlists et choisissez les catégories visibles et les groupes de la playlist ouverte.",
  },
] as const;

export function WorkspaceSpotlight({ detailed = false }: { detailed?: boolean }) {
  const t = useCopy();
  return (
    <section
      id="espace-client"
      aria-labelledby="workspace-spotlight-title"
      className="workspace-spotlight"
    >
      <div className="screening-wrap screening-section">
        <Reveal className="workspace-spotlight__intro">
          <p className="workspace-spotlight__kicker">{t("L’espace client")}</p>
          <h2 id="workspace-spotlight-title">
            {t("Vos réglages,")} <em>{t("d’un écran à l’autre.")}</em>
          </h2>
          <p>
            {t(
              "Retrouvez la configuration de votre TV sur un téléphone, une tablette ou une autre TV. Depuis votre navigateur, gérez les playlists et les sauvegardes de vos appareils associés.",
            )}
          </p>
        </Reveal>
        <ul className="workspace-spotlight__features">
          {capabilities.map(({ icon: Icon, title, description }, index) => (
            <Reveal
              as="li"
              className="workspace-spotlight__feature"
              key={t(title)}
              delay={index * 60}
            >
              <span className="workspace-spotlight__icon">
                <Icon size={23} aria-hidden />
              </span>
              <h3>{t(title)}</h3>
              <p>{t(description)}</p>
            </Reveal>
          ))}
        </ul>
        {detailed && (
          <ol
            className="workspace-spotlight__steps"
            aria-label={t("Comment transférer une configuration")}
          >
            <li>
              <strong>{t("Associez vos appareils")}</strong>
              <span>
                {t(
                  "Dans Réglages → À propos, affichez le QR code de gestion à distance et confirmez l’association dans votre compte.",
                )}
              </span>
            </li>
            <li>
              <strong>{t("Sauvegardez la source")}</strong>
              <span>
                {t(
                  "Dans Gestion à distance, sélectionnez l’appareil source et choisissez les réglages seuls ou la sauvegarde complète.",
                )}
              </span>
            </li>
            <li>
              <strong>{t("Restaurez sur la destination")}</strong>
              <span>
                {t(
                  "Sélectionnez le second appareil, ouvrez la même playlist pour une restauration complète, puis lancez la restauration.",
                )}
              </span>
            </li>
          </ol>
        )}
        <div className="workspace-spotlight__foot">
          <p>
            {t(
              "Ces fonctions nécessitent une version compatible de VYRO. Pour transférer les favoris et l’historique, la même playlist doit être configurée sur les deux appareils.",
            )}
          </p>
          <div className="workspace-spotlight__actions">
            <Link to="/account/gestion" className="screening-button screening-button-primary">
              {t("Ouvrir la gestion à distance")} <ArrowUpRight size={17} aria-hidden />
            </Link>
            {detailed ? (
              <Link to="/account/guides" className="screening-text-link">
                {t("Consulter les guides")} <ArrowUpRight size={16} aria-hidden />
              </Link>
            ) : (
              <Link to="/fonctionnalites" hash="espace-client" className="screening-text-link">
                {t("Voir comment ça marche")} <ArrowUpRight size={16} aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
