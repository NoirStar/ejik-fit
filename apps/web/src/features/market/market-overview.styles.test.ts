import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "src/features/market/market-overview.module.css"),
  "utf8",
);

function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("market overview styles", () => {
  it("records the locked Hallmark workbench direction", () => {
    expect(css.trimStart()).toMatch(
      /^\/\* Hallmark · genre: modern-minimal · tone: Korean product workbench · anchor: violet oklch\(54\.36% 0\.2236 286\.27\) · macrostructure: Workbench · designed-as-app/,
    );
  });

  it("uses a compact service scale and a bounded 1280px canvas", () => {
    expect(rule(".page")).toContain("width: min(100%, 80rem);");
    expect(rule(".intro h1")).toContain("font-size: var(--type-page-title);");
    expect(css).toMatch(
      /\.sectionHeader h2,[\s\S]*?\.sideHeader h2\s*\{[^}]*font-size: 1rem;/,
    );
  });

  it("makes the explicit-demand chart the dominant visual", () => {
    expect(rule(".dashboardGrid")).toContain(
      "grid-template-columns: minmax(0, 1fr) 22rem;",
    );
    expect(rule(".dashboardGrid")).toContain("gap: 1.25rem;");
    expect(rule(".explicitDemandFill")).toContain(
      "transition: transform var(--dur-medium) var(--ease-out);",
    );
    expect(rule(".explicitDemandFill")).toContain("transform-origin: left center;");
    expect(rule('.explicitDemandFill > [data-segment="required"]')).toContain(
      "background: var(--market-required);",
    );
    expect(rule('.explicitDemandFill > [data-segment="preferred"]')).toContain(
      "background: var(--market-preferred);",
    );
    expect(css).not.toContain(".relativeDemand");
  });

  it("uses the coordinated blue, mint, cream and coral market palette", () => {
    expect(rule(".page")).toContain(
      "--market-required: var(--color-demand-required);",
    );
    expect(rule(".page")).toContain(
      "--market-required-text: var(--color-demand-required-ink);",
    );
    expect(rule(".page")).toContain(
      "--market-preferred: var(--color-demand-preferred);",
    );
    expect(rule(".page")).toContain(
      "--market-preferred-text: var(--color-demand-preferred-ink);",
    );
    expect(rule(".page")).toContain(
      "--market-unspecified: var(--color-demand-unspecified);",
    );
    expect(rule(".page")).toContain(
      "--market-relative: var(--color-demand-highlight);",
    );
    expect(rule('.explicitDemandFill > [data-segment="required"]')).toContain(
      "background: var(--market-required);",
    );
    expect(rule('.explicitDemandFill > [data-segment="preferred"]')).toContain(
      "background: var(--market-preferred);",
    );
    expect(css).not.toContain('[data-segment="unspecified"]');
  });

  it("avoids decorative gradients and heavy card shadows", () => {
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("radial-gradient");
    expect(css).not.toContain("box-shadow");
    expect(css).not.toMatch(/font-size:\s*(?:8px|0\.5625rem)/);
    expect(css).not.toMatch(/animation:\s*listFade\s+\d+ms\s+ease-out/);
  });

  it("moves the side rail below 1200px and turns filters into a mobile rail", () => {
    expect(css).toMatch(
      /@media \(max-width: 74\.9375rem\)[\s\S]*?\.dashboardGrid\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 52\.4375rem\)[\s\S]*?\.filters\s*\{[\s\S]*?flex-wrap: nowrap;[\s\S]*?overflow-x: auto;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 52\.4375rem\)[\s\S]*?\.sortControl select,[\s\S]*?\.trendAddControl select\s*\{[^}]*min-height: var\(--touch-target\);/,
    );
  });

  it("keeps the market snapshot compact before stacking chart, trend, and evidence", () => {
    expect(css).not.toContain(".summaryPanel");
    expect(css).toMatch(
      /@media \(max-width: 52\.4375rem\)[\s\S]*?\.pulsePanel\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 35\.9375rem\)[\s\S]*?\.skillSelect\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 35\.9375rem\)[\s\S]*?\.filterRow\s*\{[\s\S]*?grid-template-columns: 4\.75rem minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 35\.9375rem\)[\s\S]*?\.sectionHeader > div:first-child\s*\{[^}]*display: contents;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 35\.9375rem\)[\s\S]*?\.sectionHeader p\s*\{[^}]*grid-column: 1 \/ -1;/,
    );
  });

  it("keeps filter pills short and keyboard accessible", () => {
    expect(rule(".filter")).toContain("min-width: 0;");
    expect(rule(".filter")).toContain("min-height: 2rem;");
    expect(rule(".filter")).toContain("padding: 0 0.75rem;");
    expect(css).toMatch(
      /\.sideHeader > a\s*\{[^}]*min-width: var\(--touch-target\);/,
    );
    expect(css).toMatch(
      /\.sideHeader > a\s*\{[^}]*min-height: var\(--touch-target\);/,
    );
    expect(css).toContain(".filter:focus-visible");
    expect(rule(".trendAddControl select:disabled")).toContain(
      "cursor: not-allowed;",
    );
    expect(rule(".trendAddControl select:disabled")).toContain("opacity: 0.55;");
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]*?\.filter,[\s\S]*?\.sortControl select\s*\{[^}]*min-height: var\(--touch-target\);/,
    );
  });

  it("removes list and bar motion when reduced motion is requested", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.skillRow,[\s\S]*?\.explicitDemandFill,[\s\S]*?animation: none;[\s\S]*?transition: none;/,
    );
  });
});
