import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import i18n, { ensureLocale } from "./i18n";
import { initTheme } from "./lib/theme";
import { prefetchOAuthConfig, reconcileOAuthCallback } from "./lib/oauth";
import App from "./App.tsx";

initTheme();

// The non-fallback locale is fetched lazily, so a returning visitor whose
// preference is Vietnamese would otherwise render English (or raw keys) for
// the first paint. Hold the boot until the bundle lands: the branded splash in
// index.html is already on screen, so this costs no blank time and avoids a
// visible language flip once vi arrives. The bundle is ~25 KB of gzip and
// arrives in parallel with the route chunks and the OAuth config, so the wait
// is dominated by work the app needs anyway. Any visitor on en (the common
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
// Drop a provider callback nobody can claim (dead ?code=, consent ?error=)
// before any route renders it, so one-time params never sit in the URL.
reconcileOAuthCallback();
// Start the OAuth provider-config fetch while the entry chunk is still
// warming up. The login/register cards only show the Google/GitHub buttons
// after this config resolves, so a late answer grows the card after first
// paint (measured CLS 0.1). Fetching here means the answer is usually cached
// before the lazy auth route even mounts.
prefetchOAuthConfig();

// Register service worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed — app still works
    });
  });
}
