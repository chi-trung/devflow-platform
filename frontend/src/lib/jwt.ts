export interface JwtClaims {
  sub: string;
  email: string;
  username?: string;
  displayName?: string;
  /** Epoch-seconds expiry (standard JWT claim). */
  exp?: number;
}

export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * True when the token is expired or malformed. Tokens without an `exp`
 * claim are treated as valid (never trust a server-issued JWT to omit it,
 * but degrade gracefully rather than lock the user out on a parse quirk).
 */
export function isTokenExpired(token: string): boolean {
  const claims = decodeJwt(token);
  if (!claims || typeof claims.exp !== "number") return false;
  return Date.now() >= claims.exp * 1000;
}
