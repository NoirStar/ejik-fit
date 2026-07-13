import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("design system foundation", () => {
  it("defines the shared semantic tokens and local Korean font", () => {
    const tokens = read("src/styles/tokens.css");
    const typography = read("src/styles/typography.css");

    expect(tokens).toContain("--color-bg: #f6f7f9");
    expect(tokens).toContain("--color-surface: #ffffff");
    expect(tokens).toContain("--color-text: #16181d");
    expect(tokens).toContain("--color-muted: #667085");
    expect(tokens).toContain("--color-line: #e5e7eb");
    expect(tokens).toContain("--color-accent: #7657f6");
    expect(tokens).toContain("--header-height-desktop: 7rem");
    expect(tokens).toContain("--touch-target: 2.75rem");
    expect(tokens).not.toContain("@media (prefers-color-scheme: dark)");
    expect(typography).toContain("/fonts/PretendardVariable.woff2");
    expect(typography).toContain("font-display: swap");
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

  it("keeps the header brand legible on narrow mobile screens", () => {
    const shell = read("src/components/app-shell/app-shell.module.css");
    const globals = read("src/app/globals.css");
    const brandRule = shell.match(/\.brand\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(brandRule).toContain("flex: 0 0 auto;");
    expect(globals).toContain(
      ".brand-lockup__copy strong,\n.brand-lockup__copy small",
    );
    expect(globals).toContain("white-space: nowrap;");
    expect(globals).toContain("@media (max-width: 380px)");
    expect(globals).toContain(".brand-lockup--sm .brand-lockup__copy small");
    expect(globals).toContain("@media (max-width: 340px)");
    expect(globals).toContain(".brand-lockup--sm .brand-lockup__copy {");
  });
});
