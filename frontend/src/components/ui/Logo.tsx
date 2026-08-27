import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * DevFlow brand mark — a rounded square with three ascending bars.
 *
 * Rendered as inline SVG themed through CSS variables (var(--color-primary)
 * / var(--color-on-primary)) so it adapts to dark + light automatically.
 * The three-bar motif mirrors public/favicon.svg.
 */

interface BrandMarkProps {
  /** Rendered glyph size (square). Default `size-7` (28px). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const MARK_SIZES = {
  sm: "size-6",
  md: "size-7",
  lg: "size-9",
} as const;

/** The square brand tile with the three-bar glyph. Use alone or inside Logo. */
export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary ${MARK_SIZES[size]} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[62%]"
        aria-hidden
        focusable="false"
      >
        <rect
          x="3.5"
          y="12"
          width="4"
          height="8"
          rx="1.6"
          fill="currentColor"
        />
        <rect
          x="10"
          y="8"
          width="4"
          height="12"
          rx="1.6"
          fill="currentColor"
          opacity="0.7"
        />
        <rect
          x="16.5"
          y="4"
          width="4"
          height="16"
          rx="1.6"
          fill="currentColor"
          opacity="0.45"
        />
      </svg>
    </span>
  );
}

interface LogoProps extends BrandMarkProps {
  /** Wordmark label. Defaults to the app name. */
  label?: string;
  /** When set, wraps the whole logo in a link. */
  to?: string;
  /** Hide the wordmark below the given Tailwind breakpoint (e.g. "sm") so
   *  narrow screens only show the brand tile, freeing room for nav buttons. */
  wordmarkHideBelow?: "sm" | "md" | "lg";
}

/** Icon + wordmark lockup. */
export function Logo({
  size = "md",
  className = "",
  label = "DevFlow",
  to,
  wordmarkHideBelow,
}: LogoProps) {
  const mark = <BrandMark size={size} />;
  const wordmark = (
    <span
      className={`font-display font-semibold tracking-tight ${
        size === "lg" ? "text-lg" : size === "sm" ? "text-sm" : "text-base"
      } ${
        wordmarkHideBelow
          ? `hidden ${wordmarkHideBelow}:inline`
          : ""
      }`}
    >
      {label}
    </span>
  );

  let inner: ReactNode;
  if (to) {
    inner = (
      <LinkShell to={to} size={size}>
        {mark}
        {wordmark}
      </LinkShell>
    );
  } else {
    inner = (
      <span className={`flex items-center gap-2 ${className}`}>
        {mark}
        {wordmark}
      </span>
    );
  }
  return inner;
}

function LinkShell({
  to,
  size,
  children,
}: {
  to: string;
  size: BrandMarkProps["size"];
  children: ReactNode;
}) {
  const compact = size === "sm" ? "gap-1.5" : "gap-2";
  return (
    <Link
      to={to}
      className={`inline-flex items-center ${compact} text-foreground transition-colors duration-150 hover:text-primary`}
    >
      {children}
    </Link>
  );
}
