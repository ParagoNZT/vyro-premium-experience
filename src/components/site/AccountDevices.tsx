import { Link } from "@tanstack/react-router";
import { useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Copy,
  Download,
  KeyRound,
  Monitor,
  QrCode,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import { PortalNotice } from "@/components/site/AuthShell";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth, type Device } from "@/lib/auth";
import type { RemoteDeviceSummary } from "@/lib/remote-contract";

export function AccountHero({
  label,
  title,
  children,
  action,
  summary,
}: {
  label: string;
  title: string;
  children: ReactNode;
  action: ReactNode;
  summary: ReactNode;
}) {
  return (
    <header className="account-hero">
      <div className="account-hero-copy">
        <p className="account-eyebrow">{label}</p>
        <h1>{title}</h1>
        <p className="account-hero-description">{children}</p>
        <div className="account-actions">{action}</div>
      </div>
      <div className="account-hero-summary">{summary}</div>
    </header>
  );
}

export function AccountDeviceCount({
  count,
  limit,
}: {
  count: number;
  limit: number | null | undefined;
}) {
  return limit == null ? String(count) : `${count} / ${limit}`;
}

const activityFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

function searchText(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
}

function RemoteDeviceList({ devices }: { devices: RemoteDeviceSummary[] }) {
  return (
    <section
      id="appareils-gestion"
      className="account-card account-remote-list"
      aria-labelledby="account-remote-heading"
    >
      <div className="account-list-toolbar">
        <div className="account-list-title">
          <QrCode size={18} aria-hidden />
          <h3 id="account-remote-heading">Appareils associés par QR code</h3>
          <span className="account-count">{devices.length}</span>
        </div>
        <p className="account-remote-note">
          Pour gérer vos playlists et vos sauvegardes à distance. Le QR code ne compte pas dans le
          quota de la licence.
        </p>
      </div>
      {devices.length ? (
        <ul className="account-device-items">
          {devices.map((device) => {
            const Icon = device.kind === "mobile" ? Smartphone : Monitor;
            const platform =
              device.kind === "mobile"
                ? "Mobile"
                : /^Amazon\s+AFT/i.test(device.name)
                  ? "Fire TV"
                  : "TV";
            return (
              <li key={device.id}>
                <Link
                  className="account-device-row"
                  to="/account/gestion"
                  search={{ appareil: device.id }}
                  aria-label={`Gérer ${device.name} à distance`}
                >
                  <span className="account-icon">
                    <Icon size={19} aria-hidden />
                  </span>
                  <span className="account-device-row-copy">
                    <strong>{device.name}</strong>
                    <small>
                      {platform} · {device.edition === "vyro" ? "VYRO" : "SHOW+"}
                    </small>
                  </span>
                  <ChevronRight size={16} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="account-remote-note account-remote-empty">
          Aucun appareil associé par QR code.{" "}
          <Link to="/account/gestion" className="underline">
            Voir comment associer un appareil
          </Link>
        </p>
      )}
    </section>
  );
}

export function AccountDevices() {
  const { user, refreshAccount, removeDevice } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [pendingDevice, setPendingDevice] = useState<Device | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: true } | null>(null);
  const focusListAfterRemove = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const listId = useId();
  const inspectorId = useId();
  const devices = user?.devices ?? [];
  const filter = searchText(query.trim());
  const matches = filter
    ? devices.filter((device) => searchText(`${device.name} ${device.platform}`).includes(filter))
    : devices;
  const device = matches.find((candidate) => candidate.id === selectedId) ?? matches[0];
  const lastSeen = device && Number.isFinite(Date.parse(device.lastSeen)) ? device.lastSeen : null;
  const appVersion = device?.appVersion?.trim();
  const androidVersion = device?.androidVersion?.trim();

  async function refresh() {
    setRefreshing(true);
    setFeedback(null);
    try {
      await refreshAccount();
      setFeedback({ text: "Liste des appareils actualisée." });
    } catch {
      setFeedback({ text: "Impossible d’actualiser la liste. Réessayez.", error: true });
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmRemoval() {
    if (!pendingDevice || removing) return;
    setRemoving(true);
    setRemoveError("");
    setFeedback(null);
    try {
      await removeDevice(pendingDevice.id);
      focusListAfterRemove.current = true;
      setPendingDevice(null);
      setFeedback({ text: "Appareil retiré de votre licence." });
    } catch (issue) {
      setRemoveError(
        issue instanceof Error && !(issue instanceof TypeError)
          ? issue.message
          : "Impossible de retirer cet appareil.",
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="account-devices" aria-labelledby={listId}>
      <div className="account-section-heading">
        <div>
          <p className="account-eyebrow">Votre équipement</p>
          <h2 id={listId}>Appareils associés</h2>
        </div>
        <button
          type="button"
          className="account-button"
          disabled={refreshing || removing}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden />
          {refreshing ? "Actualisation…" : "Actualiser"}
        </button>
      </div>

      {feedback && <PortalNotice error={feedback.error ?? false}>{feedback.text}</PortalNotice>}

      <RemoteDeviceList devices={user?.remoteDevices ?? []} />

      <div className="account-device-grid">
        <div className="account-card account-device-list">
          <div className="account-list-toolbar">
            <div className="account-list-title">
              <h3>Appareils activés sur ma licence</h3>
              <span className="account-count">
                <AccountDeviceCount
                  count={devices.length}
                  limit={user?.subscription?.devicesAllowed}
                />
              </span>
            </div>
            <label className="account-search">
              <Search size={17} aria-hidden />
              <span className="sr-only">Rechercher un appareil</span>
              <input
                ref={searchInput}
                type="search"
                placeholder="Rechercher un appareil…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <p className="sr-only" role="status">
              {filter ? `${matches.length} résultat${matches.length > 1 ? "s" : ""}` : ""}
            </p>
          </div>
          {matches.length ? (
            <ul className="account-device-items">
              {matches.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="account-device-row"
                    aria-pressed={device?.id === entry.id}
                    aria-controls={inspectorId}
                    onClick={() => {
                      setSelectedId(entry.id);
                      if (window.matchMedia("(max-width: 72rem)").matches) {
                        inspectorHeading.current?.focus();
                      }
                    }}
                  >
                    <span className="account-icon">
                      <Monitor size={19} aria-hidden />
                    </span>
                    <span className="account-device-row-copy">
                      <strong>{entry.name}</strong>
                      <small>{entry.platform}</small>
                    </span>
                    <ChevronRight size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="account-empty">
              <span className="account-icon">
                {devices.length ? (
                  <Search size={20} aria-hidden />
                ) : (
                  <Monitor size={20} aria-hidden />
                )}
              </span>
              <p>{devices.length ? "Aucun résultat" : "Aucun appareil activé sur la licence"}</p>
              <small>
                {devices.length
                  ? "Essayez un autre nom ou une autre plateforme."
                  : "Sur une version compatible, connectez votre compte VYRO dans l’application pour activer cet appareil."}
              </small>
              {query && (
                <button
                  className="account-button"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    searchInput.current?.focus();
                  }}
                >
                  Effacer la recherche
                </button>
              )}
            </div>
          )}
        </div>

        <section
          className="account-card account-inspector"
          id={inspectorId}
          aria-label="Détails de l’appareil"
        >
          <h3 ref={inspectorHeading} tabIndex={-1} className="account-inspector-label">
            Fiche appareil
          </h3>
          {device ? (
            <>
              <div className="account-inspector-device">
                <span className="account-icon">
                  <Monitor size={22} aria-hidden />
                </span>
                <div>
                  <h4>{device.name}</h4>
                  <span className="account-associated">Associé à votre licence</span>
                </div>
              </div>
              <dl className="account-device-facts">
                <div>
                  <dt>Plateforme</dt>
                  <dd>{device.platform || "Non renseignée"}</dd>
                </div>
                <div>
                  <dt>Dernière activité</dt>
                  <dd>
                    {lastSeen ? (
                      <time dateTime={lastSeen}>{activityFormat.format(new Date(lastSeen))}</time>
                    ) : (
                      "Non renseignée"
                    )}
                  </dd>
                </div>
                {appVersion && (
                  <div>
                    <dt>Version de VYRO</dt>
                    <dd>{appVersion}</dd>
                  </div>
                )}
                {androidVersion && (
                  <div>
                    <dt>Version d’Android</dt>
                    <dd>{androidVersion}</dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <div className="account-inspector-empty">
              <p>Aucun appareil à afficher</p>
              <small>
                {devices.length
                  ? "La fiche s’affiche quand un appareil correspond à votre recherche."
                  : "La plateforme et la dernière activité apparaîtront ici."}
              </small>
            </div>
          )}

          <AlertDialog
            open={pendingDevice !== null}
            onOpenChange={(open) => {
              if (removing) return;
              setRemoveError("");
              setPendingDevice(open && device ? device : null);
            }}
          >
            {device && (
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={refreshing}
                  className="account-button account-button-danger account-inspector-remove"
                >
                  <Trash2 size={16} aria-hidden /> Retirer l’appareil
                </button>
              </AlertDialogTrigger>
            )}
            <AlertDialogContent
              className="account-dialog"
              onCloseAutoFocus={(event) => {
                if (focusListAfterRemove.current) {
                  event.preventDefault();
                  focusListAfterRemove.current = false;
                  searchInput.current?.focus();
                }
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>Retirer {pendingDevice?.name} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Pour activer cet appareil à nouveau, reconnectez votre compte VYRO dans
                  l’application ou utilisez votre clé sur une version plus ancienne.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {removeError && <PortalNotice error>{removeError}</PortalNotice>}
              <AlertDialogFooter>
                <AlertDialogCancel className="account-button" disabled={removing}>
                  Annuler
                </AlertDialogCancel>
                <button
                  type="button"
                  className="account-button account-button-danger-solid"
                  disabled={removing}
                  onClick={() => void confirmRemoval()}
                >
                  {removing ? "Retrait…" : "Confirmer le retrait"}
                </button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </section>
  );
}

function LicenseActions({ licenseKey }: { licenseKey: string }) {
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);
  const [revealed, setRevealed] = useState(false);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setFeedback("copied");
    } catch {
      setRevealed(true);
      setFeedback("error");
    }
  }

  return (
    <>
      <div className="account-actions">
        <button
          type="button"
          className="account-button account-button-primary"
          onClick={() => void copyKey()}
        >
          <Copy size={16} aria-hidden /> Copier ma clé TV
        </button>
        <button
          type="button"
          className="account-button"
          aria-expanded={revealed}
          aria-controls="account-tv-key"
          onClick={() => {
            setRevealed(!revealed);
            setFeedback(null);
          }}
        >
          {revealed ? "Masquer ma clé" : "Afficher ma clé"}
        </button>
      </div>
      <div id="account-tv-key" hidden={!revealed}>
        {revealed && (
          <code className="account-key-value" aria-label="Clé de licence TV">
            {licenseKey}
          </code>
        )}
      </div>
      {feedback && (
        <PortalNotice error={feedback === "error"}>
          {feedback === "copied"
            ? "Clé copiée. Utilisez-la uniquement dans l’application VYRO."
            : "La copie automatique a échoué. Vous pouvez sélectionner et copier la clé affichée."}
        </PortalNotice>
      )}
    </>
  );
}

export function AccountActivation() {
  const { user, isActive } = useAuth();
  const key = isActive ? user?.licenseKey : "";

  return (
    <section
      id="activation-tv"
      tabIndex={-1}
      className="account-card account-activation"
      aria-labelledby="account-activation-heading"
    >
      <div className="account-section-heading">
        <div className="account-activation-title">
          <span className="account-icon">
            <KeyRound size={21} aria-hidden />
          </span>
          <div>
            <p className="account-eyebrow">Activation sur la TV</p>
            <h2 id="account-activation-heading">Activer un appareil</h2>
          </div>
        </div>
        <Link to="/account/guides" className="account-button">
          <BookOpen size={16} aria-hidden /> Guides de configuration
        </Link>
      </div>
      <p className="account-remote-note">
        Déjà associé avec le QR code ?{" "}
        <a href="#appareils-gestion" className="underline">
          Voir mes appareils pour la gestion à distance
        </a>
        .
      </p>
      <p className="account-remote-note">
        Sur une version compatible, connectez-vous dans le menu <strong>Compte VYRO</strong>. Avec
        une licence active et une place libre, l’appareil s’active sans saisir de clé. Les étapes
        ci-dessous servent aux versions qui demandent encore une clé.
      </p>
      <ol className="account-activation-steps">
        <li>
          <span aria-hidden>01</span>
          <div>
            <strong>Installez VYRO</strong>
            <p>Ouvrez VYRO Premium sur votre téléviseur.</p>
          </div>
        </li>
        <li>
          <span aria-hidden>02</span>
          <div>
            <strong>Saisissez votre clé</strong>
            <p>Entrez votre clé d’activation dans l’application TV.</p>
          </div>
        </li>
        <li>
          <span aria-hidden>03</span>
          <div>
            <strong>Vérifiez l’association</strong>
            <p>Revenez dans votre espace et actualisez la liste des appareils.</p>
          </div>
        </li>
      </ol>
      <div className="account-activation-actions">
        {key ? (
          <LicenseActions key={key} licenseKey={key} />
        ) : (
          <div className="account-activation-unavailable">
            <p>
              {isActive
                ? "Votre clé est indisponible. Contactez l’assistance pour la retrouver."
                : "Une licence active est nécessaire pour associer un téléviseur."}
            </p>
            {isActive ? (
              <Link to="/account/support" className="account-button account-button-primary">
                Contacter l’assistance <ArrowRight size={16} aria-hidden />
              </Link>
            ) : (
              <Link to="/tarifs" className="account-button account-button-primary">
                Voir les offres <ArrowRight size={16} aria-hidden />
              </Link>
            )}
          </div>
        )}
        {isActive && (
          <Link to="/account/telechargement" className="account-button account-install">
            <Download size={16} aria-hidden /> Télécharger VYRO
          </Link>
        )}
      </div>
    </section>
  );
}
