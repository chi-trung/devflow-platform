import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards the notification-list pair: memo on the row + one stable handler at
// each render site + object reuse in the hook. Without all three, every row
// re-renders on the 60s poll and on every incoming-notification refetch.

const ITEM = path.resolve(__dirname, "../components/notifications/NotificationItem.tsx");
const PANEL = path.resolve(__dirname, "../components/notifications/NotificationsPanel.tsx");
const PAGE = path.resolve(__dirname, "../pages/NotificationsPage.tsx");
const HOOK = path.resolve(__dirname, "../hooks/useNotifications.ts");

describe("NotificationItem is exported as a memo() wrapper", () => {
  const source = fs.readFileSync(ITEM, "utf8");

  it("wraps the component in memo exactly once", () => {
    const shape = source.match(/export const NotificationItem = memo\(/g);
    expect(shape, "NotificationItem must be exported as a memo() wrapper").toHaveLength(1);
    expect(source, "the bare non-memoised export must not remain").not.toMatch(
      /export function NotificationItem\(/,
    );
  });

  it("takes the notification back from the row's click callback", () => {
    expect(source).toMatch(/onClick\?: \(notification: AppNotification\) => void/);
  });
});

describe("the render sites pass one stable handler", () => {
  it("NotificationsPanel passes the useCallback handler directly, no per-row arrow", () => {
    const source = fs.readFileSync(PANEL, "utf8");
    const sites = source.match(/<NotificationItem[\s\S]*?\/>/g);
    expect(sites, "one render site").toHaveLength(1);
    expect(sites![0]).toMatch(/onClick=\{handleItemClick\}/);
    expect(sites![0], "a fresh arrow per row defeats the memo").not.toMatch(/onClick=\{\(\)/);
    expect(source).toMatch(/const handleItemClick = useCallback\(/);
  });

  it("NotificationsPage passes the useCallback handler directly, no per-row arrow", () => {
    const source = fs.readFileSync(PAGE, "utf8");
    const sites = source.match(/<NotificationItem[\s\S]*?\/>/g);
    expect(sites, "one render site").toHaveLength(1);
    expect(sites![0]).toMatch(/onClick=\{openNotification\}/);
    expect(sites![0], "a fresh arrow per row defeats the memo").not.toMatch(/onClick=\{\(\)/);
    expect(source).toMatch(/const openNotification = useCallback\(/);
  });
});

describe("useNotifications reuses previous objects across a no-op poll", () => {
  const source = fs.readFileSync(HOOK, "utf8");

  it("compares items field-by-field and reuses the previous object", () => {
    expect(source).toMatch(/function shallowEqualNotification\(/);
    expect(source).toMatch(/const stableNotifications = useMemo\(/);
    expect(source).toMatch(/shallowEqualNotification\(old, n\)\) return old/);
  });
});
