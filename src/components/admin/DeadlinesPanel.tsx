import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import type { DeadlinePage } from "@/lib/deadlines.server";

const labels = { license: "Licence VYRO", access: "Accès TV", updates: "Mises à jour annuelles" };
const destinations = { license: "licenses", access: "beta", updates: "partners" } as const;
const select = "min-h-9 rounded-md border border-input bg-background px-2 text-sm";
export function DeadlinesPanel({
  onAccessDenied,
}: {
  onAccessDenied: (status: 401 | 403) => void;
}) {
  const [data, setData] = useState<DeadlinePage>();
  const [owner, setOwner] = useState("");
  const [kind, setKind] = useState("all");
  const [horizon, setHorizon] = useState("30");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ owner, kind, horizon, query, page: String(page) });
    void portalApi<DeadlinePage>(`/api/admin-deadlines?${params}`, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof PortalApiError && (err.status === 401 || err.status === 403))
          onAccessDenied(err.status);
        else setError(err instanceof Error ? err.message : "Impossible de charger les échéances.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [owner, kind, horizon, query, page, onAccessDenied]);
  return (
    <section className="va-card mt-6 space-y-4">
      <h2 className="text-lg font-semibold">Échéances à suivre</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setQuery(draft.trim());
        }}
      >
        <label className="grid gap-1 text-sm">
          Période
          <select
            className={select}
            value={horizon}
            onChange={(e) => {
              setPage(0);
              setHorizon(e.target.value);
            }}
          >
            <option value="7">7 prochains jours</option>
            <option value="30">30 prochains jours</option>
            <option value="90">90 prochains jours</option>
            <option value="expired">Déjà expirées</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Type
          <select
            className={select}
            value={kind}
            onChange={(e) => {
              setPage(0);
              setKind(e.target.value);
            }}
          >
            <option value="all">Tous les types</option>
            {Object.entries(labels).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Client ou revendeur
          <select
            className={select}
            value={owner}
            onChange={(e) => {
              setPage(0);
              setOwner(e.target.value);
            }}
          >
            <option value="">Tous</option>
            {data?.owners.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Rechercher
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={100}
            placeholder="Nom ou e-mail"
          />
        </label>
        <Button variant="outline">Rechercher</Button>
      </form>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Chargement…
        </p>
      ) : (
        data &&
        (data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune échéance pour ces filtres.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">Nom</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Client ou revendeur</th>
                  <th className="p-2">Échéance</th>
                  <th className="p-2">Gestion</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr className="border-t border-border" key={r.kind + ":" + r.id}>
                    <td className="p-2">
                      <p className="font-medium">{r.name}</p>
                      {r.contact && r.contact !== r.name && (
                        <p className="text-muted-foreground">{r.contact}</p>
                      )}
                    </td>
                    <td className="p-2">{labels[r.kind]}</td>
                    <td className="p-2">{r.owner}</td>
                    <td className="whitespace-nowrap p-2">
                      <time dateTime={r.expiresAt}>
                        {new Date(r.expiresAt).toLocaleDateString("fr-FR")}
                      </time>
                    </td>
                    <td className="p-2">
                      <Link
                        to="/admin"
                        search={{ section: destinations[r.kind] }}
                        className="va-text-link"
                      >
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
      {(page > 0 || data?.hasMore) && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page === 0}
            onClick={() => setPage(page - 1)}
          >
            Précédent
          </Button>
          <span className="text-sm">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !data?.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
    </section>
  );
}
