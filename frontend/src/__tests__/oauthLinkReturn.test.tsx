import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";

// Both providers are registered with /login as their redirect URI — one entry
// in each provider console, shared by sign-in and link. So a link started on
// the dashboard comes back to a page whose only provider button deliberately
// declines to claim a code. This component is what redeems it.
//
// The properties worth pinning, in order of how badly a break would hurt:
//  1. A link landing is claimed, linked, and lands back where it started.
//  2. A *sign-in* landing is never claimed. Claiming it would turn a sign-in
//     into a link onto whatever account happens to be open — or, with no
//     session, burn a valid code against an anonymous request.
//  3. A 409 leaves the session alone and says why. Logging the person out here
//     would be a worse outcome than the bug this exists to fix.

const sessionStore: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(sessionStore)) delete sessionStore[key];

  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (k in sessionStore ? sessionStore[k] : null),
      setItem: (k: string, v: string) => {
        sessionStore[k] = v;
      },
      removeItem: (k: string) => {
        delete sessionStore[k];
      },
      clear: () => {
        for (const k of Object.keys(sessionStore)) delete sessionStore[k];
      },
    },
  });

  window.history.replaceState({}, "", "/");
});

// Real catalog, so an assertion on the English copy cannot drift from en.json.
import "../i18n";

const pushToast = vi.fn();
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: pushToast }),
}));

let authStatus: "authenticated" | "anonymous" | "loading" = "authenticated";
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ status: authStatus }),
}));

import { OAuthLinkReturn } from "../App";
import { invalidateApiCache } from "../lib/api";

const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The link POST succeeds; nothing else is expected to be requested. */
function serveLink(result: unknown, status = 200) {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).includes("/auth/oauth/link")) return json(result, status);
    throw new Error(`unexpected request: ${String(url)} ${init?.method ?? "GET"}`);
  };
}

const LINKED = { providers: ["google"], email: "a@gmail.com", canBeRecovered: true };

/** Tags the sessionStorage a live flow would have left behind. */
function startLink(provider: "google" | "github", landing: string | null = "/") {
  sessionStore["devflow.oauthMode"] = "link";
  sessionStore["devflow.oauthProvider"] = provider;
  if (provider === "google") sessionStore["devflow.oauthVerifier"] = "verifier-value";
  else sessionStore["devflow.oauthState"] = "state-value";
  if (landing !== null) sessionStore["devflow.oauthRedirect"] = landing;
}

/** Every full page load the component attempts, in order. */
let navigations: string[] = [];

/** Replaces window.location with a recorder. The flow ends in a real page
 *  load, which jsdom cannot perform — and the ?code= is already spent by then,
 *  so a stubbed search is honest rather than convenient. */
function stubNavigation(currentSearch = "") {
  navigations = [];
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      origin: "http://localhost",
      pathname: "/login",
      search: currentSearch,
      get href() {
        return "http://localhost/login";
      },
      set href(v: string) {
        navigations.push(v);
      },
    },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  authStatus = "authenticated";
  pushToast.mockClear();
  stubNavigation();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  invalidateApiCache();
});

describe("OAuth link return landing", () => {
  it("links the identity and returns to where the flow started", async () => {
    fetchMock.mockImplementation(serveLink(LINKED));
    startLink("google", "/workspaces/abc");
    stubNavigation("?code=auth-code-1");

    render(<OAuthLinkReturn />);

    await waitFor(() => {
      expect(navigations).toEqual(["/workspaces/abc"]);
    });

    const [, init] = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/auth/oauth/link"),
    )!;
    const body = JSON.parse(String(init?.body));
    expect(body.provider).toBe("google");
    expect(body.code).toBe("auth-code-1");
    expect(body.codeVerifier).toBe("verifier-value");

    // Back where the user started, not stuck on /login.
    expect(sessionStore["devflow.oauthRedirect"]).toBeUndefined();
  });

  it("clears the link tag so a later sign-in is not read as a link", async () => {
    fetchMock.mockImplementation(serveLink(LINKED));
    startLink("google", "/");
    stubNavigation("?code=auth-code-2");

    render(<OAuthLinkReturn />);

    await waitFor(() => {
      expect(sessionStore["devflow.oauthMode"]).toBeUndefined();
    });
    // The pending-provider tag goes with it, so the sign-in buttons' own guard
    // no longer matches and a fresh click is honoured.
    expect(sessionStore["devflow.oauthProvider"]).toBeUndefined();
    expect(sessionStore["devflow.oauthVerifier"]).toBeUndefined();
  });

  it("ignores a sign-in landing", async () => {
    fetchMock.mockImplementation(serveLink(LINKED));
    startLink("google");
    delete sessionStore["devflow.oauthMode"]; // sign-in, not link
    stubNavigation("?code=sign-in-code");

    render(<OAuthLinkReturn />);

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("ignores a link landing whose session is not authenticated", async () => {
    fetchMock.mockImplementation(serveLink(LINKED));
    authStatus = "anonymous";
    startLink("google");
    stubNavigation("?code=auth-code-3");

    render(<OAuthLinkReturn />);

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
    // The tags stay put: the session may be a moment behind, and a code spent
    // on an anonymous request is gone for good.
    expect(sessionStore["devflow.oauthMode"]).toBe("link");
  });

  it("waits for the session restore to finish before linking", async () => {
    fetchMock.mockImplementation(serveLink(LINKED));
    authStatus = "loading";
    startLink("google");
    stubNavigation("?code=auth-code-4");

    const { rerender } = render(<OAuthLinkReturn />);
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });

    authStatus = "authenticated";
    rerender(<OAuthLinkReturn />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("/auth/oauth/link")),
      ).toBe(true);
    });
  });

  it("reports a conflict without ending the session", async () => {
    fetchMock.mockImplementation(
      serveLink(
        {
          title: "Conflict",
          status: 409,
          detail: "That google account is already linked to a different DevFlow account.",
        },
        409,
      ),
    );
    startLink("google", "/");
    stubNavigation("?code=auth-code-5");

    render(<OAuthLinkReturn />);

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalled();
    });
    // The server's own words, not a generic failure: it is the only party that
    // knows why.
    expect(String(pushToast.mock.calls[0][0])).toContain("already linked");
    expect(pushToast.mock.calls[0][1]).toBe("error");
    // No navigation: a refused link leaves the person on a working session.
    expect(navigations).toEqual([]);
  });

  it("reports a refused consent and drops the dead params", async () => {
    fetchMock.mockImplementation(serveLink(LINKED));
    startLink("google", "/");
    stubNavigation("?error=access_denied");

    render(<OAuthLinkReturn />);

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalled();
    });
    expect(pushToast.mock.calls[0][1]).toBe("error");
    // A spent or refused code is a credential; it must not sit in history.
    expect(navigations).toEqual([]);
    expect(sessionStore["devflow.oauthProvider"]).toBeUndefined();
    expect(sessionStore["devflow.oauthMode"]).toBeUndefined();
  });
});
