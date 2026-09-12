import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import { initTheme } from "./lib/theme";
import { prefetchOAuthConfig } from "./lib/oauth";
import App from "./App.tsx";

initTheme();
// Start the OAuth provider-config fetch while the entry chunk is still
// warming up. The login/register cards only show the Google/GitHub buttons
// after this config resolves, so a late answer grows the card after first
// paint (measured CLS 0.1). Fetching here means the answer is usually cached
// before the lazy auth route even mounts.
prefetchOAuthConfig();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed — app still works
    });
  });
}
