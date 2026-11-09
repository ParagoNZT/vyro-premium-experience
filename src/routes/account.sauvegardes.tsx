import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Download,
  Monitor,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import { PortalNotice } from "@/components/site/AuthShell";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import { tvBackupFile, type webSettingsAction } from "@/lib/tv-settings-contract";
import "@/components/site/tv-settings.css";

export const Route = createFileRoute("/account/sauvegardes")({
  head: () => ({
    meta: [{ title: "Sauvegardes – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: TvSettingsPage,
});

type Device = {
  id: string;
  name: string;
  lastSeen: string | null;
  compatible: boolean;
  kind: "tv" | "mobile" | "unknown";
  protocol: number;
  playlistReady: boolean;
};
type Backup = {
  id: string;
  name: string;
  sourceName: string;
  createdAt: string;
  fullProfile: boolean;
};
type Job = {
  id: string;
  operation: "backup" | "restore" | "copy";
  status: "waiting_source" | "waiting_target" | "done" | "failed" | "expired";
  sourceName: string | null;
  targetName: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  scope: "settings" | "profile";
  failure?: "playlist" | "size" | "format";
  unchanged?: number;
};
type Snapshot = {
  devices: Device[];
  backups: Backup[];
  jobs: Job[];
  sync: { sourceId: string; targetId: string; nextAt: string; paused: number } | null;
};
type Request = z.infer<typeof webSettingsAction>;
type Confirmation =
  | Extract<Request, { action: "copy" | "delete" | "unlink" | "sync-on" }>
  | { action: "restore"; backupId: string };
type BackupFile = z.infer<typeof tvBackupFile>;
type EditableGroup = { id: string; name: string; pinned: boolean; count: number };
const supportsProfile = (device: Device) =>
  device.compatible && device.protocol === 2 && device.playlistReady;
const kindLabel = (device: Device) =>
  device.kind === "mobile" ? "Android mobile / tablette" : device.kind === "tv" ? "Téléviseur" : "";
type View =
  | { state: "loading" | "error" | "inactive" | "session" }
  | { state: "ready"; data: Snapshot; stale: boolean };
type Feedback = { text: string; error?: true; track?: true };

const endpoint = "/api/settings-backups";
const pollMs = 4000;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function isPending({ status }: Job) {
  return status === "waiting_source" || status === "waiting_target";
}

function canSend(data: Snapshot, request: Request) {
  const compatible = (id: string) =>
    data.devices.some((entry) => entry.id === id && entry.compatible);
  const saved = (id: string) => data.backups.some((entry) => entry.id === id);
  switch (request.action) {
    case "backup":
      return !!request.name && compatible(request.sourceId);
    case "copy":
      return (
        request.sourceId !== request.targetId &&
        compatible(request.sourceId) &&
        compatible(request.targetId)
      );
    case "restore":
      return saved(request.backupId) && compatible(request.targetId);
    case "delete":
      return saved(request.backupId);
    case "pair":
      return /^[A-Fa-f0-9]{16}$/.test(request.pairingCode.trim().replaceAll("-", ""));
    case "unlink":
      return data.devices.some((entry) => entry.id === request.deviceId);
    case "import":
      return !!request.name;
    case "edit-groups":
      return saved(request.backupId);
    case "sync-on":
      return (
        request.sourceId !== request.targetId &&
        [request.sourceId, request.targetId].every((id) =>
          data.devices.some((d) => d.id === id && supportsProfile(d)),
        )
      );
    case "sync-off":
      return !!data.sync;
  }
}

function useTvSettings(accountId: string) {
  const [view, setView] = useState<View>({ state: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState<Request["action"] | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const connection = useRef<{
    refresh: () => Promise<void>;
    send: (request: Request) => Promise<boolean>;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let token: string | undefined;
    let timer: number | undefined;
    let reading: Promise<void> | null = null;
    let snapshot: Snapshot | null = null;
    let stale = false;
    let posting = false;
    let needsSync = false;

    function loseSession() {
      controller.abort();
      window.clearTimeout(timer);
      setView({ state: "session" });
    }

    async function read(bearer: string) {
      try {
        const data = await portalApi<Snapshot>(endpoint, { token: bearer, signal });
        if (signal.aborted) return;
        if (
          !Array.isArray(data.devices) ||
          !Array.isArray(data.backups) ||
          !Array.isArray(data.jobs)
        ) {
          throw new Error("Réponse inattendue");
        }
        snapshot = data;
        stale = false;
        needsSync = false;
        setView({ state: "ready", data, stale: false });
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof PortalApiError && error.status === 401) {
          loseSession();
        } else if (error instanceof PortalApiError && error.status === 403) {
          snapshot = null;
          needsSync = false;
          setFeedback(null);
          setView({ state: "inactive" });
        } else {
          stale = true;
          setView(snapshot ? { state: "ready", data: snapshot, stale } : { state: "error" });
        }
      }
    }

    function schedule() {
      window.clearTimeout(timer);
      if (
        signal.aborted ||
        posting ||
        !(needsSync || snapshot?.jobs.some(isPending) || snapshot?.sync)
      )
        return;
      timer = window.setTimeout(
        () => void refresh(),
        needsSync || snapshot?.jobs.some(isPending) ? (stale ? pollMs * 2 : pollMs) : 15000,
      );
    }

    function refresh() {
      if (!token || signal.aborted) return;
      window.clearTimeout(timer);
      reading ??= read(token).finally(() => {
        reading = null;
        schedule();
      });
      return reading;
    }

    async function send(request: Request) {
      if (!token || signal.aborted || posting) return false;
      posting = true;
      window.clearTimeout(timer);
      setSending(request.action);
      setFeedback(null);
      try {
        // Let an in-flight read finish before writing, and pause polling until the follow-up read.
        await reading;
        if (signal.aborted) return false;
        if (!snapshot || stale || !canSend(snapshot, request)) {
          setFeedback({
            error: true,
            text: "Cette sélection n’est plus disponible. Actualisez la page et vérifiez votre choix.",
          });
          return false;
        }

        let accepted = false;
        needsSync = true;
        try {
          const result = await portalApi<{ ok: true }>(endpoint, {
            method: "POST",
            body: request,
            token,
            signal,
          });
          if (signal.aborted) return false;
          if (result.ok !== true) throw new Error();
          accepted = true;
          setFeedback(
            request.action === "import"
              ? { text: "La sauvegarde a été importée." }
              : request.action === "edit-groups"
                ? { text: "Groupes enregistrés. Restaurez cette sauvegarde pour les appliquer." }
                : request.action === "sync-on"
                  ? {
                      text: "Synchronisation activée. SHOW+ doit être ouvert sur l’appareil source pour envoyer ses données.",
                    }
                  : request.action === "sync-off"
                    ? { text: "Synchronisation désactivée." }
                    : request.action === "delete"
                      ? { text: "La sauvegarde a été supprimée." }
                      : request.action === "pair"
                        ? {
                            text: "L’appareil est associé. Laissez SHOW+ ouvert pour recevoir les demandes.",
                          }
                        : request.action === "unlink"
                          ? {
                              text: "L’appareil est dissocié. Vos sauvegardes restent disponibles.",
                            }
                          : {
                              text: "Demande enregistrée. SHOW+ doit être ouvert sur l’appareil concerné.",
                              track: true,
                            },
          );
        } catch (error) {
          if (signal.aborted) return false;
          if (error instanceof PortalApiError && error.status === 401) {
            loseSession();
            return false;
          }
          const rejected =
            error instanceof PortalApiError && error.status >= 400 && error.status < 500;
          setFeedback({
            error: true,
            text: rejected
              ? error.message
              : "La demande n’a pas pu être confirmée. Consultez l’activité avant de réessayer.",
          });
        }
        await refresh();
        return accepted && !signal.aborted;
      } finally {
        posting = false;
        if (!signal.aborted) {
          setSending(null);
          schedule();
        }
      }
    }

    connection.current = {
      send,
      async refresh() {
        if (!token || signal.aborted || posting) return;
        setRefreshing(true);
        await refresh();
        if (!signal.aborted) setRefreshing(false);
      },
    };

    // Bind the bearer token to the account shown by the page, even during a session switch.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (signal.aborted) return;
      if (
        !session?.access_token ||
        session.user.id !== accountId ||
        session.user.is_anonymous ||
        !session.user.email_confirmed_at
      ) {
        loseSession();
        return;
      }
      const firstSession = !token;
      token = session.access_token;
      if (firstSession) void refresh();
    });

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
      connection.current = null;
    };
  }, [accountId]);

  return {
    view,
    refreshing,
    sending,
    feedback,
    clearFeedback: () => setFeedback(null),
    refresh: () => connection.current?.refresh(),
    send: (request: Request) => connection.current?.send(request),
  };
}

function DateLabel({
  value,
  fallback = "Date indisponible",
}: {
  value: string | null;
  fallback?: string;
}) {
  if (!value || !Number.isFinite(Date.parse(value))) return <>{fallback}</>;
  return <time dateTime={value}>{dateFormat.format(new Date(value))}</time>;
}

function DeviceSelect({
  label,
  devices,
  value,
  onChange,
  disabled,
}: {
  label: string;
  devices: Device[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="tv-settings-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={devices.some((entry) => entry.id === value) ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || !devices.length}
        required
      >
        <option value="">Choisir un appareil</option>
        {devices.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
            {kindLabel(entry) && ` · ${kindLabel(entry)}`}
          </option>
        ))}
      </select>
    </div>
  );
}

