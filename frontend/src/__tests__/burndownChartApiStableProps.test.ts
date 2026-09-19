import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards the two halves of the BurndownChartApi memo pair. Here the prop half
// is already stable by construction (`data` is the useApi response object, and
// the site passes nothing else), so the memo wrapper is the whole fix. See
// teamReportCardsStableProps / sprintBoardStableProps.

const COMPONENT = path.resolve(__dirname, "../components/reporting/BurndownChartApi.tsx");
const PAGE = path.resolve(__dirname, "../pages/ReportsPage.tsx");

const component = fs.readFileSync(COMPONENT, "utf8");
const page = fs.readFileSync(PAGE, "utf8");

describe("BurndownChartApi keeps both halves of its memo pair", () => {
  it("exports the component wrapped in memo exactly once", () => {
    const shape = component.match(/export const BurndownChartApi = memo\(/g);
    expect(shape, "BurndownChartApi must be exported as a memo() wrapper").toHaveLength(1);
    expect(component, "the bare non-memoised export must not remain").not.toMatch(
      /export function BurndownChartApi\(/,
    );
  });
});

describe("ReportsPage hands BurndownChartApi a stable prop", () => {
  it("renders BurndownChartApi exactly once", () => {
    const sites = page.match(/<BurndownChartApi[\s\S]*?\/>/g);
    expect(sites, "there must be exactly one render site").toHaveLength(1);
  });

  it("passes only the response object, no inline array or object literal", () => {
    expect(
      page,
      "the site must not build a fresh object or array identity per render",
    ).toMatch(/<BurndownChartApi\s+data=\{burndown\}\s*\/>/);
  });
});
