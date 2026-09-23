import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { RouteFallback } from "../App";

// RouteFallback picks spinner vs shell from (a) the auth status and (b)
// whether a refresh token is stored. Both are injected: useAuth reads a
// mutable bag, and lib/api's token getters are replaced so the "loading with
// a stored session" branch is reachable without a real localStorage JWT.
// Locking this matters because getting it backwards either blanks the whole
// viewport on every navigation (anonymous-style spinner for signed-in users)
// or paints app chrome at public first paint (landing visitors seeing a
// sidebar skeleton).
const { auth, stored } = vi.hoisted(() => ({
  auth: { status: "loading" as string },
  stored: { refresh: null as string | null, access: null as string | null },
}));

vi.mock("../auth/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => auth,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    tokens: {
      get access() {
        return stored.access;
      },
      get refresh() {
        return stored.refresh;
      },
      save(accessToken: string, refreshToken: string) {
        stored.access = accessToken;
        stored.refresh = refreshToken;
      },
      clear() {
        stored.access = null;
        stored.refresh = null;
      },
    },
  };
});

beforeEach(() => {
  auth.status = "loading";
  stored.access = null;
  stored.refresh = null;
  document.body.innerHTML = "";
});

const hasSpinner = () => document.querySelector(".animate-spin") !== null;
const hasShell = () => document.querySelector("header") !== null;

describe("RouteFallback", () => {
  it("shows the centered spinner for anonymous visitors", () => {
    auth.status = "anonymous";
    render(<RouteFallback />);
    expect(hasSpinner()).toBe(true);
    expect(hasShell()).toBe(false);
  });

  it("shows the spinner while loading with no stored session (public first paint)", () => {
    auth.status = "loading";
    stored.refresh = null;
    render(<RouteFallback />);
    expect(hasSpinner()).toBe(true);
    expect(hasShell()).toBe(false);
  });

  it("shows the shell skeleton while loading with a stored session", () => {
    auth.status = "loading";
    stored.refresh = "refresh-token";
    render(<RouteFallback />);
    expect(hasShell()).toBe(true);
    expect(hasSpinner()).toBe(false);
  });

  it("shows the shell skeleton for authenticated route swaps", () => {
    auth.status = "authenticated";
    render(<RouteFallback />);
    expect(hasShell()).toBe(true);
    expect(hasSpinner()).toBe(false);
  });

  it("exposes the skeleton to assistive tech as a labeled status", () => {
    auth.status = "authenticated";
    render(<RouteFallback />);
    const status = screen.getByRole("status");
    // useTranslation is mocked to return the raw key.
    expect(status.textContent).toContain("common.loading");
    // Placeholder blocks must stay silent — only the label is announced.
    expect(status.querySelectorAll("[aria-hidden]").length).toBeGreaterThan(0);
  });
});