const operations = {
  backup: { label: "Sauvegarde", icon: Archive, done: "Les réglages ont été sauvegardés." },
  restore: {
    label: "Restauration",
    icon: RotateCcw,
    done: "L’appareil a confirmé la restauration des réglages.",
  },
  copy: {
    label: "Copie",
    icon: ArrowRightLeft,
    done: "L’appareil de destination a confirmé la copie des réglages.",
  },
};

const jobStatuses = {
  waiting_source: "En attente de l’appareil source",
  waiting_target: "En attente de l’appareil de destination",
  done: "Terminée",
  failed: "Échec",
  expired: "Expirée",
};

function jobInstruction(job: Job) {
  const playlist =
    job.scope === "profile"
      ? " Rouvrez le profil et la playlist sélectionnés pour cette opération."
      : "";
  switch (job.status) {
    case "waiting_source":
      return `Ouvrez SHOW+ sur ${job.sourceName ? `« ${job.sourceName} »` : "l’appareil source"} pour envoyer les données.${playlist}`;
    case "waiting_target":
      return `${job.operation === "copy" ? "Données reçues de l’appareil source. " : ""}Ouvrez SHOW+ sur ${job.targetName ? `« ${job.targetName} »` : "l’appareil de destination"} pour les appliquer.${playlist}`;
    case "done":
      return job.unchanged
        ? "Aucun changement à envoyer depuis la dernière copie."
        : operations[job.operation].done;
    case "failed":
      if (job.failure === "size")
        return "Ce profil dépasse la taille maximale d’une sauvegarde. Vous pouvez sauvegarder les réglages seuls.";
      if (job.failure === "format")
        return "Cette playlist contient des données incompatibles. Vous pouvez sauvegarder les réglages seuls.";
      return "L’opération a échoué. Vérifiez la connexion et la version de VYRO sur l’appareil, puis relancez l’opération si nécessaire.";
    case "expired":
      return "La demande a expiré avant confirmation. Ouvrez VYRO sur l’appareil concerné, puis créez une nouvelle demande.";
  }
}

