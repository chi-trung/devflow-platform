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
}

export function Avatar({ name, id, size = "sm" }: AvatarProps) {
  const initials = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const tone = PALETTE[hashString(id ?? name) % PALETTE.length];
  const sizeClasses =
    size === "sm" ? "size-6 text-[10px]" : "size-9 text-sm";

  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center rounded-lg font-display font-semibold ${tone} ${sizeClasses}`}
    >
      {initials || "?"}
    </span>
  );
}
