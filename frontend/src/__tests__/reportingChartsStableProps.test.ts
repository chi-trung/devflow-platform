import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards the memo wrappers on the three remaining reporting charts. The prop
// half is stable by construction at every site (only `data={...}`, a useApi
// response object), so the wrappers are the whole fix. See
// burndownChartApiStableProps / teamReportCardsStableProps.

const CHARTS = ["VelocityChart", "VelocityTrendChart", "CycleLeadTimeChart"];
const DIR = path.resolve(__dirname, "../components/reporting");
const PAGE = path.resolve(__dirname, "../pages/ReportsPage.tsx");
const page = fs.readFileSync(PAGE, "utf8");

describe("the reporting charts export memoised components", () => {
  for (const name of CHARTS) {
    const source = fs.readFileSync(path.resolve(DIR, `${name}.tsx`), "utf8");

    it(`${name} is wrapped in memo exactly once`, () => {
      const shape = source.match(new RegExp(`export const ${name} = memo\\(`, "g"));
      expect(shape, `${name} must be exported as a memo() wrapper`).toHaveLength(1);
      expect(source, "the bare non-memoised export must not remain").not.toMatch(
        new RegExp(`export function ${name}\\(`),
      );
    });
  }
});

describe("ReportsPage hands each chart a stable prop", () => {
  for (const name of CHARTS) {
    it(`renders ${name} exactly once, passing only the response object`, () => {
      const sites = page.match(new RegExp(`<${name}[\\s\\S]*?/>`, "g"));
      expect(sites, `${name} must have exactly one render site`).toHaveLength(1);
      expect(
        sites![0],
        "the site must not build a fresh object or array identity per render",
      ).toMatch(new RegExp(`<${name}\\s+data=\\{\\w+\\}\\s*/>`));
    });
  }
});
