import { ArrowUpRight, Monitor } from "lucide-react";

export function TvPanelLink() {
  return (
    <div className="va-service">
      <span className="va-metric-icon">
        <Monitor size={20} aria-hidden />
      </span>
      <div>
        <a
          href="https://vyro-beta-access.beta-worker.workers.dev/admin"
          target="_blank"
          rel="noreferrer"
          className="va-text-link"
        >
          Ouvrir le panneau TV <ArrowUpRight size={16} aria-hidden />
        </a>
        <p>Testeurs, playlists attribuées et messages TV. Connexion séparée.</p>
      </div>
    </div>
  );
}
