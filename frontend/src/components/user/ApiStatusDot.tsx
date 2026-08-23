import { useEffect, useState } from "react";
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

export function ApiStatusDot() {
  const [warmth, setWarmth] = useState<ApiWarmth>(getApiWarmth);

  useEffect(() => startApiKeepalive(), []);
  useEffect(() => subscribeApiWarmth(setWarmth), []);

  return (
    <span
      role="status"
      aria-live="polite"
      title={
        warmth === "warm"
          ? undefined
          : warmth === "waking"
            ? "API is waking up…"
            : "You are offline"
      }
      className={`size-2 shrink-0 rounded-full ${DOT_COLOR[warmth]}`}
    />
  );
}
