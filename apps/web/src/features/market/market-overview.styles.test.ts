import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "src/features/market/market-overview.module.css"),
  "utf8",
);

describe("market overview styles", () => {
  it("uses the shared service title scale", () => {
    const titleRule = css.match(/\.title\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(titleRule).toContain("font-size: var(--type-page-title);");
  });

  it("keeps metrics compact and filters to one row on mobile", () => {
    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.metrics\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.filters\s*\{[\s\S]*?flex-wrap: nowrap;[\s\S]*?overflow-x: auto;/,
    );
  });

  it("keeps every skill-map link at the shared touch target size", () => {
    const skillLinkRule = css.match(/\.skillLink\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(skillLinkRule).toContain("display: inline-flex;");
    expect(skillLinkRule).toContain("min-width: var(--touch-target);");
    expect(skillLinkRule).toContain("min-height: var(--touch-target);");
    expect(skillLinkRule).toContain("align-items: center;");
  });

  it("keeps short category filters at the shared touch target size", () => {
    const filterRule = css.match(/\.filter\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(filterRule).toContain("min-width: var(--touch-target);");
    expect(filterRule).toContain("min-height: var(--touch-target);");
  });
});
