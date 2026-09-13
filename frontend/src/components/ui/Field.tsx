import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  // The error/hint node exists only while it has content, and the control
  // points at it via aria-describedby so screen readers announce it with the
  // field instead of leaving it as an orphan paragraph. useId keeps the
  // association collision-proof even when two fields share an htmlFor.
  const describeId = useId();
  const describedBy = error || hint ? describeId : undefined;
  const control =
    describedBy && isValidElement(children)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
          "aria-describedby": describeId,
        })
      : children;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {control}
      {error ? (
        <p id={describedBy} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
