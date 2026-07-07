import { describe, expect, it } from "vitest";

import {
  LARGE_GRAPH_FIXTURE_SIZES,
  buildLargeSkillGraphViewFixture,
} from "./large-graph-fixture";


describe("large graph fixtures", () => {
  it("defines the production-scale fixture sizes from the graph plan", () => {
    expect(LARGE_GRAPH_FIXTURE_SIZES).toEqual([5_000, 20_000, 50_000]);
  });

  it("builds a deterministic graph view with communities and bridge links", () => {
    const fixture = buildLargeSkillGraphViewFixture({
      nodeCount: 120,
      communitySize: 30,
    });

    expect(fixture.nodes).toHaveLength(120);
    expect(fixture.stats).toMatchObject({
      skillCount: 120,
      evidenceCount: 0,
      linkCount: fixture.links.length,
    });
    expect(fixture.domains.length).toBeGreaterThan(1);
    expect(fixture.nodes[0]).toMatchObject({
      id: "skill:0",
      category: "domain-hub",
      owned: true,
      seed: true,
    });
    expect(fixture.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ring:0" }),
        expect.objectContaining({ id: "community:31" }),
        expect.objectContaining({ id: "bridge:3" }),
      ]),
    );
  });
});
