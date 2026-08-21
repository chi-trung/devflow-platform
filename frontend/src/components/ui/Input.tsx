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
        className={`w-full rounded-md border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground/60 focus:outline-none ${
          invalid
            ? "border-destructive"
            : "border-border focus:border-primary"
        } ${className}`}
        {...rest}
      />
    );
  },
);
