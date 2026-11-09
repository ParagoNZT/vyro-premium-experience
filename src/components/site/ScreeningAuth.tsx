import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  TvMinimal,
  Users,
} from "lucide-react";
import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Logo } from "./Logo";
import "./screening-auth.css";

const benefits = [
  {
    icon: KeyRound,
    title: "Licence et abonnement",
    description: "Retrouvez votre clé et la date d’expiration.",
  },
  {
    icon: TvMinimal,
    title: "Appareils associés",
    description: "Consultez et gérez les écrans liés à votre licence.",
  },
  {
    icon: Download,
    title: "Installation de VYRO",
    description: "Accédez au téléchargement et aux guides.",
  },
];
const adminBenefits = [
  { icon: Users, title: "Gestion des clients", description: "Retrouvez les comptes et leur état." },
  {
    icon: KeyRound,
    title: "Licences et accès TV",
    description: "Attribuez une licence et contrôlez les accès.",
  },
  {
    icon: ShieldCheck,
    title: "Journal d’administration",
    description: "Consultez les opérations effectuées sur les comptes.",
  },
];

export function ScreeningAuth({
  label = "Espace client",
  title,
  subtitle,
  action,
  admin = false,
  children,
}: {
  label?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  admin?: boolean;
  children: ReactNode;
}) {
  const formTitleId = useId();
  const infoTitleId = useId();

  return (
    <div className="screening-auth">
      <div className="screening-auth__layout">
        <Logo className="screening-auth__brand" />
        <div className="screening-auth__card">
          <section className="screening-auth__paper" aria-labelledby={formTitleId}>
            <header className="screening-auth__heading">
              <p className="screening-auth__eyebrow">{label}</p>
              <h1 id={formTitleId}>{title}</h1>
              <p className="screening-auth__intro">{subtitle}</p>
            </header>
            {children}
          </section>
          <aside className="screening-auth__info" aria-labelledby={infoTitleId}>
            <div>
              <p className="screening-auth__eyebrow">
                {admin ? "Console VYRO" : "Votre compte VYRO"}
              </p>
              <h2 id={infoTitleId}>
                {admin ? "Pilotez les accès VYRO." : "Votre accès, à portée de main."}
              </h2>
            </div>
            <ul className="screening-auth__benefits" role="list">
              {(admin ? adminBenefits : benefits).map(({ icon: Icon, title, description }) => (
                <li key={title}>
                  <span className="screening-auth__benefit-icon">
                    <Icon size={17} strokeWidth={1.7} aria-hidden />
                  </span>
                  <div>
                    <p className="screening-auth__benefit-title">{title}</p>
                    <p className="screening-auth__benefit-detail">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
            {action && <div className="screening-auth__actions">{action}</div>}
          </aside>
        </div>
        <Link to="/" className="screening-auth__back">
          <ArrowLeft size={15} aria-hidden />
          Retour au site
        </Link>
      </div>
    </div>
  );
}

type FieldProps = Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | undefined;
};

export function ScreeningField({
  label,
  value,
  onChange,
  hint,
  id: providedId,
  type = "text",
  "aria-describedby": describedBy,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const hintId = hint ? id + "-hint" : undefined;

  return (
    <div className="screening-auth__field">
      <label htmlFor={id}>{label}</label>
      <div className="screening-auth__control">
        <input
          {...props}
          id={id}
          type={isPassword && visible ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(" ") || undefined}
          autoCapitalize={isPassword ? "none" : props.autoCapitalize}
          spellCheck={isPassword ? false : props.spellCheck}
          data-password={isPassword || undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="screening-auth__reveal"
            aria-controls={id}
            aria-label={`${visible ? "Masquer" : "Afficher"} : ${label.toLowerCase()}`}
            onClick={() => setVisible((previous) => !previous)}
          >
            {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        )}
      </div>
      {hint && <p id={hintId}>{hint}</p>}
    </div>
  );
}

export function ScreeningNotice({
  error = false,
  children,
}: {
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <p className="screening-auth__notice" role={error ? "alert" : "status"}>
      {children}
    </p>
  );
}
