import { describe, expect, it } from "vitest";

import { LEVELS, canCurate, scoreExhibition } from "./game";

const firstLevel = LEVELS[0];
const secondLevel = LEVELS[1];

describe("campaign and curation rules", () => {
  it("ships two distinct playable investigations", () => {
    expect(LEVELS).toHaveLength(2);
    expect(firstLevel.id).toBe("salt-route");
    expect(secondLevel.id).toBe("tidegate");
    expect(secondLevel.dive.gate).toBeDefined();
    expect(secondLevel.dive.vents.length).toBeGreaterThan(0);
  });

  it("requires two independent artifacts from the active level", () => {
    const [first, second] = firstLevel.evidence;

    expect(canCurate(firstLevel, [])).toBe(false);
    expect(canCurate(firstLevel, [first.id, first.id])).toBe(false);
    expect(canCurate(firstLevel, [first.id, second.id])).toBe(true);
    expect(canCurate(firstLevel, [secondLevel.evidence[0].id, secondLevel.evidence[1].id])).toBe(false);
  });

  it("keeps the safer first exhibition commercially stronger", () => {
    const allEvidence = firstLevel.evidence.map((item) => item.id);
    const safe = scoreExhibition(firstLevel, "orderly", allEvidence);
    const critical = scoreExhibition(firstLevel, "selective", allEvidence);

    expect(safe.income).toBeGreaterThan(critical.income);
    expect(safe.reputation).toBeLessThan(critical.reputation);
  });

  it("forces a meaningful cargo choice in the second level", () => {
    const totalWeight = secondLevel.evidence.reduce((sum, item) => sum + item.weight, 0);

    expect(secondLevel.evidence).toHaveLength(4);
    expect(totalWeight).toBeGreaterThan(secondLevel.maxCargo);
  });

  it("rewards the complete containment interpretation", () => {
    const allEvidence = secondLevel.evidence.map((item) => item.id);
    const outcome = scoreExhibition(secondLevel, "containment", allEvidence);

    expect(outcome.reputation).toBe(6);
    expect(outcome.nextLead).toBe("深渊脉冲源");
  });
});
