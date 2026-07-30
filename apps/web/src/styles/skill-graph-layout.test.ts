import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("skill graph layout CSS", () => {
  it("fits the skill graph below the shared application header", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const graphCss = readFileSync(
      resolve(
        process.cwd(),
        "src/components/skill-graph-atlas.module.css",
      ),
      "utf8",
    );
    const searchCss = readFileSync(
      resolve(
        process.cwd(),
        "src/components/skill-graph-search.module.css",
      ),
      "utf8",
    );
    const shellCss = readFileSync(
      resolve(process.cwd(), "src/components/app-shell/app-shell.module.css"),
      "utf8",
    );

    expect(graphCss).toMatch(/\.page\s*\{[\s\S]*?height: 100%;/);
    const titleRule = graphCss.match(/\.titleLine h1\s*\{([^}]*)\}/)?.[1];
    expect(titleRule).toContain("overflow-wrap: anywhere;");
    expect(graphCss).toMatch(/\.graphFrame\s*\{[\s\S]*?min-height: 38rem;/);
    expect(graphCss).toMatch(
      /\.graphFrame\s*\{[\s\S]*?background-color: var\(--color-graph\);/,
    );
    expect(graphCss).not.toContain("background: #07111d;");
    expect(graphCss).toContain("@media (max-width: 48rem)");
    expect(graphCss).toMatch(
      /data-touch-interaction="disabled"[\s\S]*?touch-action: pan-y;/,
    );
    expect(graphCss).toMatch(
      /data-touch-interaction="enabled"[\s\S]*?touch-action: none;/,
    );
    expect(graphCss).toMatch(
      /\.float-tooltip-kap[\s\S]*?background: var\(--color-text\);/,
    );
    expect(graphCss).toMatch(
      /\.float-tooltip-kap\[style\*="display: inline"\][\s\S]*?animation-delay: 900ms;/,
    );
    expect(graphCss).not.toMatch(
      /(?:padding(?:-[\w-]+)?|gap|margin(?:-[\w-]+)?):[^;]*(?:0\.125|0\.15|0\.1875|0\.2|0\.35|0\.375|0\.4|0\.625|0\.7|0\.875|2\.35)rem/,
    );
    expect(graphCss).toContain(".toolbarMenuTrigger:active");
    expect(graphCss).toContain("@keyframes skillGraphMenuReveal");
    expect(graphCss).toContain("@keyframes skillGraphMetricSwap");
    expect(graphCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform: none;/,
    );
    expect(searchCss).not.toMatch(
      /(?:padding(?:-[\w-]+)?|gap|margin(?:-[\w-]+)?):[^;]*(?:0\.125|0\.15|0\.1875|0\.2|0\.35|0\.375|0\.4|0\.625|0\.7|0\.875|2\.35)rem/,
    );
    expect(searchCss).toContain(".results li:active");
    expect(css).toContain(".force-canvas__surface");
    expect(css).not.toContain("transition: opacity 520ms ease;");
    expect(css).toContain(
      "transition: opacity var(--dur-short) var(--ease-out);",
    );
    expect(css).toMatch(
      /\.graph-empty-state__constellation\s*\{[\s\S]*?background: var\(--color-graph\);/,
    );
    expect(css).toMatch(
      /\.graph-empty-state strong\s*\{[\s\S]*?color: var\(--color-text\);/,
    );
    expect(css).not.toContain("#080b12");
    expect(css).not.toContain("filter: saturate(1.05) contrast(1.04);");
    expect(css).toMatch(
      /@media \(pointer: coarse\)[\s\S]*?touch-action: pan-y;/,
    );
    expect(css).not.toMatch(
      /@media \(pointer: coarse\)[\s\S]*?touch-action: none;/,
    );
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
