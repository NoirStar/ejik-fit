import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";


describe("daily dashboard layout CSS", () => {
  it("keeps dashboard main areas outside the global centered main width", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const globalMainRuleIndex = css.indexOf(".site-header__inner,\nmain,\n.site-footer");
    const dashboardOverrideIndex = css.lastIndexOf("main.daily-dashboard-page main.daily-main");

    expect(globalMainRuleIndex).toBeGreaterThan(-1);
    expect(dashboardOverrideIndex).toBeGreaterThan(globalMainRuleIndex);
    expect(css).toContain("#main-content:has(.daily-dashboard-page),");
    expect(css).toContain("main.daily-dashboard-page .daily-shell");
  });
});
