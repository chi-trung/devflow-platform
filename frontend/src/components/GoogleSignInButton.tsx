import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import {
  buildGoogleAuthUrl,
  completeOAuthExchange,
  getOAuthConfig,
} from "../lib/oauth";

/**
 * 'Continue with Google' button. Renders nothing when the backend has not been
 * configured for Google sign-in (GoogleClientId empty), so the feature can be
 * shipped without breaking the existing email/password auth.
 *
 * Flow:
 *   1. Build a Google authorization URL with a PKCE code_challenge, open it.
 *   2. Google redirects back to the app with ?code=…
 *   3. completeOAuthExchange() swaps the code for a DevFlow JWT pair, which is
 *      saved by the AuthContext, then navigates home.
 */
export function GoogleSignInButton() {
  const { t } = useTranslation();
  const { setSessionFromTokens } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOAuthConfig().then((config) => {
      if (!cancelled && config?.googleEnabled) setEnabled(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // If we landed here with ?code= (Google redirect back), finish the exchange.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
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
    if (!config?.googleEnabled) {
      setError(t("auth.googleNotConfigured"));
      return;
    }
    try {
      const url = await buildGoogleAuthUrl(config);
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
          <svg className="size-4" viewBox="0 0 48 48" aria-hidden>
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
        )}
        {loading ? t("auth.redirecting") : t("auth.continueWithGoogle")}
      </button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
