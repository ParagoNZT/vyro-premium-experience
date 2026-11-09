import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
      <p role="status" className="va-state">
        {empty}
      </p>
    );
  return (
    <div className="va-table-region" tabIndex={0} role="region" aria-label={label}>
      <table className="va-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AdminStats({
  stats,
}: {
  stats: Array<{ label: string; value: string | number; Icon: LucideIcon }>;
}) {
  const format = new Intl.NumberFormat("fr-FR");
  return (
    <dl className="va-metrics">
      {stats.map(({ label, value, Icon }) => (
        <div key={label} className="va-metric">
          <dt>{label}</dt>
          <dd>
            <span>{typeof value === "number" ? format.format(value) : value}</span>
            <span className="va-metric-icon" aria-hidden>
              <Icon size={19} />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "positive" | "warning" | "neutral";
}) {
  return (
    <span className="va-status" data-tone={tone}>
      {children}
    </span>
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
  if (!page && !hasMore) return null;
  return (
    <nav aria-label="Pagination des résultats" className="va-pagination">
      <span>Page {page + 1}</span>
      <div>
        <button
          className="va-button va-button-secondary"
          type="button"
          disabled={!page || busy}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden /> Précédent
        </button>
        <button
          className="va-button va-button-secondary"
          type="button"
          disabled={!hasMore || busy}
          onClick={() => onChange(page + 1)}
        >
          Suivant <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
