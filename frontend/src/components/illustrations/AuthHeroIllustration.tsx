/**
 * AuthLayout hero illustration — a mini kanban scene themed through CSS
 * variables so it adapts to dark + light. Replaces the two blurred blobs
 * in the left auth panel with real, human-feeling imagery.
 */
export function AuthHeroIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 220"
      className={className}
      aria-hidden
      focusable="false"
      fill="none"
    >
      <defs>
        <linearGradient id="auth-hero-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* soft backing blob */}
      <ellipse cx="160" cy="112" rx="138" ry="92" fill="url(#auth-hero-gradient)" />

      {/* board frame */}
      <rect x="52" y="48" width="216" height="136" rx="14" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="2" />

      {/* three columns */}
      <rect x="68" y="80" width="56" height="88" rx="6" fill="var(--color-surface)" />
      <rect x="132" y="80" width="56" height="88" rx="6" fill="var(--color-surface)" />
      <rect x="196" y="80" width="56" height="88" rx="6" fill="var(--color-surface)" />

      {/* column headers */}
      <rect x="74" y="88" width="28" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.45" />
      <rect x="138" y="88" width="28" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.45" />
      <rect x="202" y="88" width="28" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.45" />

      {/* task cards */}
      <rect x="72" y="100" width="48" height="34" rx="5" fill="var(--color-elevated)" />
      <rect x="136" y="100" width="48" height="22" rx="5" fill="var(--color-elevated)" />
      <rect x="136" y="128" width="48" height="22" rx="5" fill="var(--color-primary)" opacity="0.22" />
      <rect x="200" y="100" width="48" height="22" rx="5" fill="var(--color-elevated)" />
      <rect x="200" y="128" width="48" height="22" rx="5" fill="var(--color-elevated)" />

      {/* avatars on cards */}
      <circle cx="88" cy="112" r="6" fill="var(--color-primary)" opacity="0.55" />
      <circle cx="106" cy="112" r="6" fill="var(--color-primary)" opacity="0.3" />

      {/* status bar */}
      <rect x="68" y="64" width="18" height="5" rx="2.5" fill="var(--color-primary)" />
      <rect x="92" y="64" width="10" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.3" />

      {/* floating arrow */}
      <path d="M250 30c14 0 22 6 26 18l-7-4" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="278" cy="52" r="7" fill="var(--color-primary)" opacity="0.5" />
    </svg>
  );
}
