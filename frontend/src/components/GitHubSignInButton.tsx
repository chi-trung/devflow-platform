import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import {
  buildGitHubAuthUrl,
  completeOAuthExchange,
  getOAuthConfig,
} from "../lib/oauth";

/**
 * 'Continue with GitHub' button. Renders nothing when the backend has not been
 * configured for GitHub sign-in (GitHubClientId empty), so the feature can be
 * shipped without breaking the existing email/password auth.
 *
 * Flow (classic OAuth App — no PKCE, state is the anti-CSRF value):
 *   1. Build a GitHub authorization URL with a random state, open it.
 *   2. GitHub redirects back to the app with ?code=…&state=…
 *   3. completeOAuthExchange() validates the state, swaps the code for a
 *      DevFlow JWT pair (saved by the AuthContext), then navigates home.
 *
 * The ?code= effect is gated on the pending provider tag so it never fires
 * for a Google-redirected landing (both buttons are mounted together, and
 * the one-time code only survives a single exchange).
 */
export function GitHubSignInButton() {
  const { t } = useTranslation();
  const { setSessionFromTokens } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOAuthConfig().then((config) => {
      if (!cancelled && config?.githubEnabled) setEnabled(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // If we landed here with ?code= (GitHub redirect back), finish the exchange.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    if (sessionStorage.getItem("devflow.oauthProvider") !== "github") return;
    let cancelled = false;
    setLoading(true);
    void completeOAuthExchange()
      .then((response) => {
        if (cancelled || !response) return;
        setSessionFromTokens(response.accessToken, response.refreshToken);
        const redirect = sessionStorage.getItem("devflow.oauthRedirect");
        sessionStorage.removeItem("devflow.oauthRedirect");
        // Don't land back on the login/register pages after a successful sign-in.
        const safeRedirect =
          !redirect || redirect === "/login" || redirect === "/register" ? "/" : redirect;
        window.location.href = safeRedirect;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("auth.somethingWrong"));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setSessionFromTokens, t]);

  const handleClick = useCallback(async () => {
    setError(null);
    const config = await getOAuthConfig();
    if (!config?.githubEnabled) {
      setError(t("auth.githubNotConfigured"));
      return;
    }
    try {
      const url = await buildGitHubAuthUrl(config);
      window.location.href = url;
    } catch {
      setError(t("auth.somethingWrong"));
    }
  }, [t]);

  if (!enabled && !loading) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={handleClick}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-border-strong hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <svg className="size-4" viewBox="0 0 16 16" aria-hidden>
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
            />
          </svg>
        )}
        {loading ? t("auth.redirecting") : t("auth.continueWithGitHub")}
      </button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
