import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { skillGraphAnimationProfile } from "./skill-graph-animation";

describe("skillGraphAnimationProfile", () => {
  it("uses a finite layout budget for the default graph", () => {
    expect(skillGraphAnimationProfile(false)).toEqual({
      warmupTicks: 24,
      cooldownTicks: 72,
      cooldownTime: 2_400,
    });
  });

  it("precomputes positions and stops immediately for reduced motion", () => {
    expect(skillGraphAnimationProfile(true)).toEqual({
      warmupTicks: 72,
      cooldownTicks: 0,
      cooldownTime: 0,
    });
  });

  it("never emits a non-finite force budget", () => {
    for (const reducedMotion of [false, true]) {
      for (const value of Object.values(
        skillGraphAnimationProfile(reducedMotion),
      )) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("keeps reheating out of hover and selection callbacks", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/skill-graph-force-canvas.tsx"),
      "utf8",
    );

    expect(source).not.toContain("cooldownTicks(Infinity)");
    expect(source).not.toContain("cooldownTime(Infinity)");
    expect(source).not.toContain("autoPauseRedraw(false)");
    expect(source.match(/\.d3ReheatSimulation\(\)/g)).toHaveLength(2);
  });
});
