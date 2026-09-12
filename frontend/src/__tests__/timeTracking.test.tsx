// Regression tests for the two silent-drift bugs in TimeTrackingSection:
// F4 — the timer counted setInterval ticks instead of wall-clock seconds, so
//      hidden-tab throttling (~1 tick/min) silently under-recorded minutes.
// F5 — the estimate label printed STORY POINTS through formatMinutes, so a
//      3-point task rendered as "est. 3m" — indistinguishable from minutes.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TimeTrackingSection } from "../components/board/TimeTrackingSection";
import type { TaskItemResponse } from "../types/api";
import type { TimeEntryResponse } from "../types/api";

vi.mock("../lib/api", () => ({
  deleteTimeEntry: vi.fn(() => Promise.resolve()),
  getTimeEntries: vi.fn(() => Promise.resolve<TimeEntryResponse[]>([])),
  logTimeEntry: vi.fn(() => Promise.resolve("entry-1")),
  setTaskEstimation: vi.fn(() => Promise.resolve()),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: () => {} }),
}));

// Real en catalog through a real i18next instance, so an interpolation
// parameter renamed at the call site (or in the JSON) surfaces as a missing
// "{{placeholder}}" — exactly the drift i18n-usage can't see.
vi.mock("react-i18next", async () => {
  const i18next = await import("i18next");
  const en = (await import("../i18n/en.json")).default;
  const instance = i18next.createInstance();
  await instance.init({
    resources: { en: { translation: en } },
    lng: "en",
    fallbackLng: "en",
  });
  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) =>
        instance.t(key, options) as string,
    }),
  };
});

function renderSection(task: Partial<TaskItemResponse> = {}) {
  return render(
    <TimeTrackingSection
      workspaceId="ws1"
      projectId="p1"
      task={{ id: "t1", title: "Drift", storyPoints: null, ...task } as TaskItemResponse}
      members={[]}
      onChanged={() => {}}
    />,
  );
}

describe("timer tracks wall clock (F4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recomputes elapsed from Date.now after throttled ticks, not tick count", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: /^Start$/ }));

    // Hidden-tab simulation: 5 minutes of wall clock pass while the interval
    // fires only once (throttled). Tick-counting would read 00:00:01.
    // (Vitest fake timers also advance the mocked Date on
    // advanceTimersByTime, hence the 1s past the set time.)
    vi.setSystemTime(new Date("2026-09-12T09:05:00Z"));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole("button", { name: /00:05:01/ })).toBeInTheDocument();
  });

  it("derives saved minutes from the wall clock when the timer stops", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: /^Start$/ }));

    // One hour of real time, interval never gets a chance to catch up.
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    const stopButton = screen.getByRole("button", { name: /^\d\d:\d\d:\d\d$/ });
    fireEvent.click(stopButton);

    // Old tick-counting code left the form at 0h01m (Math.max(1, round(0/60))).
    expect(screen.getByLabelText("Hours spent")).toHaveValue(1);
    expect(screen.getByLabelText("Minutes spent")).toHaveValue(0);
  });
});

describe("estimate label uses points, not minutes (F5)", () => {
  it("renders story points with the points parameter, no minute formatting", async () => {
    renderSection({ storyPoints: 3 });

    // Pre-fix this printed "· est. 3m" (formatMinutes on story points).
    expect(await screen.findByText(/· est\. 3 pts/)).toBeInTheDocument();
  });

  it("keeps en and vi catalogs interpolating the same {{points}} parameter", async () => {
    const en = (await import("../i18n/en.json")).default;
    const viCatalog = (await import("../i18n/vi.json")).default;
    const enTemplate = ((en as unknown) as { timeTracking: { estPrefix: string } }).timeTracking.estPrefix;
    const viTemplate = ((viCatalog as unknown) as { timeTracking: { estPrefix: string } }).timeTracking.estPrefix;

    expect(enTemplate).toContain("{{points}}");
    expect(viTemplate).toContain("{{points}}");
    expect(enTemplate).not.toContain("{{time}}");
    expect(viTemplate).not.toContain("{{time}}");
  });
});
