import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("design system foundation", () => {
  it("defines the approved light service tokens and local Korean font", () => {
    const tokens = read("src/styles/tokens.css");
    const typography = read("src/styles/typography.css");
    const globals = read("src/app/globals.css");

    for (const token of [
      "--color-bg: #f7f7fa",
      "--color-surface: #ffffff",
      "--color-text: #17171c",
      "--color-muted: #62626d",
      "--color-faint: #71717b",
      "--color-line: #e7e7ec",
      "--color-accent: #6d4be8",
      "--header-height-desktop: 4rem",
      "--header-height-mobile: 3.5rem",
      "--content-max: 80rem",
      "--type-page-title: 2rem",
      "--type-detail-title: 2.125rem",
      "--type-item-title: 1.0625rem",
      "--type-body: 0.9375rem",
      "--type-meta: 0.8125rem",
      "--layer-header: 30",
      "--layer-popover: 40",
    ]) {
      expect(tokens).toContain(token);
    }

    expect(tokens).toContain("--touch-target: 2.75rem");
    expect(tokens).not.toContain("@media (prefers-color-scheme: dark)");
    expect(typography).toContain("/fonts/PretendardVariable.woff2");
    expect(typography).toContain("font-display: swap");
    expect(typography).toContain(
      '--font-korean: "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
    );
    expect(globals).not.toContain("@media (prefers-color-scheme: dark)");
  });

  it("keeps Pretendard as the computed body family instead of Geist", () => {
    const globals = read("src/app/globals.css");
    const bodyRule = globals.match(/body\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(bodyRule).toContain("font-family: var(--font-korean);");
    expect(bodyRule).toContain("font-size: var(--type-body);");
    expect(bodyRule).not.toContain("var(--font-geist)");
  });

  it("keeps one authoritative global root and body rule", () => {
    const globals = read("src/app/globals.css");

    expect(globals).not.toContain("color-scheme: light dark");
    expect(globals.match(/^:root\s*\{/gm)).toHaveLength(1);
    expect(globals.match(/^\s*body\s*\{/gm)).toHaveLength(1);
  });

  it("lets the home layout use the full application canvas", () => {
    const home = read("src/features/home-feed/home-feed.module.css");
    const pageRule = home.match(/\.page\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(pageRule).toContain("width: 100%;");
    expect(pageRule).toContain("max-width: none;");
    expect(pageRule).toContain("margin: 0;");
  });

  it("keeps an expandable global search on mobile", () => {
    const shell = read("src/components/app-shell/app-shell.module.css");

    expect(shell).not.toContain(".searchForm,\n  .desktopNav {\n    display: none;");
    expect(shell).toContain(".searchForm:focus-within {\n    position: absolute;");
    expect(shell).not.toContain("width: 2.625rem;");
  });

  it("keeps the Korean wordmark visible without the retired symbol", () => {
    const globals = read("src/app/globals.css");

    expect(globals).toContain(".brand-lockup__asset");
    expect(globals).not.toContain(".brand-lockup__ink");
    expect(globals).not.toContain(".brand-lockup__accent");
    expect(globals).not.toContain(".brand-lockup__mark");
    expect(globals).not.toContain(".brand-lockup__copy");
    expect(globals).not.toContain("@media (max-width: 340px)");
  });

  it("uses compact title tokens across service pages", () => {
    for (const path of [
      "src/features/saved-library/saved-library.module.css",
      "src/features/authored-questions/authored-questions.module.css",
      "src/features/search/search-results.module.css",
      "src/components/skill-graph-experience.module.css",
      "src/app/trust-pages.module.css",
    ]) {
      expect(read(path), path).toContain("font-size: var(--type-page-title);");
    }

    for (const path of [
      "src/features/companies/company-profile.module.css",
      "src/app/posts/[id]/post-detail.module.css",
    ]) {
      expect(read(path), path).toContain("font-size: var(--type-detail-title);");
    }
  });
});
