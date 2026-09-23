import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { AiDock } from "../components/ai/AiDock";

// Contract for the right-edge AI dock (replaces the old bottom-right FAB):
//  - closed by default (localStorage absent → false)
//  - edge tab always rendered with aria-expanded/controls/label
//  - toggling flips aria-expanded and persists to devflow.aiPanelOpen
//  - the panel node stays mounted (translate-x slide, not mount/unmount)
//  - no AiFloatingButton / FAB markup anywhere in the shell path

// Stable `t` identity — a fresh function each render is fine here (no load
// effect keyed on it) but keep it stable so focus/persist assertions don't
// race a re-render.
const tMock = (k: string) => k;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: tMock }),
}));

vi.mock("../components/ai/AiAssistantPanel", () => ({
  AiAssistantPanel: ({
    open,
    variant,
  }: {
    open: boolean;
    variant?: string;
  }) => (
    <div data-testid="assistant-panel" data-open={String(open)} data-variant={variant}>
      <textarea aria-label="composer" />
    </div>
  ),
}));

import { AiAssistantPanel } from "../components/ai/AiAssistantPanel";

function renderDock() {
  return render(
    <AiDock
      workspaceId="w1"
      projectId="p1"
      context="board"
      onTaskChanged={() => {}}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("AiDock edge tab", () => {
  it("starts closed with the edge tab visible and aria-expanded=false", () => {
    renderDock();
    const tab = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(tab).toBeTruthy();
    expect(tab.getAttribute("aria-expanded")).toBe("false");
    expect(tab.getAttribute("aria-controls")).toBe("ai-dock-panel");
    // Panel node is mounted even while closed (slide, not unmount).
    expect(screen.getByTestId("assistant-panel")).toBeTruthy();
    expect(screen.getByTestId("assistant-panel").dataset.open).toBe("false");
  });

  it("opens on click, flips aria-expanded, and focuses the composer", async () => {
    renderDock();
    const tab = screen.getByRole("button", { name: "ai.assistantOpen" });
    fireEvent.click(tab);
    const openTab = screen.getByRole("button", { name: "ai.assistantClose" });
    expect(openTab.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("assistant-panel").dataset.open).toBe("true");
    expect(screen.getByTestId("assistant-panel").dataset.variant).toBe("dock");
    // Focus lands in the composer via rAF.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(screen.getByLabelText("composer"));
  });

  it("persists open state to localStorage and restores on remount", () => {
    const { unmount } = renderDock();
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    expect(localStorage.getItem("devflow.aiPanelOpen")).toBe("1");
    unmount();

    renderDock();
    const tab = screen.getByRole("button", { name: "ai.assistantClose" });
    expect(tab.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on second click and returns focus to the tab", () => {
    renderDock();
    const tab = screen.getByRole("button", { name: "ai.assistantOpen" });
    fireEvent.click(tab);
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantClose" }));
    const closed = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(closed.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(closed);
    expect(localStorage.getItem("devflow.aiPanelOpen")).toBe("0");
    // Still mounted — exit is a translate, not an unmount.
    expect(screen.getByTestId("assistant-panel").dataset.open).toBe("false");
  });

  it("closes on Escape when focus is outside a text field", () => {
    renderDock();
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    // Focus the tab (a button) so Escape is not swallowed by a field.
    screen.getByRole("button", { name: "ai.assistantClose" }).focus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "ai.assistantOpen" }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("keeps the panel open on Escape inside a textarea (blurs only)", () => {
    renderDock();
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    const composer = screen.getByLabelText("composer");
    composer.focus();
    fireEvent.keyDown(composer, { key: "Escape" });
    // First Escape blurs the field; panel stays open.
    expect(
      screen.getByRole("button", { name: "ai.assistantClose" }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(document.activeElement).not.toBe(composer);
  });
});

describe("AiDock replaces the FAB", () => {
  it("does not import or render AiFloatingButton", async () => {
    const shell = await import("../components/AppShell");
    expect(shell.AppShell).toBeTruthy();
    // Source-level: the FAB file is gone and AppShell mounts AiDock.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appShell = readFileSync(
      join(__dirname, "..", "components", "AppShell.tsx"),
      "utf8",
    );
    expect(appShell).not.toMatch(/AiFloatingButton/);
    expect(appShell).toMatch(/<AiDock\b/);
    let fabGone = false;
    try {
      readFileSync(
        join(__dirname, "..", "components", "ai", "AiFloatingButton.tsx"),
      );
    } catch {
      fabGone = true;
    }
    expect(fabGone, "AiFloatingButton.tsx should be deleted").toBe(true);
  });
});

// Guard the panel's variant contract: dock mode must NOT early-return null
// when open=false (that would snap the slide instead of animating it).
describe("AiAssistantPanel dock variant", () => {
  it("keeps the node mounted for variant=dock even when open=false", async () => {
    // Import the real module (not the mock above) via a fresh path is hard
    // in one file — assert via source instead (same file the mock shadows).
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(__dirname, "..", "components", "ai", "AiAssistantPanel.tsx"),
      "utf8",
    );
    expect(src).toMatch(/variant === "floating" && !open/);
    expect(src).toMatch(/variant\?: "floating" \| "dock"/);
    // Ternary may wrap across lines — don't require `?` on the same line.
    expect(src).toMatch(/variant === "dock"\s*\n?\s*\?/);
  });
});

// Keep the unused import referenced so vitest doesn't tree-shake the mock
// module shape assertion above (and so TS noUnusedLocals stays happy if the
// mock is ever removed).
void AiAssistantPanel;
