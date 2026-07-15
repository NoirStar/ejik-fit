import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("skill graph layout CSS", () => {
  it("fits the skill graph below the shared application header", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const graphCss = readFileSync(
      resolve(
        process.cwd(),
        "src/components/skill-graph-experience.module.css",
      ),
      "utf8",
    );
    const shellCss = readFileSync(
      resolve(process.cwd(), "src/components/app-shell/app-shell.module.css"),
      "utf8",
    );

    expect(graphCss).toMatch(/\.page\s*\{[\s\S]*?height: 100%;/);
    expect(graphCss).toMatch(/\.graphFrame\s*\{[\s\S]*?min-height: 31rem;/);
    expect(graphCss).toMatch(
      /\.graphFrame\s*\{[\s\S]*?background: var\(--color-graph\);/,
    );
    expect(graphCss).not.toContain("background: #07111d;");
    expect(graphCss).toContain("@media (max-width: 640px)");
    expect(shellCss).toContain('.content[data-immersive="true"] > :first-child');
    expect(shellCss).toContain("flex: none;");
    expect(shellCss).toContain('.content[data-immersive="true"] .footer');
    expect(css).not.toContain("dashboard-app-page");
    expect(css).not.toContain("ti-app-shell");
  });

  it("does not retain styles for the removed daily dashboard", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).not.toContain("daily-dashboard-page");
    expect(css).not.toContain("daily-shell");
    expect(css).not.toContain("fit-job-row");
    expect(css).not.toContain("job-inspector");
  });
});
