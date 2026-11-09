import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

type FieldProps = Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
};

export function AdminField({ label, value, onChange, hint, id, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="va-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hint ? inputId + "-hint" : props["aria-describedby"]}
      />
      {hint && <small id={inputId + "-hint"}>{hint}</small>}
    </div>
  );
}

export function AdminNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p
      className={error ? "va-notice va-notice-error" : "va-notice"}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function AdminDialog({
  open,
  busy,
  title,
  description,
  onClose,
  returnFocus,
  children,
}: {
  open: boolean;
  busy: boolean;
  title: string;
  description: string;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="va-dialog-overlay" />
        <Dialog.Content
          className="va-theme va-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus()?.focus();
          }}
        >
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <Dialog.Close className="va-close" disabled={busy} aria-label="Fermer">
            <X size={19} aria-hidden />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
