import { Search, TvMinimal } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import type { ShowDirectoryPage } from "@/lib/show-directory.server";

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export function ShowDirectory() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<ShowDirectoryPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: search, page: String(page) });
    void portalApi<ShowDirectoryPage>(`/api/show-directory?${params}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((issue: unknown) => {
        if (controller.signal.aborted) return;
        setResult(null);
        if (!(issue instanceof PortalApiError && [401, 403].includes(issue.status)))
          setError("Impossible de charger le répertoire revendeur.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, page, refresh]);

  if (!result && !error) return null;

  return (
    <section
      id="show-plus"
      className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="show-directory-title"
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
            SHOW+ / Revendeur
          </p>
          <h2 id="show-directory-title" className="font-display text-xl font-semibold">
            Utilisateurs SHOW+
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consultez les appareils enregistrés avec votre application.
          </p>
        </div>
        {result && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
            <TvMinimal className="size-4" aria-hidden /> {result.total}{" "}
            {result.total === 1 ? "appareil" : "appareils"}
          </span>
        )}
      </div>
      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Réessayer
          </Button>
        </div>
      ) : (
        result && (
          <>
            <form
              className="mt-5 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(0);
                setSearch(input.trim());
              }}
            >
              <label className="min-w-0 flex-1 text-sm">
                Rechercher
                <Input
                  className="mt-1"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  type="search"
                  placeholder="Nom ou référence SHP"
                  maxLength={80}
                />
              </label>
              <Button variant="outline" type="submit" disabled={loading}>
                <Search className="size-4" aria-hidden /> Rechercher
              </Button>
            </form>
            {loading ? (
              <p className="mt-5 text-sm text-muted-foreground" role="status">
                Chargement…
              </p>
            ) : result.devices.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                {search
                  ? "Aucun appareil ne correspond à cette recherche."
                  : "Aucun appareil SHOW+ enregistré."}
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      {["Appareil", "Référence d’assistance", "Accès", "Dernière activité"].map(
                        (label) => (
                          <th key={label} scope="col" className="px-3 py-2 font-medium">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border border-y border-border">
                    {result.devices.map((device) => (
                      <tr key={device.id}>
                        <th scope="row" className="px-3 py-3 font-medium">
                          {device.name}
                        </th>
                        <td className="whitespace-nowrap px-3 py-3">{device.supportRef ?? "—"}</td>
                        <td className="px-3 py-3">{device.enabled ? "Actif" : "Inactif"}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {device.lastSeen && Number.isFinite(Date.parse(device.lastSeen))
                            ? date.format(new Date(device.lastSeen))
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(result.page > 0 || result.hasMore) && (
              <nav
                className="mt-4 flex flex-wrap items-center justify-end gap-2"
                aria-label="Pages des appareils SHOW+"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || page === 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  Précédente
                </Button>
                <span className="px-2 text-sm text-muted-foreground">Page {result.page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || !result.hasMore}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Suivante
                </Button>
              </nav>
            )}
          </>
        )
      )}
    </section>
  );
}
