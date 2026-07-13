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

    expect(tokens).toContain("--color-accent: #17b77a");
    expect(tokens).toContain("--touch-target: 2.75rem");
    expect(typography).toContain("/fonts/PretendardVariable.woff2");
    expect(typography).toContain("font-display: swap");
  });
});
