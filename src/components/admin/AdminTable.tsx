import type { ReactNode } from "react";

export function AdminTable({
  label,
  columns,
  children,
  empty,
}: {
  label: string;
  columns: string[];
  children: ReactNode;
  empty?: string | undefined;
}) {
  if (empty)
    return (
      <p role="status" className="portal-panel p-6 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  return (
    <div
      className="portal-panel overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className="w-full min-w-[40rem] text-left text-sm [&_td]:px-4 [&_td]:py-3.5 [&_th]:px-4 [&_th]:py-3">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-surface-2 text-xs text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function AdminStats({ stats }: { stats: Array<{ label: string; value: string | number }> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {stats.map(({ label, value }) => (
        <div key={label} className="portal-panel portal-glow px-4 py-4 sm:p-5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-2 font-display text-2xl font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminPagination({
  page,
  hasMore,
  onChange,
  busy,
}: {
  page: number;
  hasMore: boolean;
  onChange: (page: number) => void;
  busy?: boolean;
}) {
  return (
    <nav
      aria-label="Pagination des résultats"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <button
        type="button"
        disabled={!page || busy}
        onClick={() => onChange(page - 1)}
        className="min-h-10 rounded-lg border border-border px-3 hover:border-primary disabled:opacity-40"
      >
        Précédent
      </button>
      <span className="text-muted-foreground">Page {page + 1}</span>
      <button
        type="button"
        disabled={!hasMore || busy}
        onClick={() => onChange(page + 1)}
        className="min-h-10 rounded-lg border border-border px-3 hover:border-primary disabled:opacity-40"
      >
        Suivant
      </button>
    </nav>
  );
}
