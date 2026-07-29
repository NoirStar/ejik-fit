import { describe, expect, it } from "vitest";

import { skillGraphPointerRadius } from "./skill-graph-touch";

describe("skillGraphPointerRadius", () => {
  it("keeps a 44px minimum touch target while the map is zoomed out", () => {
    expect(skillGraphPointerRadius(4, 1, true)).toBe(22);
    expect(skillGraphPointerRadius(4, 0.5, true)).toBe(44);
    expect(skillGraphPointerRadius(4, 0.25, true)).toBe(88);
  });

  it("keeps large nodes selectable beyond the minimum target", () => {
    expect(skillGraphPointerRadius(40, 2, true)).toBe(47);
  });

  it("uses the graph minimum zoom when scale data is unavailable", () => {
    expect(skillGraphPointerRadius(4, Number.NaN, true)).toBeCloseTo(
      22 / 0.18,
    );
  });
});
