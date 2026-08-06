import { describe, expect, it } from "vitest";

import { LEVELS, scoreExhibition } from "./game";

describe("campaign progression", () => {
  it("keeps the second investigation directly addressable", () => {
    expect(LEVELS[1].id).toBe("tidegate");
    expect(LEVELS[1].location).toBe("潮门避难站");
    expect(LEVELS[1].evidence.length).toBeGreaterThan(3);
  });

  it("routes the first exhibition to the second investigation", () => {
    const firstLevel = LEVELS[0];
    const evidence = firstLevel.evidence.slice(0, 2).map((item) => item.id);
    const outcome = scoreExhibition(firstLevel, "selective", evidence);

    expect(outcome.nextLead).toBe(LEVELS[1].location);
  });

  it("makes the second dive a selective salvage run", () => {
    const secondLevel = LEVELS[1];
    const totalWeight = secondLevel.evidence.reduce((sum, item) => sum + item.weight, 0);

    expect(totalWeight).toBeGreaterThan(secondLevel.maxCargo);
  });
});
