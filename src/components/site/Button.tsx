import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "nav";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonBaseProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

interface ButtonAsButtonProps extends ButtonBaseProps {
  to?: never;
  search?: never;
  activeOptions?: never;
}

interface ButtonAsLinkProps extends ButtonBaseProps {
  to: string;
  search?: Record<string, string | undefined>;
  activeOptions?: { exact?: boolean };
}

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-5 py-2 text-[12px] tracking-[0.12em]",
  md: "px-8 py-3.5 text-[13px] tracking-[0.12em]",
  lg: "px-10 py-4 text-sm tracking-[0.12em]",
};

const primaryGlow =
  "shadow-[inset_0_1px_0_color-mix(in_oklab,var(--primary-foreground)_26%,transparent),0_12px_44px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)]";
const primaryGlowHover =
  "hover:shadow-[inset_0_1px_0_color-mix(in_oklab,var(--primary-foreground)_30%,transparent),0_0_0_1px_color-mix(in_oklab,var(--primary)_45%,transparent),0_16px_56px_-8px_color-mix(in_oklab,var(--primary)_85%,transparent)]";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  onClick,
  type = "button",
  to,
  search,
  activeOptions,
}: ButtonProps) {
  const isNav = variant === "nav";

  if (isNav) {
    const content = (
      <>
        <span className="relative z-10">{children}</span>
        <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-primary transition-all duration-300 group-hover:w-full" />
        <span className="absolute -top-1 right-0 h-1 w-1 scale-0 rounded-full bg-primary transition-transform duration-300 group-hover:scale-100" />
      </>
    );

    const classes = cn(
      "group relative px-2 py-1 text-[13px] font-medium tracking-[0.08em] text-muted-foreground transition-colors duration-300 hover:text-foreground",
      className,
    );

    if (to) {
      if (search && activeOptions) {
        return (
          <Link to={to} search={search} activeOptions={activeOptions} className={classes}>
            {content}
          </Link>
        );
      }
      if (search) {
        return (
          <Link to={to} search={search} className={classes}>
            {content}
          </Link>
        );
      }
      if (activeOptions) {
        return (
          <Link to={to} activeOptions={activeOptions} className={classes}>
            {content}
          </Link>
        );
      }
      return (
        <Link to={to} className={classes}>
          {content}
        </Link>
      );
    }

    return (
      <button type={type} onClick={onClick} disabled={disabled} className={classes}>
        {content}
      </button>
    );
  }

  const content =
    variant === "primary" ? (
      <span
        className={cn(
          "relative flex items-center justify-center gap-2 rounded-[10px] bg-primary font-semibold uppercase text-primary-foreground transition-all duration-300 hover:brightness-110 active:scale-[0.98]",
          disabled ? primaryGlow : cn(primaryGlow, primaryGlowHover),
          sizeClasses[size],
        )}
      >
        {children}
      </span>
    ) : variant === "secondary" ? (
      <span
        className={cn(
          "relative flex items-center justify-center gap-2 rounded-[10px] border border-primary/40 bg-transparent font-medium uppercase text-primary transition-all duration-300 hover:border-primary/70 hover:bg-primary/10 hover:shadow-[0_0_28px_-12px_var(--primary)] active:scale-[0.98]",
          sizeClasses[size],
        )}
      >
        {children}
      </span>
    ) : (
      <span
        className={cn(
          "relative flex items-center justify-center gap-2 rounded-[10px] font-medium uppercase text-muted-foreground transition-all duration-300 hover:text-foreground",
          sizeClasses[size],
        )}
      >
        {children}
      </span>
    );

  const classes = cn(
    "group relative inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    disabled && "pointer-events-none opacity-60",
    className,
  );

  if (to) {
    if (search && activeOptions) {
      return (
        <Link to={to} search={search} activeOptions={activeOptions} className={classes}>
          {content}
        </Link>
      );
    }
    if (search) {
      return (
        <Link to={to} search={search} className={classes}>
          {content}
        </Link>
      );
    }
    if (activeOptions) {
      return (
        <Link to={to} activeOptions={activeOptions} className={classes}>
          {content}
        </Link>
      );
    }
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}
