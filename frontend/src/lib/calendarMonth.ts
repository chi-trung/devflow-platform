// Pure month-grid math for the project calendar — no date-fns / fullcalendar.
// Dates are handled as local calendar days (year, monthIndex, day) so month
// boundaries never drift across timezones; only the API bounds are ISO UTC.

export interface CalendarDay {
  /** Local calendar day this cell represents. */
  date: Date;
  /** True when the cell is outside the visible month (leading/trailing). */
  outside: boolean;
}

/** Days in a given month (monthIndex is 0-based). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** 0 = Sunday … 6 = Saturday — JS Date.getDay() order for the grid header. */
export function firstWeekdayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

/**
 * Six-row (42-cell) month grid starting Sunday. Leading/trailing cells
 * belong to the adjacent months so every week is a full 7 days.
 */
export function monthGrid(year: number, monthIndex: number): CalendarDay[] {
  const first = firstWeekdayOfMonth(year, monthIndex);
  const total = daysInMonth(year, monthIndex);
  const cells: CalendarDay[] = [];

  // Leading days from the previous month.
  const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
  const prevYear = monthIndex === 0 ? year - 1 : year;
  const prevTotal = daysInMonth(prevYear, prevMonth);
  for (let i = first; i > 0; i--) {
    cells.push({
      date: new Date(prevYear, prevMonth, prevTotal - i + 1),
      outside: true,
    });
  }

  for (let day = 1; day <= total; day++) {
    cells.push({ date: new Date(year, monthIndex, day), outside: false });
  }

  // Trailing days so the grid is always 42 cells (6 × 7).
  const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(nextYear, nextMonth, nextDay++), outside: true });
  }

  return cells;
}

/** Local `YYYY-MM-DD` key — matches how MonthGrid buckets tasks by day. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Exclusive end bound for the calendar query: start of the day after the
 * last grid cell (covers leading/trailing weeks so off-month chips load too).
 */
export function isoBoundUtc(date: Date, endOfDayExclusive = false): string {
  const d = new Date(date);
  if (endOfDayExclusive) {
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString();
}
