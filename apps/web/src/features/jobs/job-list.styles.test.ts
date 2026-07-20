import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "src/features/jobs/job-list.module.css"),
  "utf8",
);

describe("job list service density", () => {
  it("uses the shared page title scale and one divided result surface", () => {
    expect(css).toContain("font-size: var(--type-page-title)");
    expect(css).toMatch(
      /\.jobList\s*\{[\s\S]*?border: 1px solid var\(--color-line\)/,
    );
    expect(css).not.toContain("transform: translateY(-1px)");
  });

  it("keeps mobile job facts in two compact columns", () => {
    expect(css).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.facts\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });

  it("keeps the company and title as a compact text stack", () => {
    expect(css).toMatch(
      /\.identity\s*\{[^}]*gap: 0\.125rem;/,
    );
    expect(css).toMatch(
      /\.identity h3 a\s*\{[^}]*line-height: 1\.35;/,
    );
    expect(css).not.toMatch(
      /\.identity h3 a\s*\{[^}]*min-height:/,
    );
    expect(css).not.toMatch(
      /\.identity \.companyLink\s*\{[^}]*min-height:/,
    );
    expect(css).toMatch(
      /\.saveButton\s*\{[^}]*min-height: var\(--touch-target\);/,
    );
  });
});
