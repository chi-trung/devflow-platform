import { API_BASE } from "./api";

// ── API keepalive & warmth indicator ────────────────────────────────
// Pings the health endpoint while the tab is open so free-tier hosts
// (Render) stay warm during working sessions, and exposes connection
// warmth for the status dot in the shell.

export type ApiWarmth = "warm" | "waking" | "offline";

let timer: number | null = null;
let probing = false;
let warmth: ApiWarmth = typeof navigator !== "undefined" && !navigator.onLine
  ? "offline"
  : "warm";
const listeners = new Set<(value: ApiWarmth) => void>();

function setWarmth(next: ApiWarmth): void {
  if (warmth === next) return;
  warmth = next;
  for (const listener of [...listeners]) {
    try {
      listener(warmth);
    } catch {}
  }
}

export function getApiWarmth(): ApiWarmth {
  return warmth;
}

export function subscribeApiWarmth(
  listener: (value: ApiWarmth) => void,
): () => void {
  listeners.add(listener);
  listener(warmth);
  return () => listeners.delete(listener);
}

async function probe(): Promise<void> {
  if (probing || document.hidden) return;
  probing = true;
  try {
    const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    setWarmth(response.ok ? "warm" : "waking");
  } catch {
    setWarmth(navigator.onLine ? "waking" : "offline");
  } finally {
    probing = false;
  }
}

/** Start the keepalive loop (idempotent). Ping every 4 minutes. */
export function startApiKeepalive(intervalMs = 240_000): void {
  if (timer !== null) return;
  void probe();

  window.addEventListener("online", () => {
    setWarmth("waking");
    void probe();
  });
  window.addEventListener("offline", () => setWarmth("offline"));

  timer = window.setInterval(() => void probe(), intervalMs);
}
