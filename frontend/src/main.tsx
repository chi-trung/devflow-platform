import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import i18n, { ensureLocale } from "./i18n";
import { initTheme } from "./lib/theme";
import { prefetchOAuthConfig, reconcileOAuthCallback } from "./lib/oauth";
import { refreshSession, tokens } from "./lib/api";
import { isTokenExpired } from "./lib/jwt";
import { prefetchAuthedCore } from "./lib/routePrefetch";
import App from "./App.tsx";

initTheme();

// Kick every slow async boot task BEFORE waiting on the non-fallback locale
// bundle, so they overlap that wait instead of queueing behind React's mount.
// Storage access can throw in privacy modes; boot must never die on it —
// AuthProvider re-runs the session restore after mount regardless.
try {
  // Drop a provider callback nobody can claim (dead ?code=, consent ?error=)
  // before any route renders it, so one-time params never sit in the URL.
  reconcileOAuthCallback();
  // Start the OAuth provider-config fetch while the entry chunk is still
  // warming up. The login/register cards only show the Google/GitHub buttons
  // after this config resolves, so a late answer grows the card after first
  // paint (measured CLS 0.1). Fetching here means the answer is usually cached
  // before the lazy auth route even mounts.
  prefetchOAuthConfig();
  if (tokens.refresh) {
    // Returning visit: download the chunks the first signed-in navigation
    // usually needs (dashboard/board/workspace/…) now, so the router's
    // lazy() finds them in the module cache instead of showing Suspense.
    prefetchAuthedCore();
    // Pre-kick the session restore only when the access token cannot satisfy
    // the first paint — that is the case where AuthProvider holds status
    // "loading" (RequireAuth's shell skeleton) until the round-trip lands.
    // refreshSession coalesces, so AuthProvider reuses this in-flight
    // promise when it mounts. A still-valid access token renders
    // immediately anyway and revalidates in the background on its own.
    if (!tokens.access || isTokenExpired(tokens.access)) {
      void refreshSession().catch(() => {});
    }
  }
} catch {
  // Private-mode storage denial — fall back to the post-mount restore path.
}

// The non-fallback locale is fetched lazily, so a returning visitor whose
// preference is Vietnamese would otherwise render English (or raw keys) for
// the first paint. Hold the boot until the bundle lands: the branded splash in
// index.html is already on screen, so this costs no blank time and avoids a
// visible language flip once vi arrives. The bundle is ~25 KB of gzip and
// arrives in parallel with the route chunks, the OAuth config, the session
// refresh and the authed-core prefetch kicked off above, so the wait is
// dominated by work the app needs anyway. Any visitor on en (the common
// case) resolves immediately. A failed chunk still boots in English rather than
// leaving the splash up — the console line is the only signal that the visitor
// is seeing the wrong language, so it stays rather than being swallowed.
ensureLocale(i18n.language)
  .catch((err) => {
    console.error("locale chunk failed to load; falling back to en", err);
  })
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });

// Register service worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed — app still works
    });
  });
}
