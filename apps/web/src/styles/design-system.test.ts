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
});
