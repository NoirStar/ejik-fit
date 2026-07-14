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
  it("uses a compact service scale and a bounded 1280px canvas", () => {
    expect(rule(".page")).toContain("width: min(100%, 80rem);");
    expect(rule(".intro h1")).toContain(
      "font-size: clamp(1.75rem, 2.4vw, 2rem);",
    );
    expect(css).toMatch(
      /\.sectionHeader h2,[\s\S]*?\.combinationHeader h2\s*\{[^}]*font-size: 1rem;/,
    );
  });

  it("keeps the desktop hierarchy at an 800px-ish main and 352px side panel", () => {
    expect(rule(".dashboardGrid")).toContain(
      "grid-template-columns: minmax(0, 1fr) 22rem;",
    );
    expect(rule(".dashboardGrid")).toContain("gap: 1.25rem;");
  });

  it("uses restrained semantic colors for required, preferred and uncategorized demand", () => {
    expect(rule('.stackedSegment[data-segment="required"]')).toContain(
      "background: #6d4aff;",
    );
    expect(rule('.stackedSegment[data-segment="preferred"]')).toContain(
      "background: #2f9e63;",
    );
    expect(rule('.stackedSegment[data-segment="unspecified"]')).toContain(
      "background: #d9dce4;",
    );
  });

  it("avoids decorative gradients and heavy card shadows", () => {
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("radial-gradient");
    expect(css).not.toContain("box-shadow");
  });

  it("moves the side rail below 1200px and turns filters into a mobile rail", () => {
    expect(css).toMatch(
      /@media \(max-width: 74\.9375rem\)[\s\S]*?\.dashboardGrid\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 52\.4375rem\)[\s\S]*?\.filters\s*\{[\s\S]*?flex-wrap: nowrap;[\s\S]*?overflow-x: auto;/,
    );
  });

  it("keeps compact filters keyboard and touch accessible", () => {
    expect(rule(".filter")).toContain("min-width: var(--touch-target);");
    expect(rule(".filter")).toContain("min-height: var(--touch-target);");
    expect(css).toMatch(
      /\.sideHeader > a\s*\{[^}]*min-width: var\(--touch-target\);/,
    );
    expect(css).toMatch(
      /\.sideHeader > a\s*\{[^}]*min-height: var\(--touch-target\);/,
    );
    expect(css).toContain(".filter:focus-visible");
  });

  it("removes list and bar motion when reduced motion is requested", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.skillRow,[\s\S]*?\.stackedSegment,[\s\S]*?animation: none;[\s\S]*?transition: none;/,
    );
  });
});
