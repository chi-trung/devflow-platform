/**
 * EmptyState illustration set — hand-drawn SVG scenes themed through CSS
 * variables so they adapt to dark + light automatically.
 *
 * The core "de-AI-fy" move: real imagery instead of a lone lucide icon.
 * Every scene is ({ className }: { className?: string }) rendering a
 * <svg viewBox="0 0 160 120"> using var(--color-*) tokens.
 */
interface IllustrationProps {
  className?: string;
}

/** Shared defs: soft gradient blob behind each scene. */
function BlobDefs() {
  return (
    <defs>
      <linearGradient id="ill-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
  );
}

/** Wraps an SVG in the shared gradient blob + correct sizing. */
function Scene({ children, className = "" }: IllustrationProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className || "size-24"}
      aria-hidden
      focusable="false"
      fill="none"
    >
      <BlobDefs />
      <ellipse cx="80" cy="60" rx="62" ry="46" fill="url(#ill-gradient)" />
      {children}
    </svg>
  );
}

/** Kanban board with a task card + a "+" callout. */
export function EmptyBoardIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      {/* columns */}
      <rect x="30" y="28" width="26" height="62" rx="5" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <rect x="66" y="28" width="26" height="62" rx="5" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <rect x="102" y="28" width="26" height="62" rx="5" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      {/* column headers */}
      <rect x="34" y="34" width="18" height="4" rx="2" fill="var(--color-primary)" opacity="0.5" />
      <rect x="70" y="34" width="18" height="4" rx="2" fill="var(--color-primary)" opacity="0.5" />
      <rect x="106" y="34" width="18" height="4" rx="2" fill="var(--color-primary)" opacity="0.5" />
      {/* cards */}
      <rect x="34" y="44" width="18" height="14" rx="3" fill="var(--color-elevated)" />
      <rect x="70" y="44" width="18" height="14" rx="3" fill="var(--color-elevated)" />
      <rect x="106" y="44" width="18" height="14" rx="3" fill="var(--color-elevated)" />
      <rect x="70" y="64" width="18" height="14" rx="3" fill="var(--color-primary)" opacity="0.18" />
      {/* draggable arrow */}
      <path d="M115 36c8 0 12 5 14 12l-4-3" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="127" cy="50" r="4" fill="var(--color-primary)" opacity="0.6" />
    </Scene>
  );
}

/** Clipboard / checklist with a checkmark. */
export function EmptyTasksIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <rect x="52" y="24" width="56" height="72" rx="8" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <rect x="68" y="18" width="24" height="12" rx="3" fill="var(--color-elevated)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <rect x="60" y="42" width="40" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.35" />
      <rect x="60" y="55" width="40" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.35" />
      <rect x="60" y="68" width="26" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.35" />
      <circle cx="118" cy="74" r="11" fill="var(--color-primary)" opacity="0.15" />
      <path d="M113 74l3.5 3.5 6-6.5" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Scene>
  );
}

/** Magnifier + empty result card. */
export function EmptySearchIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <circle cx="64" cy="50" r="18" stroke="var(--color-border-strong)" strokeWidth="2.5" />
      <path d="M77 65l14 14" stroke="var(--color-border-strong)" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 44l4 4M68 40v5" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      <rect x="96" y="40" width="28" height="6" rx="3" fill="var(--color-muted-foreground)" opacity="0.3" />
      <rect x="96" y="54" width="22" height="6" rx="3" fill="var(--color-muted-foreground)" opacity="0.2" />
      <rect x="96" y="68" width="18" height="6" rx="3" fill="var(--color-muted-foreground)" opacity="0.15" />
    </Scene>
  );
}

/** Bell + notification tray. */
export function EmptyNotificationsIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <path
        d="M64 34c0-7 5-11 11-11s11 4 11 11c0 9 3 12 3 12H61s3-3 3-12z"
        stroke="var(--color-border-strong)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M71 61a4 4 0 01-4-3h8a4 4 0 01-4 3z" fill="var(--color-primary)" opacity="0.7" />
      <path d="M56 47h30" stroke="var(--color-border-strong)" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 62h80" stroke="var(--color-border-strong)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M40 74h60" stroke="var(--color-border-strong)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </Scene>
  );
}

/** Two people with a "join" callout. */
export function EmptyUsersIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <circle cx="60" cy="44" r="11" stroke="var(--color-border-strong)" strokeWidth="2" />
      <path d="M46 72c2-8 7-12 14-12s12 4 14 12" stroke="var(--color-border-strong)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="104" cy="56" r="8" stroke="var(--color-primary)" opacity="0.6" strokeWidth="2" />
      <path d="M96 78c1-6 4-9 8-9s7 3 8 9" stroke="var(--color-primary)" opacity="0.6" strokeWidth="2" strokeLinecap="round" />
      <path d="M108 30l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8 2.5-5z" fill="var(--color-primary)" opacity="0.5" />
    </Scene>
  );
}

/** Rising bar chart with an arrow. */
export function EmptyChartIllustration({ className }: IllustrationProps) {
  return (
    <Scene className={className}>
      <path d="M36 84h90" stroke="var(--color-border-strong)" strokeWidth="2" strokeLinecap="round" />
      <rect x="44" y="66" width="12" height="18" rx="3" fill="var(--color-elevated)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <rect x="64" y="54" width="12" height="30" rx="3" fill="var(--color-primary)" opacity="0.45" />
      <rect x="84" y="42" width="12" height="42" rx="3" fill="var(--color-elevated)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <rect x="104" y="30" width="12" height="54" rx="3" fill="var(--color-primary)" opacity="0.7" />
      <path d="M120 74l14 6-3-7 9-11" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Scene>
  );
}
