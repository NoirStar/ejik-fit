import { describe, expect, it } from "vitest";

import { skillGraphDomainAnchor } from "./skill-graph-domain-layout";


describe("skillGraphDomainAnchor", () => {
  it("places related ecosystems in stable, distinct regions", () => {
    const frontend = skillGraphDomainAnchor("frontend", 200);
    const backend = skillGraphDomainAnchor("backend", 200);
    const robotics = skillGraphDomainAnchor("robotics", 200);

    expect(frontend.x).toBeLessThan(0);
    expect(backend.x).toBeGreaterThan(0);
    expect(robotics.y).toBeGreaterThan(frontend.y);
    expect(skillGraphDomainAnchor("frontend", 200)).toEqual(frontend);
  });

  it("keeps unknown domains deterministic and inside the requested spread", () => {
    const first = skillGraphDomainAnchor("quantum_tooling", 180);
    const second = skillGraphDomainAnchor("quantum_tooling", 180);

    expect(second).toEqual(first);
    expect(Math.abs(first.x)).toBeLessThanOrEqual(180);
    expect(Math.abs(first.y)).toBeLessThanOrEqual(180);
  });
});
