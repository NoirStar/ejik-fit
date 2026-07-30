import { describe, expect, it } from "vitest";

import { visibilityAt } from "./skill-graph-visibility-transition";

describe("visibilityAt", () => {
  const transition = { from: 0, to: 1, startedAt: 100, duration: 220 };

  it("starts at the old value and ends at the target", () => {
    expect(visibilityAt(transition, 100, false)).toBe(0);
    expect(visibilityAt(transition, 320, false)).toBe(1);
  });

  it("moves monotonically and finishes immediately for reduced motion", () => {
    const early = visibilityAt(transition, 140, false);
    const late = visibilityAt(transition, 220, false);

    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
    expect(visibilityAt(transition, 100, true)).toBe(1);
  });
});
