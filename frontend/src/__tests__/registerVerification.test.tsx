import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The registration flow is the whole point of this feature, and the bug that
// motivated it was a single line: register() used to call login() right after
// the account was created, which handed a session to whoever typed an address
// they did not own. Nothing pinned that behaviour, so it is pinned now.
//
// Two locks:
//  1. register() returns the address and mints no session — no POST to
//     /auth/login, no token written to localStorage.
//  2. The API client does not refresh-and-retry on 403. It does on 401, so a
//     backend that answered "not verified" with 401 would be silently undone
//     in the browser: the refresh would succeed and the unverified user would
//     walk straight in. 403 is the contract; this test is what keeps it.

const localStore: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(localStore)) delete localStore[key];

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (k in localStore ? localStore[k] : null),
      setItem: (k: string, v: string) => {
        localStore[k] = v;
      },
      removeItem: (k: string) => {
        delete localStore[k];
      },
      clear: () => {
        for (const k of Object.keys(localStore)) delete localStore[k];
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: (path: string, options?: RequestInit) => actual.api(path, options),
  };
});

import { AuthProvider, useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function RegisterProbe() {
  const { register } = useAuth();
  return (
    <button
      onClick={() =>
        register({
          email: "someone@else.com",
          username: "someone",
          password: "Sup3rSecret!",
          displayName: "Someone",
        })
      }
    >
      register
    </button>
  );
}

describe("registration no longer signs the user in", () => {
  it("posts to /auth/register only, and stores no session", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: "u-1", email: "someone@else.com" }, 201),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterProbe />
        </AuthProvider>
      </MemoryRouter>,
    );

    screen.getByText("register").click();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/auth/register");

    // The whole vulnerability: if a second call to /auth/login had gone out,
    // the stranger would hold a working session for an address they never
    // proved they own.
    const calledPaths = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledPaths.some((p) => p.includes("/auth/login"))).toBe(false);

    // And nothing was persisted that RequireAuth or a page refresh would
    // pick up as a signed-in visitor.
    expect(Object.keys(localStore)).toHaveLength(0);
  });
});

describe("the API client does not launder a 403 into a session", () => {
  it("surfaces a 403 without attempting a token refresh", async () => {
    // A refresh token exists — the exact case where a 401 would trigger the
    // silent refresh-and-retry. 403 must not. The key is api.ts's own
    // REFRESH_KEY; a typo here would leave tokens.refresh null and make this
    // assertion pass for the wrong reason.
    localStorage.setItem("devflow.refreshToken", "existing-refresh-token");

    const unauthorized = vi.fn();
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.includes("/auth/refresh")) {
        unauthorized();
        return jsonResponse(
          { accessToken: "new-access", refreshToken: "new-refresh" },
          200,
        );
      }
      return jsonResponse(
        { title: "Email not verified", status: 403 },
        403,
      );
    });

    await expect(api("/auth/login", { method: "POST", body: "{}" })).rejects.toThrow();

    expect(unauthorized).not.toHaveBeenCalled();
  });
});
