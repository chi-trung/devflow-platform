import { describe, it, expect } from "vitest";
import { ROADMAP_ITEMS, type RoadmapStatus } from "../data/changelog";
import en from "../i18n/en.json";
import vi from "../i18n/vi.json";

// Phase 5: recurring tasks flipped the first roadmap card to done; the
// union and the badge catalog must both accept it.

describe("roadmap done status", () => {
  it("RoadmapStatus accepts done", () => {
    const ok: RoadmapStatus = "done";
    expect(ok).toBe("done");
  });

  it("first roadmap item (recurring tasks) is done", () => {
    expect(ROADMAP_ITEMS[0]!.status).toBe("done");
  });

  it("every ROADMAP_ITEMS status has en + vi badge chrome", () => {
    const enStatus = (
      en as { changelog: { roadmapStatus: Record<string, string> } }
    ).changelog.roadmapStatus;
    const viStatus = (
      vi as { changelog: { roadmapStatus: Record<string, string> } }
    ).changelog.roadmapStatus;
    for (const item of ROADMAP_ITEMS) {
      expect(enStatus[item.status], `en missing ${item.status}`).toBeTruthy();
      expect(viStatus[item.status], `vi missing ${item.status}`).toBeTruthy();
    }
  });
});
