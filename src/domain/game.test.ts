import { describe, expect, it } from "vitest";

import { canCurate, scoreExhibition } from "./game";

describe("curation rules", () => {
  it("requires two independent artifacts", () => {
    expect(canCurate([])).toBe(false);
    expect(canCurate(["pass", "pass"])).toBe(false);
    expect(canCurate(["pass", "ration"])).toBe(true);
  });

  it("rewards a complete critical evidence chain", () => {
    const outcome = scoreExhibition("selective", ["pass", "ration", "log"]);

    expect(outcome.reputation).toBe(4);
    expect(outcome.income).toBe(128);
  });

  it("keeps the safer official narrative commercially stronger", () => {
    const safe = scoreExhibition("orderly", ["pass", "ration", "log"]);
    const critical = scoreExhibition("selective", ["pass", "ration", "log"]);

    expect(safe.income).toBeGreaterThan(critical.income);
    expect(safe.reputation).toBeLessThan(critical.reputation);
  });
});
