import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "src/features/home-feed/home-feed.module.css"),
  "utf8",
);

function rule(selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("home feed density", () => {
  it("uses the approved compact three-column service canvas", () => {
    expect(rule("layout")).toContain(
      "grid-template-columns: 13.5rem minmax(0, 1fr) 17.5rem;",
    );
    expect(rule("layout")).toContain(
      "width: min(calc(100% - 3rem), var(--content-max));",
    );
    expect(css).not.toContain("radial-gradient");
  });

  it("groups rails and feed items into quiet divided surfaces", () => {
    expect(css).toMatch(/\.leftRail,\s*\.rightRail\s*\{[^}]*overflow: hidden;/s);
    expect(rule("feedList")).toContain("gap: 0;");
    expect(rule("feedList")).toContain("overflow: hidden;");
    expect(css).toMatch(
      /\.socialCard,\s*\.jobCard,\s*\.marketCard\s*\{[^}]*border: 0;[^}]*border-bottom:/s,
    );
  });

  it("keeps editorial item type and tabs restrained", () => {
    expect(css).toMatch(
      /\.cardCopy h2,\s*\.jobIdentity h2,\s*\.marketBody h2\s*\{[^}]*font-size: var\(--type-item-title\);/s,
    );
    expect(css).toMatch(
      /\.tabs button\[data-active="true"\]\s*\{[^}]*background: transparent;[^}]*color: var\(--color-accent-strong\);/s,
    );
  });
});
