/**
 * Shared emoji + cover-color helpers for workspaces and projects.
 *
 * coverColor stores a palette KEY from the backend (never raw CSS); this
 * module maps that key to a Tailwind gradient class for cover banners.
 */

/** Preset emojis offered by the picker (workspaces + projects). */
export const EMOJI_PRESETS = [
  "🚀",
  "🎯",
  "🔥",
  "💡",
  "📈",
  "🧭",
  "🏗️",
  "🛠️",
  "🎨",
  "🧪",
  "🔬",
  "📦",
  "🌱",
  "🌊",
  "🏔️",
  "🌍",
  "👥",
  "⚡",
  "🛡️",
  "💎",
  "📚",
  "🧩",
  "🤝",
  "⭐",
];

/** Palette key → Tailwind gradient (top banner on cards / board header). */
export const COVER_GRADIENTS: Record<string, string> = {
  "0": "from-teal-500/25 to-sky-500/10",
  "1": "from-violet-500/25 to-fuchsia-500/10",
  "2": "from-amber-400/25 to-rose-500/10",
  "3": "from-emerald-500/25 to-teal-500/10",
  "4": "from-sky-500/25 to-indigo-500/10",
  "5": "from-rose-500/25 to-orange-400/10",
};

export const COVER_COLOR_KEYS = Object.keys(COVER_GRADIENTS);

/** Resolve a coverColor key to a gradient class; unknown keys → null. */
export function coverGradient(coverColor: string | null | undefined): string | null {
  if (!coverColor) return null;
  return COVER_GRADIENTS[coverColor] ?? null;
}

/** Renders an emoji tile (rounded square) or a fallback mark. */
export function EmojiTile({
  emoji,
  size = "sm",
  className = "",
}: {
  emoji?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-6 text-sm",
    md: "size-8 text-lg",
    lg: "size-10 text-2xl",
  } as const;
  if (!emoji) return null;
  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center rounded-lg bg-surface leading-none ${sizes[size]} ${className}`}
    >
      {emoji}
    </span>
  );
}
