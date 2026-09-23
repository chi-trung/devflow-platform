import { useState } from "react";
import { useTranslation } from "react-i18next";

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
  className?: string;
  /**
   * Provider-hosted photo URL (Google picture / GitHub avatar_url). When it
   * fails to load — deleted photo, blocked hotlink, offline — the avatar
   * falls back to the initials rendering instead of a broken-image icon.
   */
  src?: string | null;
}

export function Avatar({
  name,
  id,
  size = "sm",
  online = false,
  className = "",
  src = null,
}: AvatarProps) {
  const { t } = useTranslation();
  // Remember which exact URL broke: a later different src (user re-login
  // refreshed their photo) gets a fresh chance without needing a key remount.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
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
      {showImage ? (
        <img
          src={src!}
          alt=""
          loading="lazy"
          // Cross-origin referrer can make some CDNs reject the hotlink.
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className={`rounded-lg object-cover ${tone} ${sizeClasses} ${className}`}
        />
      ) : (
        <span
          aria-hidden
          className={`flex select-none items-center justify-center rounded-lg font-display font-semibold ${tone} ${sizeClasses} ${className}`}
        >
          {initials || "?"}
        </span>
      )}
      {online && (
        <span
          role="img"
          aria-label={t("ui.statusOnline")}
          className={`absolute -right-0.5 -bottom-0.5 ${dotSize} rounded-full bg-emerald-500 ring-2 ring-surface`}
        />
      )}
    </span>
  );
}
