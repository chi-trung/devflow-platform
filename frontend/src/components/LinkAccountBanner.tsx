import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { useToast } from "./ui/ToastProvider";
import { Button } from "./ui/Button";
import { ErrorAlert } from "./ui/ErrorAlert";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../hooks/useApi";
import { useSocialProviders } from "../hooks/useSocialProviders";
import { api } from "../lib/api";
import {
  buildGitHubAuthUrl,
  buildGoogleAuthUrl,
  claimOAuthCallback,
  clearOAuthLinkMode,
  getOAuthConfig,
  isOAuthLinkMode,
  OAuthCancelledError,
  setOAuthLinkMode,
  stripOAuthCallbackParams,
} from "../lib/oauth";
import type { LinkedAccountsResponse } from "../types/api";

/** Where a snoozed prompt remembers itself. localStorage, not sessionStorage:
 *  dismissing this is a decision that has to survive closing the tab, or the
 *  banner comes back on the next visit and the dismiss button means nothing. */
const SNOOZE_KEY = "devflow.linkPromptSnoozed";

function readSnoozed(): boolean {
  try {
    return localStorage.getItem(SNOOZE_KEY) === "1";
  } catch {
    // No storage (private mode, blocked cookies): show the prompt every time
    // rather than none — the prompt only ever warns, it never blocks.
    return false;
  }
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  github: "GitHub",
};

/** "github" → "GitHub". Provider names are proper nouns the backend owns, so
 *  they are branded here rather than translated — a translated provider name
 *  would be unrecognisable next to the consent screen it was just granted on. */
function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

/**
 * Warns on the dashboard when the account has no way back in.
 *
 * Registration collects no address, so an account can be one forgotten password
 * away from gone — permanently, since there is no mail to send a reset to and
 * no inbox to send it to. Linking a Google or GitHub identity is the only thing
 * that changes that: it proves an address and adds a second way in.
 *
 * Two states, one element. "Later" collapses it to a single line rather than
 * dismissing it, because the warning is about something irreversible and the
 * next visit to the dashboard is exactly when it is worth repeating. The prompt
 * never blocks anything: the user chose warning over gating, so the account
 * works exactly the same whether the banner is showing or not.
 */
