import { useEffect, useState } from "react";
import {
  getOAuthConfig,
  peekOAuthConfig,
  subscribeOAuthConfig,
  type OAuthConfig,
} from "../lib/oauth";

export interface SocialProviders {
  // ready is false until the config round-trip has resolved; while it is
  // unknown we show neither the provider buttons nor the "or" divider, so the
  // divider never promises a choice that the buttons then fail to render.
  ready: boolean;
  google: boolean;
  github: boolean;
  any: boolean;
}

/**
 * Reads which social sign-in providers are actually enabled, from the same
 * cached config the GoogleSignInButton/GitHubSignInButton render from. Login
 * and register use it to gate the "or" divider: with zero providers enabled
 * (or the config fetch failed, which is *unknown*, not "unconfigured" — either
 * way there is nothing to divide toward), the divider would over-claim.
 */
export function useSocialProviders(): SocialProviders {
  const [config, setConfig] = useState<OAuthConfig | null>(() => peekOAuthConfig());

  useEffect(() => {
    if (config) return;
    const unsubscribe = subscribeOAuthConfig(setConfig);
    // Kick a fetch too: main.tsx's boot prefetch may not have run yet (direct
    // navigation to /login during the chunk load, or a stale cachedConfig
    // miss). getOAuthConfig dedupes against the buttons' identical call.
    void getOAuthConfig();
    return unsubscribe;
  }, [config]);

  return {
    ready: config !== null,
    google: config?.googleEnabled ?? false,
    github: config?.gitHubEnabled ?? false,
    any: Boolean(config?.googleEnabled || config?.gitHubEnabled),
  };
}
