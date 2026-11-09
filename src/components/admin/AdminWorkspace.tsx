import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { adminNavigation, adminSections, type AdminSection } from "./sections";

export function AdminBrand() {
  return (
    <Link
      to="/admin"
      search={{}}
      activeOptions={{ exact: true }}
      className="va-brand"
      aria-label="VYRO Console, vue d’ensemble"
    >
      <img src="/vyro-mark.svg" width={36} height={36} alt="" />
      <span>
        <strong>VYRO</strong>
        <small>CONSOLE</small>
      </span>
    </Link>
  );
}

export function AdminWorkspace({
  section,
  email,
  onSignOut,
  signingOut,
  logoutError,
  children,
}: {
  section: AdminSection;
  email: string;
  onSignOut: () => void;
  signingOut: boolean;
  logoutError: string;
  children: ReactNode;
}) {
  const view = adminSections[section];

  return (
    <div className="va-theme va-workspace">
      <aside className="va-rail">
        <AdminBrand />
        <nav aria-label="Rubriques d’administration" className="va-nav">
          <p className="va-eyebrow">Gestion</p>
          {adminNavigation.map(([id, { title, Icon }]) => (
            <Link
              key={id}
              to="/admin"
              search={id === "overview" ? {} : { section: id }}
              activeOptions={{ exact: true }}
              aria-current={section === id ? "page" : undefined}
              className="va-nav-link"
            >
              <Icon size={18} aria-hidden />
              <span>{title}</span>
            </Link>
          ))}
        </nav>
        <div className="va-rail-footer">
          <Link to="/account" className="va-nav-link">
            <ArrowUpRight size={17} aria-hidden /> Espace client
          </Link>
        </div>
      </aside>
      <div className="va-content">
        <div className="va-topbar">
          <p className="va-breadcrumb">
            Administration <ChevronRight size={14} aria-hidden /> <strong>{view.title}</strong>
          </p>
          <div className="va-session">
            <span className="va-identity">
              <ShieldCheck size={17} aria-hidden />
              <span>
                <strong>Administrateur</strong>
                <small>{email}</small>
              </span>
            </span>
            <button
              className="va-button va-button-secondary"
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
            >
              <LogOut size={16} aria-hidden /> {signingOut ? "Déconnexion…" : "Déconnexion"}
            </button>
          </div>
        </div>
        <div className="va-page">
          <header className="va-intro">
            <div>
              <p className="va-eyebrow">Console VYRO</p>
              <h1>{view.title}</h1>
              <p>{view.description}</p>
            </div>
            <span className="va-intro-icon" aria-hidden>
              <view.Icon size={40} strokeWidth={1.35} />
            </span>
          </header>
          {logoutError && (
            <p className="va-notice va-notice-error" role="alert">
              {logoutError}
            </p>
          )}
          {signingOut ? (
            <p className="va-state" role="status">
              Déconnexion…
            </p>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
