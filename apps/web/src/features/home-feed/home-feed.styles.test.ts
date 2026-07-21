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
      "grid-template-columns: 12rem minmax(0, 1fr) 15.75rem;",
    );
    expect(rule("layout")).toContain(
      "width: min(calc(100% - 3rem), var(--content-max));",
    );
    expect(css).not.toContain("radial-gradient");
  });

  it("groups rails and feed items into quiet divided surfaces", () => {
    expect(css).toMatch(/\.leftRail,\s*\.rightRail\s*\{[^}]*overflow: hidden;/);
    expect(rule("feedList")).toContain("gap: 0;");
    expect(rule("feedList")).toContain("overflow: hidden;");
    expect(css).toMatch(
      /\.socialCard,\s*\.jobCard,\s*\.marketCard\s*\{[^}]*border: 0;[^}]*border-bottom:/,
    );
  });

  it("keeps editorial item type and tabs restrained", () => {
    expect(css).toMatch(
      /\.cardCopy h2,\s*\.jobIdentity h2,\s*\.marketBody h2\s*\{[^}]*font-size: var\(--type-item-title\);/,
    );
    expect(css).toMatch(
      /\.tabs button\[data-active="true"\]\s*\{[^}]*background: transparent;[^}]*color: var\(--color-accent-strong\);/,
    );
  });

  it("keeps tag links compact-looking without shrinking their touch target", () => {
    expect(rule("tags a")).toContain("min-height: var(--touch-target);");
    expect(css).toMatch(/\.tags a::before\s*\{[^}]*inset: 0\.5rem 0;/);
  });

  it("keeps feed actions at the shared touch target", () => {
    expect(css).toMatch(
      /\.cardActions button,\s*\.cardActions a,\s*\.jobActions button,\s*\.jobActions a\s*\{[^}]*min-height: var\(--touch-target\);/,
    );
  });

  it("keeps the home job company and title in one compact text stack", () => {
    expect(css).toMatch(
      /\.jobIdentity > div\s*\{[^}]*gap: 0\.125rem;/,
    );
    expect(rule("jobIdentity p")).toContain("margin: 0;");
    expect(rule("companyLink")).not.toContain("min-height:");
    expect(rule("companyLink")).not.toContain("min-width:");
    expect(rule("companyLink")).toContain("line-height: 1.35;");
  });

  it("separates official jobs without a side stripe or nested card frame", () => {
    expect(rule("jobCard")).toContain("border-left: 0;");
    expect(rule("jobCard")).toContain("border-radius: 0;");
    expect(rule("jobCard")).toContain("margin: 0;");
    expect(rule("stackPrompt")).toContain("background: transparent;");
  });
});
