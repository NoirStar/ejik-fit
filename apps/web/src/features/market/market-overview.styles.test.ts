import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("market overview styles", () => {
  it("keeps every skill-map link at the shared touch target size", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/features/market/market-overview.module.css"),
      "utf8",
    );
    const skillLinkRule = css.match(/\.skillLink\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(skillLinkRule).toContain("display: inline-flex;");
    expect(skillLinkRule).toContain("min-width: var(--touch-target);");
    expect(skillLinkRule).toContain("min-height: var(--touch-target);");
    expect(skillLinkRule).toContain("align-items: center;");
  });

  it("keeps short category filters at the shared touch target size", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/features/market/market-overview.module.css"),
      "utf8",
    );
    const filterRule = css.match(/\.filter\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(filterRule).toContain("min-width: var(--touch-target);");
    expect(filterRule).toContain("min-height: var(--touch-target);");
  });
});
