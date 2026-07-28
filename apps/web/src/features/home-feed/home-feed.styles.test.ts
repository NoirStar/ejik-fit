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
  it("uses the approved action-oriented two-column service canvas", () => {
    expect(rule("layout")).toContain(
      "grid-template-columns: minmax(0, 1fr) 17.5rem;",
    );
    expect(rule("layout")).toContain(
      "width: min(calc(100% - 3rem), 67rem);",
    );
    expect(css).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.rightRail\s*\{[^}]*order: 2;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.feedColumn\s*\{[^}]*order: 3;/,
    );
    expect(css).not.toContain("radial-gradient");
  });

  it("groups the market rail and feed items into quiet divided surfaces", () => {
    expect(rule("rightRail")).toContain("overflow: hidden;");
    expect(css).not.toMatch(/\.leftRail\s*\{/);
    expect(rule("feedList")).toContain("gap: 0;");
    expect(rule("feedList")).toContain("overflow: hidden;");
    expect(css).toMatch(
      /\.socialCard,\s*\.jobCard,\s*\.marketCard\s*\{[^}]*border: 0;[^}]*border-bottom:/,
    );
  });

  it("skips off-screen card layout while reserving a stable height", () => {
    expect(css).toMatch(
      /\.socialCard,\s*\.jobCard,\s*\.marketCard\s*\{[^}]*content-visibility: auto;[^}]*contain-intrinsic-size: auto 15rem;/,
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

  it("keeps social actions and compact job tools at the shared touch target", () => {
    expect(css).toMatch(
      /\.cardActions button,\s*\.cardActions a\s*\{[^}]*min-height: var\(--touch-target\);/,
    );
    expect(rule("jobTool")).toContain("min-width: var(--touch-target);");
    expect(rule("jobTool")).toContain("min-height: var(--touch-target);");
    expect(css).not.toMatch(/\.jobActions\s*\{/);
  });

  it("makes the job content one clear internal-detail destination", () => {
    expect(css).toMatch(
      /\.jobIdentity > div\s*\{[^}]*gap: 0\.125rem;/,
    );
    expect(rule("jobIdentity p")).toContain("margin: 0;");
    expect(rule("jobMainLink")).toContain("display: grid;");
    expect(rule("jobMainLink")).toContain("text-decoration: none;");
    expect(css).not.toMatch(/\.companyLink\s*\{/);
  });

  it("separates official job groups without repeated onboarding prompts", () => {
    expect(rule("jobCluster")).toContain("background:");
    expect(rule("jobCard")).toContain("border-left: 0;");
    expect(rule("jobCard")).toContain("border-radius: 0;");
    expect(rule("jobCard")).toContain("margin: 0;");
    expect(css).not.toMatch(/\.stackPrompt\s*\{/);
  });

  it("keeps the mobile market preview short enough to reach the feed", () => {
    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.skillDemand li:nth-child\(n \+ 4\)\s*\{[^}]*display: none;/,
    );
  });
});
