import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getApiWarmth,
  startApiKeepalive,
  subscribeApiWarmth,
  type ApiWarmth,
} from "../../lib/keepalive";

const DOT_COLOR: Record<ApiWarmth, string> = {
  warm: "bg-emerald-400",
  waking: "bg-amber-400 animate-pulse",
  offline: "bg-destructive",
};

interface ApiStatusDotProps {
  /** Extra positioning classes (e.g. hung off the avatar corner in the rail). */
  className?: string;
}

export function ApiStatusDot({ className = "" }: ApiStatusDotProps) {
  const { t } = useTranslation();
  const [warmth, setWarmth] = useState<ApiWarmth>(getApiWarmth);

  useEffect(() => startApiKeepalive(), []);
  useEffect(() => subscribeApiWarmth(setWarmth), []);

  const statusText =
    warmth === "warm"
      ? t("api.statusWarm")
      : warmth === "waking"
        ? t("api.statusWaking")
        : t("api.statusOffline");

  // role=status only announces what the element contains, and the dot itself
  // carries color plus animation that screen readers never see. The sr-only
  // text is the announcement; the title keeps the mouse tooltip.
  return (
    <span
      role="status"
      aria-live="polite"
      title={statusText}
      className={`size-2 shrink-0 rounded-full ${DOT_COLOR[warmth]} ${className}`}
    >
      <span className="sr-only">{statusText}</span>
    </span>
  );
}
