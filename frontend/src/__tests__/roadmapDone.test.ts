import { describe, it, expect } from "vitest";
import { ROADMAP_ITEMS } from "../data/changelog";

describe("roadmap recurring item", () => {
  it("is marked done after Calendar + Recurring shipped", () => {
    const recurring = ROADMAP_ITEMS.find((i) =>
      /recurring/i.test(i.title.en),
    );
    expect(recurring).toBeDefined();
    expect(recurring!.status).toBe("done");
  });
});