export function LinkAccountBanner() {
  const { t } = useTranslation();
  const { push } = useToast();
  const { refreshUser } = useAuth();
  const providers = useSocialProviders();

  const { data, loading, error, reload } = useApi<LinkedAccountsResponse>(
    () => api<LinkedAccountsResponse>("/auth/linked-accounts"),
    [],
  );

  const [snoozed, setSnoozed] = useState(readSnoozed);
  const [linking, setLinking] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Fail closed, same rule as the invites block on this page: a failed read is
  // unknown, not "linked" — so an error with no data may still show the
  // warning, but a successful read may never hide it. Silently rendering
  // nothing on error would be the one outcome that misleads the person.
  const needsLink = loading || data === null ? error !== null : !data.canBeRecovered;

  // Returning from the provider: the redirect URI is the app origin, so this
  // component is what claims the ?code= on a link. It only does so while the
  // link tag is set — the sign-in buttons' effects on the login/register pages
  // own the same URL shape, and the two must never both redeem the code.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const denial = params.get("error");
    if (!code && !denial) return;
    if (!isOAuthLinkMode()) return;

    let cancelled = false;
    const provider = sessionStorage.getItem("devflow.oauthProvider") ?? "";
    setLinking(provider);

    if (denial && !code) {
      // Consent refused — the provider lands with ?error=access_denied. Clear
      // every pending tag so this landing is not claimed twice, then drop the
      // dead params: a spent code is a credential and must not sit in history.
      clearOAuthLinkMode();
      sessionStorage.removeItem("devflow.oauthProvider");
      stripOAuthCallbackParams();
      setLinking(null);
      setLinkError(t("account.linkCancelled"));
      return;
    }

    void (async () => {
      try {
        const claimed = claimOAuthCallback();
        // The code is spent and the flow is decided either way, so the tag
        // goes now. Leaving it behind would disarm the sign-in buttons for
        // the rest of this tab — the next "Continue with Google" would be
        // ignored and look like a button that simply does nothing.
        clearOAuthLinkMode();

        const result = await api<LinkedAccountsResponse>("/auth/oauth/link", {
          method: "POST",
          body: JSON.stringify({
            provider: claimed.provider,
            code: claimed.code,
            codeVerifier: claimed.codeVerifier,
          }),
        });
        if (cancelled) return;
        stripOAuthCallbackParams();
        setSnoozed(false);
        try {
          localStorage.removeItem(SNOOZE_KEY);
        } catch {}
        push(t("account.linked", { provider: providerLabel(claimed.provider) }));
        reload();
        // The access token minted at sign-in predates the link, so its claims
        // still show the old avatar and no address. Refreshing re-reads them
        // without touching the session — without this, the header keeps an
        // avatar the provider has just replaced until the token happens to
        // expire on its own.
        void refreshUser();
        return result;
      } catch (err: unknown) {
        if (cancelled) return;
        stripOAuthCallbackParams();
        setLinking(null);
        if (err instanceof OAuthCancelledError) {
          setLinkError(t("account.linkCancelled"));
        } else {
          // A 409 here is the other account already owning this identity. It
          // is a refusal, not a fault: the session stays exactly as it was,
          // and this account is untouched. Showing the server's own message
          // is the honest thing — it is the only party that knows why.
          setLinkError(err instanceof Error ? err.message : t("account.linkFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t, push, reload, refreshUser]);

  const startLink = useCallback(
    async (provider: "google" | "github") => {
      setLinkError(null);
      const config = await getOAuthConfig();
      if (!config) {
        setLinkError(t("auth.configUnavailable"));
        return;
      }
      const enabled = provider === "google" ? config.googleEnabled : config.gitHubEnabled;
      if (!enabled) {
        setLinkError(
          provider === "google" ? t("auth.googleNotConfigured") : t("auth.githubNotConfigured"),
        );
        return;
      }
      setLinking(provider);
      try {
        // Tagged before the redirect, and that tag is what the landing effect
        // above checks — without it the login page's own ?code= handler would
        // take the code and sign this person into a different account.
        setOAuthLinkMode();
        const url =
          provider === "google"
            ? await buildGoogleAuthUrl(config)
            : await buildGitHubAuthUrl(config);
        window.location.href = url;
      } catch {
        setLinking(null);
        setLinkError(t("auth.somethingWrong"));
      }
    },
    [t],
  );

  const snooze = useCallback(() => {
    setSnoozed(true);
    try {
      localStorage.setItem(SNOOZE_KEY, "1");
    } catch {}
  }, []);

  // Already linked — nothing to warn about. This also covers an account that
  // has an address from a past provider link: recoverable, silent.
  if (!loading && data !== null && data.canBeRecovered) return null;

  // The provider buttons themselves are the call to action, so with none
  // enabled the warning has no action attached and would just be noise. The
  // read failure still surfaces: that is about this account, not the config.
  if (!needsLink || !providers.any) return null;

  if (snoozed) {
    return (
      <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{t("account.linkLaterSnoozed")}</span>
        {providers.google && (
          <button
            type="button"
            onClick={() => void startLink("google")}
            className="cursor-pointer font-medium text-primary transition-colors duration-150 hover:text-primary-strong"
          >
            {t("account.linkGoogle")}
          </button>
        )}
        {providers.github && (
          <button
            type="button"
            onClick={() => void startLink("github")}
            className="cursor-pointer font-medium text-primary transition-colors duration-150 hover:text-primary-strong"
          >
            {t("account.linkGithub")}
          </button>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label={t("account.linkWarningTitle")}
      className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold">{t("account.linkWarningTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("account.linkWarningBody")}</p>

          {linkError && (
            <div className="mt-3">
              <ErrorAlert message={linkError} />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {providers.google && (
              <Button
                size="sm"
                disabled={linking !== null}
                onClick={() => void startLink("google")}
              >
                {linking === "google" ? t("account.linking") : t("account.linkGoogle")}
              </Button>
            )}
            {providers.github && (
              <Button
                size="sm"
                variant="outline"
                disabled={linking !== null}
                onClick={() => void startLink("github")}
              >
                {linking === "github" ? t("account.linking") : t("account.linkGithub")}
              </Button>
            )}
            {/* Only offered once a provider is chosen: dismissing during the
                round trip would leave the flag set and the user back at an
                account that is still one password away from gone. */}
            {linking === null && (
              <Button size="sm" variant="ghost" onClick={snooze}>
                {t("account.linkLater")}
              </Button>
            )}
          </div>

          {data && data.providers.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("account.alreadyLinkedWith", {
                providers: data.providers.map(providerLabel).join(", "),
              })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
