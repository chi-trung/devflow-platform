import { api } from "./api";
import type { LoginResponse } from "../types/api";

export interface OAuthConfig {
  googleEnabled: boolean;
  googleClientId: string;
  googleRedirectUri: string;
}

let cachedConfig: OAuthConfig | null = null;

/** Fetches whether Google sign-in is configured on the backend (cached). */
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

  // Keep the redirect page we came from so we can land back there after sign-in.
  try {
    sessionStorage.setItem("devflow.oauthRedirect", window.location.pathname);
  } catch {}

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

/** Parses ?code= off the current URL and exchanges it for a DevFlow session. */
export async function completeOAuthExchange(): Promise<LoginResponse | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return null;

  const verifier = sessionStorage.getItem("devflow.oauthVerifier");
  sessionStorage.removeItem("devflow.oauthVerifier");
  if (!verifier) {
    throw new Error("OAuth session expired. Please try signing in again.");
  }

  return api<LoginResponse>("/auth/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({ provider: "google", code, codeVerifier: verifier }),
  });
}
