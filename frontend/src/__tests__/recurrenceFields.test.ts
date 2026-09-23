import { describe, it, expect } from "vitest";
import {
  emptyRecurrenceDraft,
  firstDueIso,
  recurrenceFromRule,
} from "../components/calendar/RecurrenceFields";

describe("RecurrenceFields helpers", () => {
  it("emptyRecurrenceDraft is disabled with weekly / interval 1", () => {
    const d = emptyRecurrenceDraft("2026-10-01");
    expect(d).toEqual({
      enabled: false,
      frequency: "Weekly",
      interval: 1,
      firstDueDate: "2026-10-01",
    });
  });

  it("firstDueIso is null while disabled or empty", () => {
    expect(firstDueIso(emptyRecurrenceDraft("2026-10-01"))).toBeNull();
    expect(
      firstDueIso({
        enabled: true,
        frequency: "Daily",
        interval: 1,
        firstDueDate: "",
      }),
    ).toBeNull();
  });

  it("firstDueIso emits noon local → ISO", () => {
    const iso = firstDueIso({
      enabled: true,
      frequency: "Monthly",
      interval: 2,
      firstDueDate: "2026-10-15",
    });
    expect(iso).not.toBeNull();
    const d = new Date(iso!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(12);
  });

  it("recurrenceFromRule round-trips frequency / interval / local date", () => {
    const iso = firstDueIso({
      enabled: true,
      frequency: "Weekly",
      interval: 3,
      firstDueDate: "2026-11-20",
    })!;
    const draft = recurrenceFromRule({
      frequency: "Weekly",
      interval: 3,
      firstDueDateUtc: iso,
    });
    expect(draft.enabled).toBe(true);
    expect(draft.frequency).toBe("Weekly");
    expect(draft.interval).toBe(3);
    expect(draft.firstDueDate).toBe("2026-11-20");
  });
});
