import { createFileRoute } from "@tanstack/react-router";
import { Download, MonitorDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DOWNLOADS } from "@/config/site";
import { useAuth } from "@/lib/auth";
import { portalApi } from "@/lib/portal-api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/site/Button";
import { PortalHeading, PortalNotice } from "@/components/site/AuthShell";

export const Route = createFileRoute("/account/telechargement")({
  head: () => ({
    meta: [{ title: "Téléchargements – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountDownloadPage,
});

function AccountDownloadPage() {
  const { isActive, user } = useAuth();
  return <DownloadPanel key={user?.id ?? "guest"} isActive={isActive} />;
}

function DownloadPanel({ isActive }: { isActive: boolean }) {
  const [published, setPublished] = useState<string[] | null>(null);
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => transfer.current?.abort(), [isActive]);
  useEffect(() => {
    if (!isActive) return;
    const controller = new AbortController();
    void portalApi<{ platforms: string[] }>("/api/download", {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPublished(result.platforms);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setIssue("Impossible de vérifier les fichiers disponibles.");
      });
    return () => controller.abort();
  }, [attempt, isActive]);

  async function download(id: string) {
    if (transfer.current || !isActive) return;
    const controller = new AbortController();
    transfer.current = controller;
    setBusy(id);
    setIssue("");
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error();
      const response = await fetch("/api/download?platform=" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (
        !response.ok ||
        response.headers.get("content-type") !== "application/vnd.android.package-archive"
      )
        throw new Error();
      const apk = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(apk);
      const link = document.createElement("a");
      link.href = url;
      link.download = "vyro-premium-" + id + ".apk";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (!controller.signal.aborted)
        setIssue("Le téléchargement n’a pas abouti. Vérifiez votre licence ou réessayez.");
    } finally {
      setBusy(null);
      transfer.current = null;
    }
  }

  return (
    <div className="portal-enter">
      <PortalHeading label="VYRO / Installation" title="Installer VYRO Premium">
        Téléchargez le fichier officiel correspondant à votre appareil et suivez les étapes
        d’installation.
      </PortalHeading>
      <div className="portal-panel portal-glow mt-7 flex flex-wrap items-center gap-4 p-5 sm:p-7">
        <MonitorDown aria-hidden className="size-6 shrink-0 text-primary" />
        <p className="min-w-52 flex-1 text-sm text-muted-foreground" role="status">
          {!isActive
            ? "Une licence active est nécessaire pour accéder aux fichiers d’installation."
            : published?.length === 0
              ? "Aucun fichier d’installation n’est publié pour le moment."
              : published
                ? "Choisissez le fichier correspondant à votre plateforme."
                : issue
                  ? "Fichiers indisponibles."
                  : "Vérification des fichiers disponibles…"}
        </p>
        {!isActive && (
          <Button to="/tarifs" size="sm">
            Voir les offres
          </Button>
        )}
        {isActive && issue && published === null && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setIssue("");
              setAttempt((current) => current + 1);
            }}
          >
            Réessayer
          </Button>
        )}
      </div>
      {issue && (
        <div className="mt-4">
          <PortalNotice error>{issue}</PortalNotice>
        </div>
      )}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {DOWNLOADS.map((target) => (
          <section key={target.id} className="portal-panel p-5">
            <h2 className="font-display text-lg font-semibold">{target.platform}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{target.subtitle}</p>
            <ol className="mt-4 list-inside list-decimal space-y-2 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              {target.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {isActive && published?.includes(target.id) && (
              <Button
                className="mt-5"
                size="sm"
                disabled={busy !== null}
                onClick={() => void download(target.id)}
              >
                <Download className="size-4" aria-hidden />
                {busy === target.id ? "Téléchargement…" : "Télécharger l’APK"}
              </Button>
            )}
          </section>
        ))}
      </div>
      {isActive && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button to="/account/appareils" variant="secondary" size="sm">
            Gérer les accès
          </Button>
        </div>
      )}
    </div>
  );
}
