import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import type { OAuthConfig } from "../lib/oauth";

// Registration collects no address, so an account can be one forgotten password
// away from being gone for good. This banner is the only thing standing between
// that and a silent, permanent loss — so its behaviour is pinned, not assumed.
//
// The two properties that matter:
//  1. It warns only for an account that has no recovery route, and it stays
//     silent for one that does. Rendering it either way is noise; the reverse
//     error (hiding it for an account with no way back in) is the bug the whole
//     change exists to prevent.
//  2. A provider already owned by another account must produce an error the
//     person can read and a session that survives it. A 409 that logged the
//     user out, or swallowed into silence, would be worse than no banner at all.

const localStore: Record<string, string> = {};
const sessionStore: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(localStore)) delete localStore[key];
  for (const key of Object.keys(sessionStore)) delete sessionStore[key];

  const makeStorage = (backing: Record<string, string>) => ({
    getItem: (k: string) => (k in backing ? backing[k] : null),
    setItem: (k: string, v: string) => {
      backing[k] = v;
    },
    removeItem: (k: string) => {
      delete backing[k];
    },
    clear: () => {
      for (const k of Object.keys(backing)) delete backing[k];
    },
  });

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: makeStorage(localStore),
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: makeStorage(sessionStore),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushToast.mockClear();
  refreshUser.mockClear();
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // An insecure origin, and jsdom's crypto.subtle does not exist. Both matter:
  // Google's PKCE check throws on a non-secure origin, and
  // randomVerifier()/sha256() need subtle — without these stubs the builder
  // throws and the click path never reaches the tag it is here to verify.
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(window, "crypto", {
    configurable: true,
    value: {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
      subtle: {
        digest: async () => new Uint8Array(32).fill(1),
      },
    },
  });
  window.history.replaceState({}, "", "/");
});

// The assertions below name the English copy, so the real catalog is loaded
// rather than a hand-written table that could drift from en.json — a test that
// carries its own copy of the strings keeps passing after the wording moves.
import "../i18n";

let fakeConfig: OAuthConfig | null = null;

vi.mock("../lib/oauth", async () => {
  const actual = await vi.importActual<typeof import("../lib/oauth")>("../lib/oauth");
  return {
    ...actual,
    getOAuthConfig: async () => fakeConfig,
  };
});

vi.mock("../hooks/useSocialProviders", () => ({
  useSocialProviders: () => ({
    ready: true,
    google: true,
    github: true,
    any: true,
  }),
}));

const pushToast = vi.fn();
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: pushToast }),
}));

const refreshUser = vi.fn().mockResolvedValue(true);
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ refreshUser }),
}));

import { LinkAccountBanner } from "../components/LinkAccountBanner";
import { invalidateApiCache } from "../lib/api";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Serves /auth/linked-accounts, and every other path as "unreachable" so a
 *  stray request fails loudly instead of quietly returning a status object. */
function serveStatus(
  status: { providers: string[]; email: string | null; canBeRecovered: boolean },
) {
  return async (url: RequestInfo | URL) => {
    if (String(url).includes("/auth/linked-accounts")) return json(status);
    throw new Error(`unexpected request: ${String(url)}`);
  };
}

const UNRECOVERABLE = { providers: [], email: null, canBeRecovered: false };

// api() memoizes GETs in a module-level cache, so one file's cases would read
// each other's stored responses and the first assertion to run would decide
// every answer after it. Clearing between cases is what keeps these eight
// genuinely independent.
afterEach(() => {
  invalidateApiCache();
});

