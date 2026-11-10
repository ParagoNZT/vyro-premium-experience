import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { portalApi } from "@/lib/portal-api";
import { qrProof } from "@/lib/remote-contract";
import { Button } from "@/components/ui/button";
import "@/components/site/account-workspace.css";

const key = "vyro:qr-association";
export const Route = createFileRoute("/associer")({
  head: () => ({
    meta: [
      { title: "Associer un appareil – VYRO" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Pair,
});

function Pair() {
  const { ready, user, refreshAccount } = useAuth();
  const [proof, setProof] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [device, setDevice] = useState<{ name: string; edition: string; kind: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const fragment = qrProof.safeParse(location.hash.slice(1));
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
    if (fragment.success) sessionStorage.setItem(key, fragment.data);
    const pending = qrProof.safeParse(sessionStorage.getItem(key));
    if (pending.success) setProof(pending.data);
    setLoaded(true);
  }, []);
  const userId = user?.id;
  useEffect(() => {
    if (!ready || !userId || !proof || done) return;
    const controller = new AbortController();
    setError("");
    setDevice(null);
    void portalApi<{ name: string; edition: string; kind: string }>("/api/remote-workspace", {
      method: "POST",
      body: { action: "preview", proof },
      signal: controller.signal,
    })
      .then(setDevice)
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [ready, userId, proof, done]);
  async function confirm() {
    setBusy(true);
    try {
      await portalApi("/api/remote-workspace", {
        method: "POST",
        body: { action: "claim", proof },
      });
      sessionStorage.removeItem(key);
      setDone(true);
      void refreshAccount().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L’association a échoué.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground">
      <section className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <QrCode className="text-primary" aria-hidden />
        <h1 className="font-display text-2xl font-bold">Associer un appareil</h1>
        {!loaded || !ready ? (
          <p>Vérification…</p>
        ) : done ? (
          <>
            <p role="status">
              Appareil associé. Laissez l’application ouverte pour que ses playlists apparaissent.
            </p>
            <Button asChild>
              <Link to="/account/gestion">Ouvrir la gestion à distance</Link>
            </Button>
            <p>
              <Link
                to="/account/appareils"
                hash="appareils-gestion"
                className="text-sm text-primary underline"
              >
                Voir l’appareil dans Mes appareils
              </Link>
            </p>
          </>
        ) : !proof ? (
          <p>
            Ouvrez <strong>Réglages → À propos → Gestion à distance</strong> dans l’application et
            scannez le QR code de votre appareil.
          </p>
        ) : !user ? (
          <>
            <p>Connectez-vous à VYRO pour choisir le compte qui gérera cet appareil.</p>
            <Button asChild>
              <Link to="/login" search={{ redirect: "/associer" }}>
                Se connecter
              </Link>
            </Button>
          </>
        ) : (
          <>
            {device && (
              <>
                <p>
                  <strong>{device.name}</strong> · {device.edition === "vyro" ? "VYRO" : "SHOW+"} ·{" "}
                  {device.kind === "tv" ? "TV" : "Mobile"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Associer cet appareil à {user.email} ? Ce compte pourra gérer les playlists et
                  demander des sauvegardes du profil Android qui affiche le QR code.
                </p>
                <Button onClick={() => void confirm()} disabled={busy || !!error}>
                  {busy ? "Association…" : "Confirmer l’association"}
                </Button>
              </>
            )}
            {!device && !error && <p>Recherche de l’appareil…</p>}
            {error && (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
