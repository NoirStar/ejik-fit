import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readStyle(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("saved library touch targets", () => {
  it("keeps short saved-item title and company links at 44 by 44 pixels", () => {
    const css = readStyle(
      "src/features/saved-library/saved-library.module.css",
    );
    const titleRule = Array.from(
      css.matchAll(/\.communityCard h3 a\s*\{([^}]*)\}/g),
      (match) => match[1],
    ).join("\n");
    const companyRule = Array.from(
      css.matchAll(/\.jobIdentity p a\s*\{([^}]*)\}/g),
      (match) => match[1],
    ).join("\n");

    for (const rule of [titleRule, companyRule]) {
      expect(rule).toContain("min-width: var(--touch-target);");
      expect(rule).toContain("min-height: var(--touch-target);");
    }
  });

  it("keeps home career shortcuts at the shared touch-target height", () => {
    const css = readStyle("src/features/home-feed/home-feed.module.css");
    const shortcutRule = css.match(/\.shortcutList a\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(shortcutRule).toContain("min-height: var(--touch-target);");
  });
});
