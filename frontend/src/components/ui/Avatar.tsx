const PALETTE = [
  "bg-teal-400/15 text-teal-300",
  "bg-sky-400/15 text-sky-300",
  "bg-violet-400/15 text-violet-300",
  "bg-amber-400/15 text-amber-300",
  "bg-rose-400/15 text-rose-300",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface AvatarProps {
  name: string;
  id?: string;
  size?: "sm" | "md";
  /** When true, renders a green presence dot at the bottom-right corner. */
  online?: boolean;
}

export function Avatar({ name, id, size = "sm", online = false }: AvatarProps) {
  const initials = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const tone = PALETTE[hashString(id ?? name) % PALETTE.length];
  const sizeClasses =
    size === "sm" ? "size-6 text-[10px]" : "size-9 text-sm";
  const dotSize = size === "sm" ? "size-1.5" : "size-2";

  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-hidden
        className={`flex select-none items-center justify-center rounded-lg font-display font-semibold ${tone} ${sizeClasses}`}
      >
        {initials || "?"}
      </span>
      {online && (
        <span
          aria-label="online"
          className={`absolute -right-0.5 -bottom-0.5 ${dotSize} rounded-full bg-emerald-500 ring-2 ring-surface`}
        />
      )}
    </span>
  );
}
