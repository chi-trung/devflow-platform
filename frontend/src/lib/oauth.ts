import { api } from "./api";
import type { LoginResponse } from "../types/api";

export interface OAuthConfig {
  googleEnabled: boolean;
  googleClientId: string;
  googleRedirectUri: string;
  // System.Text.Json's camelCase policy only lowercases the first letter, so
  // GitHubEnabled serializes as "gitHubEnabled" — probed live from /auth/oauth/config.
  gitHubEnabled: boolean;
  gitHubClientId: string;
  gitHubRedirectUri: string;
}

let cachedConfig: OAuthConfig | null = null;
// Deduplicates concurrent callers: without this, GoogleSignInButton and
// GitHubSignInButton each fire their own request while the config is still in
// flight, and a boot prefetch would race both of them.
let configRequest: Promise<OAuthConfig | null> | null = null;
// Listeners get the resolved config (or null when the fetch failed). Login and
// register pages subscribe so the "or" divider can appear in the same render
// pass as the provider buttons instead of on a later one.
const configListeners = new Set<(config: OAuthConfig | null) => void>();

/** Subscribes to the next OAuth config resolution. Returns an unsubscribe fn. */
export function subscribeOAuthConfig(listener: (config: OAuthConfig | null) => void): () => void {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

function notifyOAuthConfig(config: OAuthConfig | null): void {
  for (const listener of [...configListeners]) listener(config);
}

/**
 * Fire-and-forget the config fetch so it is warm before an auth page renders.
 * The login/register cards show "Continue with Google/GitHub" only once the
 * config says a provider is enabled; when that round-trip lands after first
 * paint the card grows by ~115px and the shift trips Lighthouse CLS.
 * main.tsx calls this on boot so the answer is usually cached by the time the
 * buttons mount.
 */
export function prefetchOAuthConfig(): void {
  void getOAuthConfig();
}

/** The cached config if a fetch already landed, else null (no request fired).
 *  Lets a button seed its enabled-state synchronously during the first render
 *  instead of waiting a round-trip, so the login card never grows after paint. */
export function peekOAuthConfig(): OAuthConfig | null {
  return cachedConfig;
}

/** Fetches which OAuth providers are configured on the backend (cached). */
export async function getOAuthConfig(): Promise<OAuthConfig | null> {
  if (cachedConfig) return cachedConfig;
  configRequest ??= api<OAuthConfig>("/auth/oauth/config")
    .then((config) => {
      cachedConfig = config;
      notifyOAuthConfig(config);
      return config;
    })
    .catch(() => {
      notifyOAuthConfig(null);
      return null;
    })
    .finally(() => {
      configRequest = null;
    });
  return configRequest;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function randomVerifier(): Promise<string> {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

/** Remembers which provider started the flow, so the ?code= landing handler
 * on each button only fires for the provider that actually redirected here. */
function setPendingProvider(provider: string): void {
  try {
    sessionStorage.setItem("devflow.oauthProvider", provider);
  } catch {}
}

function keepRedirectPath(): void {
  // Keep the redirect page we came from so we can land back there after sign-in.
  try {
    sessionStorage.setItem("devflow.oauthRedirect", window.location.pathname);
  } catch {}
}

/**
 * Builds the Google OAuth authorization URL with a PKCE code challenge.
 * The code_verifier is persisted in sessionStorage so it can be sent with the
 * code when the browser lands back on the redirect URI.
 */
export async function buildGoogleAuthUrl(config: OAuthConfig): Promise<string> {
  const verifier = await randomVerifier();
  const challengeBytes = await sha256(verifier);
  const challenge = base64Url(challengeBytes);

  const redirectUri = config.googleRedirectUri || window.location.origin;

  keepRedirectPath();
  setPendingProvider("google");

  sessionStorage.setItem("devflow.oauthVerifier", verifier);

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Builds the GitHub OAuth authorization URL. GitHub's classic OAuth App flow
 * has no PKCE — a random state serves as the anti-CSRF value instead; it is
 * validated when the browser lands back on the redirect URI.
 */
export async function buildGitHubAuthUrl(config: OAuthConfig): Promise<string> {
  const state = await randomVerifier();

  const redirectUri = config.gitHubRedirectUri || window.location.origin;

  keepRedirectPath();
  setPendingProvider("github");

  try {
    sessionStorage.setItem("devflow.oauthState", state);
  } catch {}

  const params = new URLSearchParams({
    client_id: config.gitHubClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read:user user:email repo",
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/** Thrown when the ?code= vanished between the effect's check and the
 *  exchange (the boot-time reconciliation strips dead callback params before
 *  React mounts). Distinct from an expired session so callers can clear the
 *  URL without claiming the provider's redirect actually reached us. */
export class OAuthCancelledError extends Error {
  constructor() {
    super("Sign-in did not complete.");
    this.name = "OAuthCancelledError";
  }
}

/** Params an OAuth provider may leave on the redirect landing: the exchange
 *  credentials and the consent-error pair. Unrelated query params survive. */
const CALLBACK_PARAMS = ["code", "state", "error", "error_description", "scope", "session_state"];

/** Removes leftover callback params from the address bar and session history
 *  (replaceState: no new entry, no reload). A spent or dead ?code= must not
 *  sit in the URL — it is a credential, and history would keep replaying it. */
export function stripOAuthCallbackParams(): void {
  const params = new URLSearchParams(window.location.search);
  CALLBACK_PARAMS.forEach((key) => params.delete(key));
  const query = params.toString();
  const url = window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
  window.history.replaceState(window.history.state, "", url);
}

/** Runs before React mounts. A callback URL no tab can claim (hand-pasted
 *  link, a second visit to a stale URL, sessionStorage gone with the tab)
 *  would otherwise leave one-time credentials in the address bar and session
 *  history forever — nothing reads them, so no code path ever clears them.
 *  A claimable landing keeps its params for the button effects to exchange
 *  the code or report the cancellation. */
export function reconcileOAuthCallback(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("code") && !params.has("error")) return;
  const provider = sessionStorage.getItem("devflow.oauthProvider");
  if (provider === "google" || provider === "github") return;
  stripOAuthCallbackParams();
}

/** Parses ?code= off the current URL and exchanges it for a DevFlow session. */
export async function completeOAuthExchange(): Promise<LoginResponse | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) throw new OAuthCancelledError();

  const provider =
    sessionStorage.getItem("devflow.oauthProvider") ?? "google";
  sessionStorage.removeItem("devflow.oauthProvider");

  let codeVerifier = "";
  if (provider === "google") {
    codeVerifier = sessionStorage.getItem("devflow.oauthVerifier") ?? "";
    sessionStorage.removeItem("devflow.oauthVerifier");
    if (!codeVerifier) {
      throw new Error("OAuth session expired. Please try signing in again.");
    }
  } else {
    // GitHub: validate the anti-CSRF state we stored before redirecting.
    const expectedState = sessionStorage.getItem("devflow.oauthState");
    sessionStorage.removeItem("devflow.oauthState");
    if (!expectedState || params.get("state") !== expectedState) {
      throw new Error("OAuth session expired. Please try signing in again.");
    }
  }

  return api<LoginResponse>("/auth/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({ provider, code, codeVerifier }),
  });
}