describe("LinkAccountBanner", () => {
  it("warns when the account has no way back in", async () => {
    fetchMock.mockImplementation(serveStatus(UNRECOVERABLE));

    render(<LinkAccountBanner />);

    expect(
      await screen.findByText("This account can be lost"),
    ).toBeTruthy();
    expect(screen.getByText("Link Google")).toBeTruthy();
    expect(screen.getByText("Link GitHub")).toBeTruthy();
  });

  it("says nothing once the account can be recovered", async () => {
    fetchMock.mockImplementation(
      serveStatus({
        providers: ["google"],
        email: "someone@gmail.com",
        canBeRecovered: true,
      }),
    );

    const { container } = render(<LinkAccountBanner />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("still warns when the status read failed — a failed read is unknown, not linked", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    render(<LinkAccountBanner />);

    // A silent render here would be the one outcome that actively misleads:
    // an unreachable status is not a status saying "you're fine".
    expect(await screen.findByText("This account can be lost")).toBeTruthy();
  });

  it("collapses to one line on 'Do this later', and survives a reload", async () => {
    fetchMock.mockImplementation(serveStatus(UNRECOVERABLE));

    render(<LinkAccountBanner />);
    await screen.findByText("Do this later");
    // act(): this is a sync state update from an event handler, but the
    // component has a live fetch resolving in the same tick.
    await act(async () => {
      screen.getByText("Do this later").click();
    });

    expect(
      screen.getByText(
        "This account still has no way to recover a forgotten password.",
      ),
    ).toBeTruthy();
    // The full warning body is gone, not just visually hidden.
    expect(screen.queryByText("This account can be lost")).toBeNull();
    expect(localStore["devflow.linkPromptSnoozed"]).toBe("1");

    cleanup();
    render(<LinkAccountBanner />);
    expect(
      await screen.findByText(
        "This account still has no way to recover a forgotten password.",
      ),
    ).toBeTruthy();
  });

  it("posts the code to /auth/oauth/link and re-reads the status on return", async () => {
    // A landing straight from the provider: the redirect URI is the app
    // origin, so the banner is what claims the ?code=. The origin has to be
    // the one jsdom was configured with — replaceState refuses a cross-origin
    // URL, and a rewrite that silently did nothing would leave the case
    // asserting against no code at all.
    window.history.replaceState(
      {},
      "",
      "/?code=abc123&state=state123&session_state=sess",
    );
    sessionStore["devflow.oauthMode"] = "link";
    sessionStore["devflow.oauthProvider"] = "google";
    sessionStore["devflow.oauthVerifier"] = "verifier";

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.includes("/auth/oauth/link")) {
        return json({
          providers: ["google"],
          email: "someone@gmail.com",
          canBeRecovered: true,
        });
      }
      if (path.includes("/auth/linked-accounts")) {
        return json({
          providers: ["google"],
          email: "someone@gmail.com",
          canBeRecovered: true,
        });
      }
      if (path.includes("/auth/refresh")) {
        return json({ accessToken: "new-access", refreshToken: "new-refresh" }, 200);
      }
      throw new Error(`unexpected request: ${path}`);
    });

    render(<LinkAccountBanner />);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("/auth/oauth/link")),
      ).toBe(true),
    );

    const linkCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/auth/oauth/link"),
    )!;
    expect(JSON.parse(String((linkCall[1] as RequestInit).body))).toEqual({
      provider: "google",
      code: "abc123",
      codeVerifier: "verifier",
    });

    // The spent code must not sit in the address bar or the session history.
    await waitFor(() => expect(window.location.search).toBe(""));
    // The link tag is consumed by the time the banner's own effect is done,
    // which is what keeps a later sign-in from being read as a link.
    await waitFor(() => expect(sessionStore["devflow.oauthMode"]).toBeUndefined());

    await waitFor(() => expect(pushToast).toHaveBeenCalled());
    // The banner must disappear once the re-read says the account is
    // recoverable — and the token refresh re-reads the claims the link
    // changed (avatar, address) without signing anyone out.
    await waitFor(() => expect(screen.queryByText("This account can be lost")).toBeNull());
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it("surfaces a 409 as a readable error and keeps the session intact", async () => {
    window.history.replaceState({}, "", "/?code=abc123");
    sessionStore["devflow.oauthMode"] = "link";
    sessionStore["devflow.oauthProvider"] = "google";
    sessionStore["devflow.oauthVerifier"] = "verifier";

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.includes("/auth/oauth/link")) {
        // `detail` is what the API client puts in the message; a ProblemDetails
        // with only a `title` would render a generic string here and the test
        // would pass without proving the real wording reaches the person.
        return json(
          {
            title: "Conflict",
            status: 409,
            detail:
              "That google account is already linked to a different DevFlow account.",
          },
          409,
        );
      }
      if (path.includes("/auth/linked-accounts")) return json(UNRECOVERABLE);
      throw new Error(`unexpected request: ${path}`);
    });

    render(<LinkAccountBanner />);

    expect(
      await screen.findByText(
        "That google account is already linked to a different DevFlow account.",
      ),
    ).toBeTruthy();

    // Still on the dashboard, still signed in: the refusal is about the
    // provider, not about this session.
    expect(refreshUser).not.toHaveBeenCalled();
    // The dead code is cleared either way, and the tag with it — a 409 must
    // not leave a link flow armed for the next callback.
    expect(window.location.search).toBe("");
    expect(sessionStore["devflow.oauthMode"]).toBeUndefined();
    // And the account is still unrecoverable, so the warning stays up.
    expect(screen.getByText("This account can be lost")).toBeTruthy();
  });

  it("ignores a ?code= landing that is not a link", async () => {
    window.history.replaceState({}, "", "/?code=abc123");
    sessionStore["devflow.oauthProvider"] = "google";
    sessionStore["devflow.oauthVerifier"] = "verifier";

    fetchMock.mockImplementation(serveStatus(UNRECOVERABLE));

    render(<LinkAccountBanner />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // No link mode: this code belongs to a sign-in, which the login page's own
    // button redeems. Redeeming it here too would double-spend it — or, worse,
    // attach a sign-in identity to whichever account happens to be open.
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes("/auth/oauth/link")),
    ).toBe(false);
  });

  it("tags the flow as a link before redirecting to the provider", async () => {
    fetchMock.mockImplementation(serveStatus(UNRECOVERABLE));
    fakeConfig = {
      googleEnabled: true,
      googleClientId: "google-client-id",
      googleRedirectUri: "http://localhost",
      gitHubEnabled: true,
      gitHubClientId: "github-client-id",
      gitHubRedirectUri: "http://localhost",
    };

    const assigned: string[] = [];
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        origin: "http://localhost",
        get href() {
          return "http://localhost/";
        },
        set href(v: string) {
          assigned.push(v);
        },
        get search() {
          return "";
        },
        get pathname() {
          return "/";
        },
        get hash() {
          return "";
        },
        history: window.history,
      },
    });

    render(<LinkAccountBanner />);
    await screen.findByText("This account can be lost");

    await act(async () => {
      screen.getByText("Link Google").click();
    });

    expect(sessionStore["devflow.oauthMode"]).toBe("link");
    expect(sessionStore["devflow.oauthProvider"]).toBe("google");
    expect(assigned[0]).toContain("accounts.google.com");
  });
});
