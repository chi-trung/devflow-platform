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

/** Fetches which OAuth providers are configured on the backend (cached). */
export async function getOAuthConfig(): Promise<OAuthConfig | null> {
  if (cachedConfig) return cachedConfig;
  try {
    cachedConfig = await api<OAuthConfig>("/auth/oauth/config");
    return cachedConfig;
  } catch {
    return null;
  }
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

/** Parses ?code= off the current URL and exchanges it for a DevFlow session. */
export async function completeOAuthExchange(): Promise<LoginResponse | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return null;

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