function Activity({ jobs }: { jobs: Job[] }) {
  const sorted = [...jobs].sort(
    (a, b) =>
      Number(isPending(b)) - Number(isPending(a)) ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  const pending = jobs.filter(isPending).length;
  return (
    <section
      className="account-card tv-settings-section"
      id="activite-tv"
      aria-labelledby="tv-activity-title"
      tabIndex={-1}
    >
      <div className="tv-settings-section-heading">
        <div>
          <p className="account-eyebrow">Suivi des demandes</p>
          <h2 id="tv-activity-title">Activité</h2>
        </div>
        <p role="status">
          {pending > 0 && (
            <span className="tv-settings-badge" data-tone="pending">
              {pending} {pending === 1 ? "opération en cours" : "opérations en cours"}
            </span>
          )}
        </p>
      </div>
      {sorted.length ? (
        <ul className="tv-settings-list">
          {sorted.map((job) => {
            const operation = operations[job.operation];
            const Icon = operation.icon;
            const pending = isPending(job);
            const StatusIcon = pending
              ? Clock3
              : job.status === "done"
                ? CheckCircle2
                : TriangleAlert;
            const stage =
              job.operation === "copy" && pending
                ? `Étape ${job.status === "waiting_source" ? "1" : "2"} sur 2 · `
                : "";
            return (
              <li key={job.id} className="tv-settings-row tv-settings-job">
                <span className="account-icon">
                  <Icon size={19} aria-hidden />
                </span>
                <div className="tv-settings-row-body">
                  <h3>
                    {operation.label}
                    {job.name && ` · ${job.name}`}
                  </h3>
                  <p className="tv-settings-meta">
                    {job.sourceName && <>Source : {job.sourceName} · </>}
                    {job.targetName && <>Destination : {job.targetName} · </>}
                    <DateLabel value={job.updatedAt} />
                  </p>
                  <div className="tv-settings-job-status" aria-live="polite">
                    <span
                      className="tv-settings-badge"
                      data-tone={
                        pending ? "pending" : job.status === "done" ? "positive" : "warning"
                      }
                    >
                      <StatusIcon size={14} aria-hidden /> {stage}
                      {jobStatuses[job.status]}
                    </span>
                    <p>{jobInstruction(job)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="tv-settings-empty">
          Aucune opération pour le moment. Vos demandes et leur état apparaîtront ici.
        </p>
      )}
    </section>
  );
}

function TvSettingsPage() {
  const { user } = useAuth();
  return user ? <TvSettingsWorkspace key={user.id} accountId={user.id} /> : null;
}

function TvSettingsWorkspace({ accountId }: { accountId: string }) {
  const { view, refreshing, sending, feedback, clearFeedback, refresh, send } =
    useTvSettings(accountId);
  const [backupSource, setBackupSource] = useState("");
  const [backupScope, setBackupScope] = useState<"settings" | "profile">("settings");
  const [name, setName] = useState("");
  const [copySource, setCopySource] = useState("");
  const [copyTarget, setCopyTarget] = useState("");
  const [copyScope, setCopyScope] = useState<"settings" | "profile">("settings");
  const [syncSource, setSyncSource] = useState("");
  const [syncTarget, setSyncTarget] = useState("");
  const [importName, setImportName] = useState("");
  const [toolsError, setToolsError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [editor, setEditor] = useState<{ id: string; groups: EditableGroup[] } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingName, setPairingName] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const rawDevices = view.state === "ready" ? view.data.devices : [];
  const devices = rawDevices.map((device) =>
    rawDevices.some((other) => other.id !== device.id && other.name === device.name)
      ? { ...device, name: `${device.name} · repère ${device.id.slice(-6).toUpperCase()}` }
      : device,
  );
  const backups = view.state === "ready" ? view.data.backups : [];
  const compatible = devices.filter((device) => device.compatible);
  const profileDevices = compatible.filter(supportsProfile);
  const backupDevices = backupScope === "profile" ? profileDevices : compatible;
  const copyDevices = copyScope === "profile" ? profileDevices : compatible;
  const copyTargets = copyDevices.filter((device) => device.id !== copySource);
  const writeDisabled = !!sending || view.state !== "ready" || view.stale;
  const canBackup = !!name.trim() && backupDevices.some((device) => device.id === backupSource);
  const copySourceSelected = copyDevices.some((device) => device.id === copySource);
  const canCopy = copySourceSelected && copyTargets.some((device) => device.id === copyTarget);
  const backup =
    confirmation && "backupId" in confirmation
      ? backups.find((entry) => entry.id === confirmation.backupId)
      : null;
  const source =
    confirmation?.action === "copy" || confirmation?.action === "sync-on"
      ? compatible.find((entry) => entry.id === confirmation.sourceId)
      : null;
  const destination = compatible.find(
    (entry) =>
      entry.id ===
      (confirmation?.action === "copy" || confirmation?.action === "sync-on"
        ? confirmation.targetId
        : restoreTarget),
  );
  const confirmationAvailable =
    confirmation?.action === "copy" || confirmation?.action === "sync-on"
      ? !!source && !!destination
      : confirmation?.action === "unlink"
        ? devices.some(({ id }) => id === confirmation.deviceId)
        : !!backup && (confirmation?.action !== "restore" || compatible.length > 0);

  useEffect(() => {
    if (view.state === "inactive" || view.state === "session") {
      setConfirmation(null);
      setEditor(null);
    }
  }, [view.state]);

  async function getFile(id: string, mode: "export" | "edit") {
    if (fileBusy) return;
    setFileBusy(true);
    setToolsError("");
    try {
      const file = tvBackupFile.parse(
        await portalApi<unknown>(`${endpoint}?backup=${encodeURIComponent(id)}`),
      );
      if (mode === "edit") {
        setEditor({
          id,
          groups:
            file.profile?.groups.map((g) => ({
              id: g.id,
              name: g.name,
              pinned: g.pinned,
              count: g.channels.length,
            })) ?? [],
        });
      } else {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "vyro-sauvegarde-" + id.slice(0, 8) + ".json";
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      setToolsError(
        error instanceof PortalApiError ? error.message : "Impossible de lire cette sauvegarde.",
      );
    } finally {
      setFileBusy(false);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file || fileBusy) return;
    setFileBusy(true);
    setToolsError("");
    try {
      if (file.size > 1_000_000) throw new Error();
      const result = tvBackupFile.safeParse(JSON.parse(await file.text()) as unknown);
      if (!result.success) throw new Error();
      if (
        await send({
          action: "import",
          name: importName.trim() || "Sauvegarde importée",
          file: result.data as BackupFile,
        })
      )
        setImportName("");
    } catch {
      setToolsError("Choisissez un fichier de sauvegarde JSON exporté depuis Vyro.");
    } finally {
      setFileBusy(false);
    }
  }

  function editGroup(index: number, change: Partial<Pick<EditableGroup, "name" | "pinned">>) {
    setEditor(
      (current) =>
        current && {
          ...current,
          groups: current.groups.map((g, i) => (i === index ? { ...g, ...change } : g)),
        },
    );
  }
  function moveGroup(index: number, step: number) {
    setEditor((current) => {
      if (!current) return current;
      const from = current.groups[index];
      const to = current.groups[index + step];
      if (!from || !to) return current;
      const groups = [...current.groups];
      groups[index] = to;
      groups[index + step] = from;
      return { ...current, groups };
    });
  }

  function ask(request: Confirmation, trigger: HTMLButtonElement) {
    returnFocus.current = trigger;
    setRestoreTarget("");
    clearFeedback();
    setConfirmation(request);
  }

  async function confirm() {
    if (!confirmation || !confirmationAvailable || writeDisabled) return;
    if (confirmation.action === "restore" && !destination) return;
    const request =
      confirmation.action === "restore"
        ? { ...confirmation, targetId: restoreTarget }
        : confirmation;
    if (await send(request)) setConfirmation(null);
  }

  return (
    <div className="account-page tv-settings">
      <header className="tv-settings-hero">
        <div>
          <p className="account-eyebrow">SHOW+ · Appareils liés</p>
          <h1 ref={pageHeading} tabIndex={-1}>
            Sauvegardes
          </h1>
          <p className="tv-settings-intro">
            Sauvegardez vos réglages SHOW+ et retrouvez-les sur votre téléviseur, téléphone ou
            tablette Android.
          </p>
          {view.state !== "session" && (
            <div className="tv-settings-actions">
              <button
                type="button"
                className="account-button"
                disabled={view.state === "loading" || refreshing || !!sending}
                onClick={() => void refresh()}
              >
                <RefreshCw size={16} aria-hidden /> {refreshing ? "Actualisation…" : "Actualiser"}
              </button>
              {view.state === "ready" && view.data.jobs.length > 0 && (
                <a href="#activite-tv" className="account-button">
                  Voir l’activité <ArrowDown size={16} aria-hidden />
                </a>
              )}
            </div>
          )}
        </div>
        <div className="tv-settings-art" aria-hidden>
          <Monitor className="tv-settings-art-screen" size={100} strokeWidth={1.4} />
          <SlidersHorizontal className="tv-settings-art-sliders" size={38} strokeWidth={1.65} />
        </div>
      </header>

      {view.state === "loading" && (
        <PortalNotice>Chargement des appareils et des sauvegardes…</PortalNotice>
      )}
      {view.state === "error" && (
        <PortalNotice error>
          Impossible de charger vos sauvegardes. Réessayez avec « Actualiser ».
        </PortalNotice>
      )}
      {view.state === "inactive" && (
        <section className="account-card tv-settings-state">
          <span className="account-icon">
            <ShieldCheck size={22} aria-hidden />
          </span>
          <div>
            <h2>Un accès VYRO Premium actif est nécessaire</h2>
            <p>Consultez votre abonnement pour retrouver l’accès aux sauvegardes.</p>
            <Link to="/account/abonnement" className="account-button account-button-primary">
              Mon abonnement <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      )}
      {view.state === "session" && (
        <section className="account-card tv-settings-state">
          <span className="account-icon">
            <ShieldCheck size={22} aria-hidden />
          </span>
          <div>
            <h2>Connexion nécessaire</h2>
            <p>Reconnectez-vous pour retrouver vos appareils et vos sauvegardes.</p>
            <Link to="/login" className="account-button account-button-primary">
              Se connecter <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      )}

      {view.state === "ready" && (
        <>
          {view.stale && (
            <PortalNotice error>
              L’actualisation a échoué. Les informations affichées peuvent être anciennes.
              Actualisez avant de lancer une opération.
            </PortalNotice>
          )}
          {feedback && !confirmation && (
            <PortalNotice error={feedback.error ?? false}>
              {feedback.text}
              {feedback.track && (
                <>
                  {" "}
                  <a href="#activite-tv" className="tv-settings-feedback-link">
                    Suivre la demande
                  </a>
                </>
              )}
            </PortalNotice>
          )}
          {toolsError && <PortalNotice error>{toolsError}</PortalNotice>}
          <aside className="tv-settings-scope" aria-label="Réglages inclus">
            <span className="account-icon">
              <ShieldCheck size={20} aria-hidden />
            </span>
            <div>
              <strong>Ce que VYRO sauvegarde</strong>
              <p>
                Choisissez les réglages seuls ou ajoutez les groupes TV, favoris, liste « À voir »,
                catégories visibles et historique de la playlist ouverte. Pour ce deuxième choix,
                ouvrez la même playlist sur les appareils concernés. Les accès aux playlists restent
                sur vos appareils.
              </p>
            </div>
          </aside>

          <section className="account-card tv-settings-section" aria-labelledby="tv-pair-title">
            <div className="tv-settings-card-heading">
              <span className="account-icon">
                <Monitor size={21} aria-hidden />
              </span>
              <div>
                <h2 id="tv-pair-title">Associer un appareil</h2>
                <p>
                  Dans SHOW+, ouvrez Sauvegardes depuis la rubrique À propos sur TV, ou Informations
                  et maintenance sur Android mobile. Affichez un code de liaison, puis saisissez-le
                  ici dans les cinq minutes.
                </p>
              </div>
            </div>
            <form
              className="tv-settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  writeDisabled ||
                  !/^[A-Fa-f0-9]{16}$/.test(pairingCode.trim().replaceAll("-", ""))
                )
                  return;
                void send({
                  action: "pair",
                  pairingCode,
                  name: pairingName.trim() || undefined,
                })?.then((accepted) => {
                  if (accepted) {
                    setPairingCode("");
                    setPairingName("");
                  }
                });
              }}
            >
              <div className="tv-settings-field">
                <label htmlFor="tv-pairing-code">Code de liaison</label>
                <input
                  id="tv-pairing-code"
                  value={pairingCode}
                  onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
                  placeholder="0000-0000-0000-0000"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={19}
                  required
                  disabled={writeDisabled}
                />
              </div>
              <div className="tv-settings-field">
                <label htmlFor="tv-pairing-name">Nom de l’appareil (facultatif)</label>
                <input
                  id="tv-pairing-name"
                  value={pairingName}
                  onChange={(event) => setPairingName(event.target.value)}
                  placeholder="Ex. Mon téléphone"
                  maxLength={64}
                  disabled={writeDisabled}
                />
              </div>
              <button
                className="account-button account-button-primary"
                type="submit"
                disabled={writeDisabled}
              >
                {sending === "pair" ? "Association…" : "Associer l’appareil"}
              </button>
            </form>
          </section>

          <div className="tv-settings-operation-grid">
            <section
              className="account-card tv-settings-operation"
              aria-labelledby="tv-create-title"
            >
              <div className="tv-settings-card-heading">
                <span className="account-icon">
                  <Archive size={21} aria-hidden />
                </span>
                <div>
                  <h2 id="tv-create-title">Créer une sauvegarde</h2>
                  <p>Ouvrez SHOW+ sur l’appareil dont vous souhaitez conserver les réglages.</p>
                </div>
              </div>
              {compatible.length ? (
                <form
                  className="tv-settings-form"
                  aria-busy={sending === "backup"}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (writeDisabled || !canBackup) return;
                    void send({
                      action: "backup",
                      sourceId: backupSource,
                      name: name.trim(),
                      scope: backupScope,
                    })?.then((accepted) => {
                      if (accepted) setName("");
                    });
                  }}
                >
                  <DeviceSelect
                    label="Appareil à sauvegarder"
                    devices={backupDevices}
                    value={backupSource}
                    onChange={setBackupSource}
                    disabled={writeDisabled}
                  />
                  <label className="tv-settings-choice">
                    <input
                      type="checkbox"
                      checked={backupScope === "profile"}
                      onChange={(event) =>
                        setBackupScope(event.target.checked ? "profile" : "settings")
                      }
                    />
                    Inclure les données de la playlist ouverte
                  </label>
                  <div className="tv-settings-field">
                    <label htmlFor="tv-backup-name">Nom de la sauvegarde</label>
                    <input
                      id="tv-backup-name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ex. Réglages du salon"
                      maxLength={64}
                      disabled={writeDisabled}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="account-button account-button-primary"
                    disabled={writeDisabled || !canBackup}
                  >
                    <Archive size={16} aria-hidden />{" "}
                    {sending === "backup" ? "Envoi de la demande…" : "Sauvegarder"}
                  </button>
                </form>
              ) : (
                <p className="tv-settings-empty">
                  {devices.length
                    ? "Ouvrez une version récente de VYRO sur votre appareil, puis actualisez cette page."
                    : "Associez un appareil à votre compte pour créer une sauvegarde."}
                </p>
              )}
            </section>

            <section className="account-card tv-settings-operation" aria-labelledby="tv-copy-title">
              <div className="tv-settings-card-heading">
                <span className="account-icon">
                  <ArrowRightLeft size={21} aria-hidden />
                </span>
                <div>
                  <h2 id="tv-copy-title">Copier vers un autre appareil</h2>
                  <p>Transférez vos réglages sans créer de sauvegarde.</p>
                </div>
              </div>
              {compatible.length > 1 ? (
                <div className="tv-settings-form">
                  <DeviceSelect
                    label="Appareil source"
                    devices={copyDevices}
                    value={copySource}
                    onChange={(value) => {
                      setCopySource(value);
                      if (value === copyTarget) setCopyTarget("");
                    }}
                    disabled={writeDisabled}
                  />
                  <label className="tv-settings-choice">
                    <input
                      type="checkbox"
                      checked={copyScope === "profile"}
                      onChange={(event) =>
                        setCopyScope(event.target.checked ? "profile" : "settings")
                      }
                    />
                    Inclure les données de la playlist ouverte
                  </label>
                  <DeviceSelect
                    label="Appareil de destination"
                    devices={copyTargets}
                    value={copyTarget}
                    onChange={setCopyTarget}
                    disabled={writeDisabled || !copySourceSelected}
                  />
                  <button
                    type="button"
                    className="account-button"
                    disabled={writeDisabled || !canCopy}
                    onClick={(event) =>
                      ask(
                        {
                          action: "copy",
                          sourceId: copySource,
                          targetId: copyTarget,
                          scope: copyScope,
                        },
                        event.currentTarget,
                      )
                    }
                  >
                    <ArrowRightLeft size={16} aria-hidden /> Préparer la copie
                  </button>
                </div>
              ) : (
                <p className="tv-settings-empty">
                  La copie nécessite deux appareils associés avec une version compatible de SHOW+.
                </p>
              )}
            </section>
          </div>

          <section className="account-card tv-settings-section" aria-labelledby="tv-sync-title">
            <div className="tv-settings-section-heading">
              <div>
                <p className="account-eyebrow">Appareils liés</p>
                <h2 id="tv-sync-title">Synchronisation automatique</h2>
              </div>
            </div>
            <p className="tv-settings-meta">
              L’appareil principal envoie ses changements à l’autre appareil. Toutes les 15 minutes
              environ, si SHOW+ est ouvert sur l’appareil principal. La synchronisation reste liée à
              la playlist et aux profils ouverts au moment de la configuration.
            </p>
            {view.data.sync ? (
              <div className="tv-settings-actions">
                <span
                  className="tv-settings-badge"
                  data-tone={view.data.sync.paused ? "warning" : "positive"}
                >
                  {devices.find((d) => d.id === view.data.sync?.sourceId)?.name ??
                    "Appareil principal"}{" "}
                  → {devices.find((d) => d.id === view.data.sync?.targetId)?.name ?? "Destination"}
                </span>
                {!!view.data.sync.paused && (
                  <p className="tv-settings-meta">
                    En pause : rouvrez les profils et la playlist d’origine.
                  </p>
                )}
                <button
                  type="button"
                  className="account-button"
                  disabled={writeDisabled}
                  onClick={() => void send({ action: "sync-off" })}
                >
                  Désactiver
                </button>
              </div>
            ) : profileDevices.length >= 2 ? (
              <div className="tv-settings-form">
                <DeviceSelect
                  label="Appareil principal"
                  devices={profileDevices}
                  value={syncSource}
                  onChange={(id) => {
                    setSyncSource(id);
                    if (id === syncTarget) setSyncTarget("");
                  }}
                />
                <DeviceSelect
                  label="Appareil à synchroniser"
                  devices={profileDevices.filter((d) => d.id !== syncSource)}
                  value={syncTarget}
                  onChange={setSyncTarget}
                  disabled={!syncSource}
                />
                <button
                  type="button"
                  className="account-button"
                  disabled={writeDisabled || !syncSource || !syncTarget}
                  onClick={(event) =>
                    ask(
                      { action: "sync-on", sourceId: syncSource, targetId: syncTarget },
                      event.currentTarget,
                    )
                  }
                >
                  Configurer
                </button>
              </div>
            ) : (
              <p className="tv-settings-empty">
                Ouvrez SHOW+ à jour et chargez la même playlist sur deux appareils associés.
              </p>
            )}
          </section>

          <section className="account-card tv-settings-section" aria-labelledby="tv-backups-title">
            <div className="tv-settings-section-heading">
              <div>
                <p className="account-eyebrow">Réglages enregistrés</p>
                <h2 id="tv-backups-title">Mes sauvegardes</h2>
              </div>
              <span className="tv-settings-badge">
                {backups.length} {backups.length === 1 ? "sauvegarde" : "sauvegardes"}
              </span>
            </div>
            <div className="tv-settings-form tv-settings-import">
              <div className="tv-settings-field">
                <label htmlFor="tv-import-name">Nom du fichier importé (facultatif)</label>
                <input
                  id="tv-import-name"
                  value={importName}
                  maxLength={64}
                  onChange={(event) => setImportName(event.target.value)}
                  placeholder="Sauvegarde importée"
                />
              </div>
              <label className="account-button" aria-disabled={writeDisabled || fileBusy}>
                <Upload size={16} aria-hidden /> Importer un fichier JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  disabled={writeDisabled || fileBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void importFile(file);
                  }}
                />
              </label>
            </div>
            {backups.length ? (
              <>
                {!compatible.length && (
                  <p className="tv-settings-meta">
                    Pour restaurer une sauvegarde, associez ou mettez à jour un appareil compatible.
                  </p>
                )}
                <ul className="tv-settings-list">
                  {[...backups]
                    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                    .map((entry) => (
                      <li key={entry.id} className="tv-settings-row">
                        <span className="account-icon">
                          <Archive size={19} aria-hidden />
                        </span>
                        <div className="tv-settings-row-body">
                          <h3>{entry.name}</h3>
                          <p className="tv-settings-meta">
                            {entry.sourceName} · <DateLabel value={entry.createdAt} /> ·{" "}
                            {entry.fullProfile ? "Réglages et playlist" : "Réglages seuls"}
                          </p>
                        </div>
                        <div className="tv-settings-row-actions">
                          <button
                            type="button"
                            className="account-button"
                            disabled={fileBusy}
                            onClick={() => void getFile(entry.id, "export")}
                          >
                            <Download size={16} aria-hidden /> Exporter
                          </button>
                          {entry.fullProfile && (
                            <button
                              type="button"
                              className="account-button"
                              disabled={writeDisabled || fileBusy}
                              onClick={() => void getFile(entry.id, "edit")}
                            >
                              Organiser les groupes
                            </button>
                          )}
                          <button
                            type="button"
                            className="account-button"
                            disabled={writeDisabled || !compatible.length}
                            aria-label={`Restaurer ${entry.name}`}
                            onClick={(event) =>
                              ask({ action: "restore", backupId: entry.id }, event.currentTarget)
                            }
                          >
                            <RotateCcw size={16} aria-hidden /> Restaurer
                          </button>
                          <button
                            type="button"
                            className="account-button account-button-danger"
                            disabled={writeDisabled}
                            aria-label={`Supprimer ${entry.name}`}
                            onClick={(event) =>
                              ask({ action: "delete", backupId: entry.id }, event.currentTarget)
                            }
                          >
                            <Trash2 size={16} aria-hidden /> Supprimer
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </>
            ) : (
              <p className="tv-settings-empty">
                Aucune sauvegarde pour le moment. Elle apparaîtra ici une fois les réglages reçus de
                votre appareil.
              </p>
            )}
          </section>

          <Activity jobs={view.data.jobs} />

          <section
            className="account-card tv-settings-section"
            aria-labelledby="tv-compatible-title"
          >
            <div className="tv-settings-section-heading">
              <div>
                <p className="account-eyebrow">Compatibilité</p>
                <h2 id="tv-compatible-title">Mes appareils associés</h2>
              </div>
            </div>
            {devices.length ? (
              <>
                <ul className="tv-settings-list">
                  {devices.map((device) => (
                    <li key={device.id} className="tv-settings-row">
                      <span className="account-icon">
                        {device.kind === "mobile" ? (
                          <Smartphone size={19} aria-hidden />
                        ) : (
                          <Monitor size={19} aria-hidden />
                        )}
                      </span>
                      <div className="tv-settings-row-body">
                        <h3>{device.name}</h3>
                        <p className="tv-settings-meta">
                          {kindLabel(device) && `${kindLabel(device)} · `}
                          Dernière activité :{" "}
                          <DateLabel value={device.lastSeen} fallback="inconnue" />
                        </p>
                      </div>
                      <span
                        className="tv-settings-badge"
                        data-tone={device.compatible ? "positive" : "warning"}
                      >
                        {device.compatible ? "Compatible" : "Compatibilité non confirmée"}
                      </span>
                      <button
                        className="account-button account-button-danger"
                        type="button"
                        disabled={writeDisabled}
                        aria-label={`Dissocier ${device.name}`}
                        onClick={(event) =>
                          ask({ action: "unlink", deviceId: device.id }, event.currentTarget)
                        }
                      >
                        Dissocier
                      </button>
                    </li>
                  ))}
                </ul>
                {compatible.length !== devices.length && (
                  <div className="tv-settings-update">
                    <p>
                      Les anciennes versions de VYRO ne prennent pas en charge les sauvegardes.
                      Installez la dernière version, ouvrez-la sur l’appareil, puis actualisez cette
                      page.
                    </p>
                    <Link to="/account/telechargement" className="account-button">
                      Télécharger VYRO <ArrowRight size={16} aria-hidden />
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="tv-settings-empty">
                <p>Aucun appareil associé aux sauvegardes.</p>
              </div>
            )}
          </section>
        </>
      )}

      <AlertDialog
        open={confirmation !== null && view.state === "ready"}
        onOpenChange={(open) => {
          if (!open && !sending) setConfirmation(null);
        }}
      >
        <AlertDialogContent
          className="account-dialog tv-settings-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const trigger = returnFocus.current;
            if (trigger?.isConnected && !trigger.disabled) trigger.focus();
            else pageHeading.current?.focus();
          }}
        >
          <AlertDialogTitle>
            {confirmation?.action === "delete"
              ? "Supprimer la sauvegarde ?"
              : confirmation?.action === "sync-on"
                ? "Activer la synchronisation automatique ?"
                : confirmation?.action === "unlink"
                  ? "Dissocier cet appareil ?"
                  : confirmation?.action === "copy"
                    ? "Copier et remplacer les réglages ?"
                    : "Restaurer une sauvegarde ?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {!confirmationAvailable
              ? "Cette sélection n’est plus disponible. Fermez cette fenêtre et vérifiez la liste."
              : confirmation?.action === "delete"
                ? `La sauvegarde « ${backup?.name} » sera supprimée de votre compte. Cette suppression est définitive.`
                : confirmation?.action === "sync-on"
                  ? `« ${source?.name} » devient l’appareil principal. Ses réglages, groupes, favoris et historique remplaceront ceux de « ${destination?.name} » lorsqu’ils changent. La synchronisation se fait dans ce sens uniquement.`
                  : confirmation?.action === "unlink"
                    ? "Cet appareil ne recevra plus de demandes. Ses opérations en attente seront annulées et les sauvegardes déjà créées resteront dans votre compte."
                    : confirmation?.action === "copy"
                      ? `Les ${confirmation.scope === "profile" ? "réglages et les données de la playlist" : "réglages"} de « ${source?.name} » remplaceront ceux de « ${destination?.name} ». Ouvrez SHOW+ sur la source puis sur la destination.`
                      : `La sauvegarde « ${backup?.name} » remplacera ${backup?.fullProfile ? "les réglages et les données de la playlist" : "les réglages"} sur l’appareil choisi. ${backup?.fullProfile ? "Ouvrez la même playlist sur cet appareil." : "Ouvrez SHOW+ pour appliquer la restauration."}`}
          </AlertDialogDescription>
          {confirmation?.action === "restore" && confirmationAvailable && (
            <DeviceSelect
              label="Appareil à restaurer"
              devices={backup?.fullProfile ? profileDevices : compatible}
              value={restoreTarget}
              onChange={setRestoreTarget}
              disabled={writeDisabled}
            />
          )}
          {view.state === "ready" && view.stale && (
            <PortalNotice error>
              Impossible de vérifier la sélection. Fermez cette fenêtre et actualisez la page.
            </PortalNotice>
          )}
          {feedback?.error && <PortalNotice error>{feedback.text}</PortalNotice>}
          <AlertDialogFooter className="tv-settings-dialog-actions">
            <AlertDialogCancel className="account-button" disabled={!!sending}>
              Annuler
            </AlertDialogCancel>
            <button
              type="button"
              className={
                confirmation?.action === "delete"
                  ? "account-button account-button-danger-solid"
                  : "account-button account-button-primary"
              }
              disabled={
                writeDisabled ||
                !confirmationAvailable ||
                (confirmation?.action === "restore" && !destination)
              }
              onClick={() => void confirm()}
            >
              {sending
                ? "Envoi…"
                : confirmation?.action === "delete"
                  ? "Supprimer définitivement"
                  : confirmation?.action === "unlink"
                    ? "Dissocier l’appareil"
                    : confirmation?.action === "sync-on"
                      ? "Activer la synchronisation"
                      : confirmation?.action === "copy"
                        ? "Confirmer la copie"
                        : "Restaurer et remplacer"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={editor !== null && view.state === "ready"}
        onOpenChange={(open) => {
          if (!open && !sending) setEditor(null);
        }}
      >
        <AlertDialogContent className="account-dialog tv-settings-dialog tv-settings-group-dialog">
          <AlertDialogTitle>Organiser les groupes TV</AlertDialogTitle>
          <AlertDialogDescription>
            Les groupes épinglés s’affichent en premier. Restaurez la sauvegarde sur un appareil
            pour y appliquer les changements.
          </AlertDialogDescription>
          {editor?.groups.length ? (
            <ul className="tv-settings-list tv-settings-group-list">
              {editor.groups.map((group, index) => (
                <li key={group.id} className="tv-settings-group">
                  <div className="tv-settings-field">
                    <label htmlFor={`group-${index}`}>
                      Groupe {index + 1} · {group.count} chaîne(s)
                    </label>
                    <input
                      id={`group-${index}`}
                      value={group.name}
                      maxLength={80}
                      onChange={(event) => editGroup(index, { name: event.target.value })}
                    />
                  </div>
                  <label className="tv-settings-choice">
                    <input
                      type="checkbox"
                      checked={group.pinned}
                      onChange={(event) => editGroup(index, { pinned: event.target.checked })}
                    />{" "}
                    Épingler
                  </label>
                  <button
                    type="button"
                    className="account-button"
                    aria-label={`Monter ${group.name}`}
                    disabled={index === 0}
                    onClick={() => moveGroup(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="account-button"
                    aria-label={`Descendre ${group.name}`}
                    disabled={index === editor.groups.length - 1}
                    onClick={() => moveGroup(index, 1)}
                  >
                    ↓
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tv-settings-empty">
              Cette sauvegarde ne contient aucun groupe personnalisé.
            </p>
          )}
          {feedback?.error && <PortalNotice error>{feedback.text}</PortalNotice>}
          <AlertDialogFooter>
            <AlertDialogCancel className="account-button" disabled={!!sending}>
              Fermer
            </AlertDialogCancel>
            <button
              type="button"
              className="account-button account-button-primary"
              disabled={
                writeDisabled || !editor?.groups.length || editor.groups.some((g) => !g.name.trim())
              }
              onClick={() => {
                if (editor)
                  void send({
                    action: "edit-groups",
                    backupId: editor.id,
                    groups: editor.groups.map(({ id, name, pinned }) => ({ id, name, pinned })),
                  })?.then((ok) => {
                    if (ok) setEditor(null);
                  });
              }}
            >
              Enregistrer les groupes
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
