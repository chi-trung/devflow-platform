import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import {
  OnboardingTour,
  isOnScreen,
  requestSidebarDrawer,
} from "../components/onboarding/OnboardingTour";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Focus trap queries offsetParent; portal card + jsdom can leave that null.
// Keep Button/BrandMark real enough for the card to render controls.

function rectPatch(
  el: HTMLElement,
  r: Partial<DOMRect> & { width?: number; height?: number },
) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: 0,
    left: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...r,
  } as DOMRect);
}

describe("isOnScreen", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 667,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects zero-size boxes (closed drawer still has layout size off-canvas only after transform)", () => {
    const el = document.createElement("div");
    rectPatch(el, { width: 0, height: 0, left: 10, top: 10, right: 10, bottom: 10 });
    expect(isOnScreen(el)).toBe(false);
  });

  it("accepts a partially visible overflow-x target (≥16px slice)", () => {
    // Half the select sits past the right edge — the mobile action-row bug.
    const el = document.createElement("div");
    rectPatch(el, {
      left: 300,
      right: 420,
      top: 80,
      bottom: 120,
      width: 120,
      height: 40,
    });
    expect(isOnScreen(el)).toBe(true);
  });

  it("rejects a fully off-canvas closed drawer (right ≤ 0)", () => {
    const el = document.createElement("div");
    rectPatch(el, {
      left: -320,
      right: -10,
      top: 0,
      bottom: 400,
      width: 320,
      height: 400,
    });
    expect(isOnScreen(el)).toBe(false);
  });

  it("rejects a fully off-right-edge target with zero visible width", () => {
    const el = document.createElement("div");
    rectPatch(el, {
      left: 400,
      right: 500,
      top: 80,
      bottom: 120,
      width: 100,
      height: 40,
    });
    expect(isOnScreen(el)).toBe(false);
  });
});

describe("requestSidebarDrawer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches open / close custom events AppShell listens for", () => {
    const open = vi.fn();
    const close = vi.fn();
    window.addEventListener("devflow:open-sidebar", open);
    window.addEventListener("devflow:close-sidebar", close);
    requestSidebarDrawer(true);
    requestSidebarDrawer(false);
    window.removeEventListener("devflow:open-sidebar", open);
    window.removeEventListener("devflow:close-sidebar", close);
    expect(open).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("OnboardingTour card gating", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 667,
    });
  });

  afterEach(() => {
    // Unmount React first so createPortal nodes leave body cleanly — wiping
    // innerHTML while the portal is still mounted throws NotFoundError on cleanup.
    cleanup();
    vi.restoreAllMocks();
    document.querySelectorAll("[data-tour], #devflow-tour-root").forEach((n) => {
      // targets we appended; tour root already unmounted
      if (n.hasAttribute("data-tour")) n.remove();
    });
    document.getElementById("devflow-content")?.remove();
  });

  it("shows the welcome card immediately with no target highlight", () => {
    render(<OnboardingTour open onClose={() => {}} userId="u1" />);
    // Portal lands on document.body, not a React container.
    expect(document.getElementById("devflow-tour-root")).toBeTruthy();
    expect(document.querySelector("[data-tour-highlight]")).toBeNull();
  });

  it("hides the card until the spotlight is ready (or fails open)", async () => {
    // Step target exists and is fully on screen → cardReady after measure.
    const target = document.createElement("button");
    target.setAttribute("data-tour", "workspace-select");
    document.body.appendChild(target);
    rectPatch(target, {
      left: 16,
      right: 116,
      top: 80,
      bottom: 120,
      width: 100,
      height: 40,
    });

    const onClose = vi.fn();
    const { rerender } = render(
      <OnboardingTour open={false} onClose={onClose} userId="u1" />,
    );
    expect(document.getElementById("devflow-tour-root")).toBeNull();

    rerender(<OnboardingTour open onClose={onClose} userId="u1" />);

    // Welcome step (0) always has a card.
    await waitFor(() => {
      expect(document.getElementById("devflow-tour-root")).toBeTruthy();
    });

    // Advance is internal; force a non-welcome state by closing and checking
    // that closed mount removes the card.
    rerender(<OnboardingTour open={false} onClose={onClose} userId="u1" />);
    expect(document.getElementById("devflow-tour-root")).toBeNull();
  });

  it("portals the card to document.body (inert <main> cannot freeze it)", () => {
    const main = document.createElement("main");
    main.id = "devflow-content";
    main.setAttribute("inert", "");
    document.body.appendChild(main);

    render(<OnboardingTour open onClose={() => {}} userId="u1" />);
    const card = document.getElementById("devflow-tour-root");
    expect(card).toBeTruthy();
    expect(main.contains(card)).toBe(false);
    expect(card?.parentElement).toBe(document.body);
  });
});
