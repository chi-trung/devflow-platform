import { describe, it, expect } from "vitest";
import {
  daysInMonth,
  dayKey,
  firstWeekdayOfMonth,
  isoBoundUtc,
  monthGrid,
  sameDay,
} from "../lib/calendarMonth";

describe("calendarMonth", () => {
  it("daysInMonth handles leap and non-leap years", () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 0)).toBe(31);
    expect(daysInMonth(2026, 11)).toBe(31);
  });

  it("firstWeekdayOfMonth is JS getDay order (0 = Sunday)", () => {
    // 2026-10-01 is a Thursday.
    expect(firstWeekdayOfMonth(2026, 9)).toBe(4);
    // 2026-09-01 is a Tuesday.
    expect(firstWeekdayOfMonth(2026, 8)).toBe(2);
  });

  it("monthGrid is always 42 cells starting Sunday of the leading week", () => {
    const grid = monthGrid(2026, 9);
    expect(grid).toHaveLength(42);
    // Oct 2026 starts Thursday → 4 leading days from September.
    expect(grid[0].outside).toBe(true);
    expect(grid[0].date.getMonth()).toBe(8);
    expect(grid[4].date.getMonth()).toBe(9);
    expect(grid[4].date.getDate()).toBe(1);
    expect(grid[4].outside).toBe(false);
  });

  it("monthGrid wraps December into January", () => {
    const grid = monthGrid(2026, 11);
    expect(grid).toHaveLength(42);
    const last = grid[grid.length - 1];
    expect(last.date.getMonth()).toBeLessThanOrEqual(0);
    expect(last.outside || last.date.getMonth() === 11).toBe(true);
  });

  it("dayKey is zero-padded local YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("sameDay ignores time-of-day", () => {
    const a = new Date(2026, 9, 1, 0, 0, 0);
    const b = new Date(2026, 9, 1, 23, 59, 59);
    const c = new Date(2026, 9, 2, 0, 0, 0);
    expect(sameDay(a, b)).toBe(true);
    expect(sameDay(a, c)).toBe(false);
  });

  it("isoBoundUtc exclusive end advances one local day", () => {
    const start = new Date(2026, 9, 1);
    const end = new Date(2026, 9, 31);
    const from = isoBoundUtc(start);
    const to = isoBoundUtc(end, true);
    expect(new Date(to).getTime()).toBeGreaterThan(new Date(from).getTime());
    // Span of Oct grid stays under the backend 400-day cap.
    const spanDays =
      (new Date(to).getTime() - new Date(from).getTime()) / (24 * 3600 * 1000);
    expect(spanDays).toBeLessThanOrEqual(400);
  });
});
