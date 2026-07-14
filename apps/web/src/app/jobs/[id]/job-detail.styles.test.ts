import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const detailCss = readFileSync(
  resolve(process.cwd(), "src/app/jobs/[id]/job-detail.module.css"),
  "utf8",
);
const actionCss = readFileSync(
  resolve(process.cwd(), "src/features/jobs/job-detail-actions.module.css"),
  "utf8",
);

describe("job detail service density", () => {
  it("caps and safely wraps the posting title", () => {
    expect(detailCss).toContain("font-size: var(--type-detail-title)");
    expect(detailCss).toContain("word-break: keep-all");
  });

  it("reserves mobile space for the fixed action bar above navigation", () => {
    expect(actionCss).toMatch(
      /@media \(max-width: 839px\)[\s\S]*?\.primaryActions\s*\{[\s\S]*?position: fixed/,
    );
    expect(actionCss).toContain(
      "bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom))",
    );
    expect(detailCss).toContain(
      "calc(var(--mobile-nav-height) + 5.5rem + env(safe-area-inset-bottom))",
    );
  });
});
