import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import type { OAuthConfig } from "../lib/oauth";

// Two reachability regressions:
//  1. Delete handlers that leave ConfirmDialog open on failure bury the page
//     error banner behind the modal's z-[70] overlay — the user sees a dialog
//     that already committed to "deleting" and an error that never appears.
//     The fix (BoardPage/GitHubPage pattern) is setPendingDelete(null) BEFORE
//     the await. Lock the source order: close, then await delete, then catch.
//  2. The "or" divider on login/register renders unconditionally while
//     GoogleSignInButton/GitHubSignInButton self-hide when their provider is
//     disabled — zero providers meant an "or" pointing at nothing. The fix
//     gates the divider on useSocialProviders().any. Lock both pages' wiring
//     and the hook's behavior against a mocked config.

const PAGES = join(__dirname, "..", "pages");

const DELETE_PAGES = [
  "LabelsPage",
  "TemplatesPage",
  "SavedSearchesPage",
  "CustomFieldsPage",
  "MilestonesPage",
  "KnowledgePage",
  "WebhooksPage",
  "EpicsPage",
];

function source(page: string): string {
  return readFileSync(join(PAGES, `${page}.tsx`), "utf8");
}

describe("delete handlers close the dialog before awaiting", () => {
  for (const page of DELETE_PAGES) {
    it(`${page}: setPendingDelete(null) runs before the delete request`, () => {
      const content = source(page);
      const start = content.search(/function handleDelete\(|const handleDelete = /);
      expect(start, `${page} lost its handleDelete`).toBeGreaterThan(-1);
      const body = content.slice(start, start + 1500);
      const closed = body.indexOf("setPendingDelete(null);");
      const awaited = body.search(/await (delete|\w*[Dd]elete\w*)\(/);
      expect(closed, `${page} never closes the dialog before deleting`).toBeGreaterThanOrEqual(0);
      expect(awaited, `${page} has no delete await in handleDelete`).toBeGreaterThanOrEqual(0);
      expect(
        closed,
        `${page} awaits the delete while the dialog is still open — the error banner lands behind the overlay`,
      ).toBeLessThan(awaited);
    });
  }
});

describe("auth pages gate the or-divider on enabled providers", () => {
  for (const page of ["LoginPage", "RegisterPage"]) {
    it(`${page}: divider is behind providers.any and the hook is wired`, () => {
      const content = source(page);
      expect(content, `${page} dropped the useSocialProviders call`).toMatch(
        /const providers = useSocialProviders\(\)/,
      );
      const gate = content.indexOf("{providers.any && (");
      const divider = content.indexOf('t("auth.or")');
      expect(gate, `${page} lost the providers.any gate`).toBeGreaterThanOrEqual(0);
      expect(divider, `${page} lost the divider`).toBeGreaterThanOrEqual(0);
      expect(gate, `${page} gate does not wrap the divider`).toBeLessThan(divider);
    });
  }
});

let fakeConfig: OAuthConfig | null = null;
let listeners: Array<(config: OAuthConfig | null) => void> = [];
// Gates the mock's resolution so a test can mount the hook while the config is
// still in flight and deliver it later, exercising the subscription path that
// the real fetch uses.
let configSettled: Promise<void> = Promise.resolve();
let settleConfig: () => void = () => {};

vi.mock("../lib/oauth", () => ({
  peekOAuthConfig: () => fakeConfig,
  getOAuthConfig: async () => {
    await configSettled;
    listeners.forEach((l) => l(fakeConfig));
    return fakeConfig;
  },
  subscribeOAuthConfig: (listener: (config: OAuthConfig | null) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
}));

import { useSocialProviders } from "../hooks/useSocialProviders";

function config(google: boolean, github: boolean): OAuthConfig {
  return {
    googleEnabled: google,
    googleClientId: "google-client-id",
    googleRedirectUri: "http://localhost",
    gitHubEnabled: github,
    gitHubClientId: "github-client-id",
    gitHubRedirectUri: "http://localhost",
  };
}

describe("useSocialProviders", () => {
  beforeEach(() => {
    fakeConfig = null;
    listeners = [];
  });
  afterEach(cleanup);

  it("is not ready and offers nothing while the config is unknown", async () => {
    configSettled = new Promise<void>((resolve) => {
      settleConfig = resolve;
    });
    const { result } = renderHook(() => useSocialProviders());
    expect(result.current.ready).toBe(false);
    expect(result.current.any).toBe(false);
    expect(result.current.google).toBe(false);
    expect(result.current.github).toBe(false);
    // A failed config fetch notifies with null — that must stay "unknown",
    // so the divider stays hidden even after the round-trip resolves.
    fakeConfig = null;
    settleConfig();
    await waitFor(() => expect(listeners.length).toBeGreaterThan(0));
    expect(result.current.ready).toBe(false);
    expect(result.current.any).toBe(false);
  });

  it("reports any=false when both providers are disabled (fetch failed is also unknown)", async () => {
    fakeConfig = config(false, false);
    const { result } = renderHook(() => useSocialProviders());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.any).toBe(false);
  });

  it("reports any=true when a single provider is enabled", async () => {
    fakeConfig = config(false, true);
    const { result } = renderHook(() => useSocialProviders());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.github).toBe(true);
    expect(result.current.any).toBe(true);
  });
});
