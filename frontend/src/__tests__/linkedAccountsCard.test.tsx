import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

// The card is the only place a person can see, or cut off, the external
// identities that reach their account without a password. Two things must hold:
//
//  1. It says what is linked. A link the person cannot see is a door they
//     cannot account for.
//  2. Removal is confirmed first, and a refusal is shown as the server's own
//     words. The server refuses to drop the last provider on an account with no
//     address; reporting "updated" over that refusal would be a lie about their
//     own security, and silently doing nothing would leave them believing they
//     had cut something off that is still there.

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

import "../i18n";

const pushToast = vi.fn();
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: pushToast }),
}));

vi.mock("../hooks/useSocialProviders", () => ({
  useSocialProviders: () => ({ ready: true, google: true, github: true, any: true }),
}));

import { LinkedAccountsCard } from "../components/LinkedAccountsCard";
import { invalidateApiCache } from "../lib/api";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Serves the read, and the unlink; anything else fails loudly. */
function serve(state: unknown, unlink?: { status: number; body: unknown }) {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      if (!unlink) throw new Error("unexpected DELETE");
      return json(unlink.body, unlink.status);
    }
    if (String(url).includes("/auth/linked-accounts")) return json(state);
    throw new Error(`unexpected request: ${String(url)}`);
  };
}

const LINKED = { providers: ["google", "github"], email: "a@gmail.com", canBeRecovered: true };
const EMPTY = { providers: [], email: null, canBeRecovered: false };

afterEach(() => {
  invalidateApiCache();
  pushToast.mockClear();
});

describe("LinkedAccountsCard", () => {
  it("lists every linked provider by name", async () => {
    fetchMock.mockImplementation(serve(LINKED));

    render(<LinkedAccountsCard />);

    expect(await screen.findByText("Google")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
  });

  it("says plainly that nothing is linked", async () => {
    fetchMock.mockImplementation(serve(EMPTY));

    render(<LinkedAccountsCard />);

    expect(
      await screen.findByText("Nothing linked yet. You sign in with your username and password."),
    ).toBeTruthy();
  });

  it("asks before removing, and only then calls the server", async () => {
    fetchMock.mockImplementation(
      serve(LINKED, { status: 200, body: { providers: ["github"], email: "a@gmail.com", canBeRecovered: true } }),
    );

    render(<LinkedAccountsCard />);
    // Two providers, two "Remove" buttons — the first one is Google's.
    const [removeGoogle] = await screen.findAllByRole("button", { name: /remove/i });
    fireEvent.click(removeGoogle!);

    // The confirmation is a real step, not a toast that flashes past.
    expect(fetchMock.mock.calls.filter(([, i]) => (i as RequestInit)?.method === "DELETE")).toHaveLength(0);
    expect(screen.getByText(/will stop working/i)).toBeTruthy();

    // Now the row shows the confirming pair, whose labels are distinct from
    // "Remove" — the confirm button says so outright, not just "Remove".
    fireEvent.click(screen.getByRole("button", { name: /yes, remove it/i }));

    await waitFor(() => {
      const del = fetchMock.mock.calls.find(([, i]) => (i as RequestInit)?.method === "DELETE");
      expect(del).toBeTruthy();
      expect(String((del![0] as string))).toContain("/auth/linked-accounts/google");
    });
    await waitFor(() => {
      expect(pushToast).toHaveBeenCalled();
    });
  });

  it("shows the server's refusal when removal would strand the account", async () => {
    fetchMock.mockImplementation(
      serve(LINKED, {
        status: 409,
        body: {
          title: "Conflict",
          status: 409,
          detail: "This is the only way back into this account.",
        },
      }),
    );

    render(<LinkedAccountsCard />);
    const [removeGoogle] = await screen.findAllByRole("button", { name: /remove/i });
    fireEvent.click(removeGoogle!);
    fireEvent.click(screen.getByRole("button", { name: /yes, remove it/i }));

    // The server's own words, verbatim — it is the only party that knows which
    // case this is. No success toast over a refusal.
    expect(await screen.findByText(/only way back into this account/i)).toBeTruthy();
    expect(pushToast).not.toHaveBeenCalled();
  });

  it("still shows a read failure rather than an empty list", async () => {
    // An error is unknown, not "nothing linked" — rendering the empty state
    // over a failed read would tell the person they have no linked accounts
    // when the truth is that we could not find out.
    fetchMock.mockImplementation(async () => json({ title: "boom", status: 500 }, 500));

    render(<LinkedAccountsCard />);

    // The api client's own wording for a 500 with no ProblemDetails detail.
    expect(await screen.findByText(/request failed/i)).toBeTruthy();
    expect(
      screen.queryByText("Nothing linked yet. You sign in with your username and password."),
    ).toBeNull();
  });
});
