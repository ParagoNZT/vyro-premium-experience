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
}

interface ButtonAsLinkProps extends ButtonBaseProps {
  to: string;
  search?: Record<string, string | undefined>;
}

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-5 py-2 text-[12px] tracking-[0.12em]",
  md: "px-8 py-3.5 text-[13px] tracking-[0.12em]",
  lg: "px-10 py-4 text-sm tracking-[0.12em]",
};

const chamfer = "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))";
const chamferSm = "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))";

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
      return search ? (
        <Link to={to} search={search} className={classes}>
          {content}
        </Link>
      ) : (
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

  const content = (
    <>
      {variant === "primary" ? (
        <>
          <span
            aria-hidden
            className="absolute -inset-[1px] bg-gradient-to-tr from-primary/60 to-primary opacity-40 transition-opacity duration-300 group-hover:opacity-100"
            style={{ clipPath: chamfer }}
          />
          <span
            className={cn(
              "relative flex items-center justify-center gap-2 bg-surface font-semibold uppercase text-primary-foreground transition-all duration-300 active:scale-[0.98]",
              sizeClasses[size],
            )}
            style={{ clipPath: chamfer }}
          >
            {children}
          </span>
        </>
      ) : variant === "secondary" ? (
        <span
          className={cn(
            "relative flex items-center justify-center gap-2 border border-border bg-transparent font-medium uppercase text-foreground transition-all duration-300 hover:border-primary/40 hover:bg-surface-2 active:scale-[0.98]",
            sizeClasses[size],
          )}
          style={{ clipPath: chamfer }}
        >
          {children}
        </span>
      ) : (
        <span
          className={cn(
            "relative flex items-center justify-center gap-2 font-medium uppercase text-muted-foreground transition-all duration-300 hover:text-foreground",
            sizeClasses[size],
          )}
        >
          {children}
        </span>
      )}
    </>
  );

  const classes = cn(
    "group relative inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    variant === "ghost" && "rounded-md",
    className,
  );

  if (to) {
    return search ? (
      <Link to={to} search={search} className={classes}>
        {content}
      </Link>
    ) : (
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
