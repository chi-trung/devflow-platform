import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards the two halves of the TeamReportCards memo pair: a stable prop into a
// non-memoised component is dead weight, and a memo over an unstable prop
// never holds. See sprintBoardStableProps / filterBarStableProps.

const COMPONENT = path.resolve(__dirname, "../components/reporting/TeamReportCards.tsx");
const PAGE = path.resolve(__dirname, "../pages/ReportsPage.tsx");

const component = fs.readFileSync(COMPONENT, "utf8");
const page = fs.readFileSync(PAGE, "utf8");

describe("TeamReportCards keeps both halves of its memo pair", () => {
  it("exports the component wrapped in memo exactly once", () => {
    const shape = component.match(/export const TeamReportCards = memo\(/g);
    expect(shape, "TeamReportCards must be exported as a memo() wrapper").toHaveLength(1);
    expect(component, "the bare non-memoised export must not remain").not.toMatch(
      /export function TeamReportCards\(/,
    );
  });

  it("does not scan the roster per row (useMemo Map lookup instead)", () => {
    expect(
      component,
      "the row map must resolve profiles through the memoised Map, not members.find()",
    ).not.toMatch(/members\.find\(/);
    expect(component, "the grouping memo must be present").toMatch(
      /const profilesByUserId = useMemo\(\(\) => \{[\s\S]{0,200}new Map/,
    );
    expect(component, "each row must be an O(1) Map lookup").toMatch(
      /profilesByUserId\.get\(member\.userId\)/,
    );
  });

  it("resolves the roster through a Map keyed on userId", () => {
    expect(component).toMatch(/map\.set\(member\.userId, member\)/);
  });
});

describe("ReportsPage hands TeamReportCards stable props", () => {
  it("renders TeamReportCards exactly once", () => {
    const sites = page.match(/<TeamReportCards[\s\S]*?\/>/g);
    expect(sites, "there must be exactly one render site").toHaveLength(1);
  });

  it("does not build a fresh members array at the render site", () => {
    expect(
      page,
      "`members ?? []` is a new array identity per render and churns the memo",
    ).not.toMatch(/<TeamReportCards[\s\S]*?members=\{members \?\? \[\]\}/);
    expect(page, "the empty roster must fall back to a module-level constant").toMatch(
      /members=\{members \?\? EMPTY_MEMBERS\}/,
    );
    expect(page, "EMPTY_MEMBERS must be a module-level constant, not an inline literal").toMatch(
      /const EMPTY_MEMBERS: WorkspaceMemberResponse\[\] = \[\];/,
    );
  });
});
