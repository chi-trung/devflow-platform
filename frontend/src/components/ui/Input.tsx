import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ invalid = false, className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors duration-200 focus:outline-none ${
          invalid
            ? "border-destructive/60"
            : "border-border hover:border-border-strong focus:border-primary"
        } ${className}`}
        {...rest}
      />
    );
  },
);
