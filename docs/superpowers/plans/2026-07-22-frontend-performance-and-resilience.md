# Frontend Performance and Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Reduce cold-page transfer, speculative navigation traffic, market JavaScript, and public API latency while preserving the current UX and strict privacy boundaries.

**Architecture:** Keep the current Next.js server/client component boundaries. Replace monolithic browser assets with immutable on-demand assets, constrain automatic prefetching to the global navigation, and route every backend call through an explicit freshness policy plus timeout. Production Playwright budgets guard the behavior that unit tests cannot observe.

**Tech Stack:** Next.js 16.2.10, React 19.2, TypeScript 5.8, Vitest 3.2, Playwright 1.61.1, Pretendard 1.3.9, Simple Icons 16.26.

## Global Constraints

- Preserve the current Pretendard family, typography weights, and page layout.
- Keep cold font transfer at or below 450 KB on \`/\` and \`/market\`, including the subset stylesheet.
- Reduce \`/market\` cold JavaScript transfer to at most 275 KB.
- Limit automatic RSC prefetch requests after initial load to at most 15 on \`/\` and \`/market\`.
- Keep primary navigation client-side and immediately usable.
- Cache ordinary public GET data for 60 seconds and explicitly durable catalog data for 300 seconds.
- Never cache personalized POST requests or authenticated browser data.
- Fail a stalled upstream request within 8 seconds and retain existing partial/error rendering.
- Do not introduce a system-font replacement, retry framework, service worker, React Compiler rollout, or database query change.
- Preserve all pre-existing dirty files in the main worktree; stage only files named by each task.

---

## File Structure

- \`apps/web/scripts/sync-pretendard-subsets.mjs\`: reproducibly downloads the pinned font stylesheet and 92 slices.
- \`apps/web/public/fonts/pretendard/\`: committed immutable font subset assets.
- \`apps/web/e2e/performance-budget.e2e.ts\`: production-only cold-load budgets.
- \`apps/web/playwright.performance.config.ts\`: production server configuration for the performance suite.
- \`apps/web/scripts/sync-technology-icons.mjs\`: copies pinned Simple Icons SVGs and emits a small asset manifest.
- \`apps/web/src/features/market/technology-icon-assets.ts\`: normalized technology-name aliases only.
- \`apps/web/src/features/market/technology-icon-assets.generated.ts\`: generated asset URL and color metadata without SVG paths.
- \`apps/web/src/lib/api-request.ts\`: request policies, timeout composition, and typed transport errors.
- \`apps/web/src/lib/api.ts\`: endpoint-specific policy selection and response normalization.

---

### Task 1: Self-host the Pretendard Dynamic Subset

**Files:**
- Create: \`apps/web/scripts/sync-pretendard-subsets.mjs\`
- Create: \`apps/web/public/fonts/SOURCES.md\`
- Create: \`apps/web/public/fonts/pretendard/pretendardvariable-dynamic-subset.min.css\`
- Create: \`apps/web/public/fonts/pretendard/PretendardVariable.subset.0.woff2\` through \`PretendardVariable.subset.91.woff2\`
- Create: \`apps/web/playwright.performance.config.ts\`
- Create: \`apps/web/e2e/performance-budget.e2e.ts\`
- Modify: \`apps/web/src/styles/design-system.test.ts\`
- Modify: \`apps/web/src/styles/typography.css\`
- Modify: \`apps/web/src/app/layout.tsx\`
- Modify: \`apps/web/package.json\`
- Delete: \`apps/web/public/fonts/PretendardVariable.woff2\`

**Interfaces:**
- Produces: \`/fonts/pretendard/pretendardvariable-dynamic-subset.min.css\` and 92 same-origin WOFF2 assets.
- Produces: \`npm run test:performance\`, which requires an existing production build.
- Consumes: pinned upstream Pretendard 1.3.9 assets and the existing \`--font-korean\` token.

- [ ] **Step 1: Write the failing font asset contract**

Replace the monolithic font assertions in \`src/styles/design-system.test.ts\` and add filesystem assertions:

\`\`\`ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

// Keep the other existing design-system tests unchanged.
it("uses the pinned self-hosted Pretendard variable dynamic subset", () => {
  const layout = read("src/app/layout.tsx");
  const typography = read("src/styles/typography.css");
  const subsetStylesheet = resolve(
    process.cwd(),
    "public/fonts/pretendard/pretendardvariable-dynamic-subset.min.css",
  );
  expect(existsSync(subsetStylesheet)).toBe(true);
  const subsetCss = read(
    "public/fonts/pretendard/pretendardvariable-dynamic-subset.min.css",
  );
  const slices = readdirSync(
    resolve(process.cwd(), "public/fonts/pretendard"),
  ).filter((name) => /^PretendardVariable\.subset\.\d+\.woff2$/.test(name));

  expect(layout).toContain(
    'href="/fonts/pretendard/pretendardvariable-dynamic-subset.min.css"',
  );
  expect(typography).not.toContain("/fonts/PretendardVariable.woff2");
  expect(typography).toContain(
    '--font-korean: "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
  );
  expect(subsetCss.match(/@font-face/g)).toHaveLength(92);
  expect(subsetCss).toContain(
    "url(./PretendardVariable.subset.91.woff2)",
  );
  expect(slices).toHaveLength(92);
});
\`\`\`

- [ ] **Step 2: Run the focused test and verify RED**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/styles/design-system.test.ts
\`\`\`

Expected: FAIL because the subset stylesheet existence assertion receives \`false\`.

- [ ] **Step 3: Add the deterministic font synchronization script**

Create \`apps/web/scripts/sync-pretendard-subsets.mjs\`:

\`\`\`js
import {
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PRETENDARD_VERSION = "1.3.9";
const SLICE_COUNT = 92;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(
  webRoot,
  "public",
  "fonts",
  "pretendard",
);
const cdnRoot =
  \`https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v\${PRETENDARD_VERSION}\`;
const cssUrl =
  \`\${cdnRoot}/dist/web/variable/pretendardvariable-dynamic-subset.min.css\`;
const sliceRoot =
  \`\${cdnRoot}/packages/pretendard/dist/web/variable/woff2-dynamic-subset\`;

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(\`Failed to download \${url}: \${response.status}\`);
  }
  return Buffer.from(await response.arrayBuffer());
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const upstreamCss = (await download(cssUrl)).toString("utf8");
const localCss = upstreamCss.replaceAll(
  "../../../packages/pretendard/dist/web/variable/woff2-dynamic-subset/",
  "./",
);
if ((localCss.match(/@font-face/g) ?? []).length !== SLICE_COUNT) {
  throw new Error("Unexpected Pretendard subset rule count");
}
await writeFile(
  path.join(outputDirectory, "pretendardvariable-dynamic-subset.min.css"),
  localCss,
);

await Promise.all(
  Array.from({ length: SLICE_COUNT }, async (_, index) => {
    const fileName = \`PretendardVariable.subset.\${index}.woff2\`;
    const body = await download(\`\${sliceRoot}/\${fileName}\`);
    if (body.byteLength < 1_000) {
      throw new Error(\`Pretendard slice is unexpectedly small: \${fileName}\`);
    }
    await writeFile(path.join(outputDirectory, fileName), body);
  }),
);
\`\`\`

Add the package script:

\`\`\`json
{
  "scripts": {
    "assets:fonts": "node scripts/sync-pretendard-subsets.mjs"
  }
}
\`\`\`

Preserve every existing script in \`package.json\`.

- [ ] **Step 4: Generate and document the pinned assets**

Run:

\`\`\`bash
cd apps/web
npm run assets:fonts
\`\`\`

Create \`apps/web/public/fonts/SOURCES.md\`:

\`\`\`md
# Font sources

## Pretendard Variable 1.3.9

- Project: https://github.com/orioncactus/pretendard
- Pinned release assets: https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/
- Local stylesheet: \`pretendard/pretendardvariable-dynamic-subset.min.css\`
- Local slices: \`pretendard/PretendardVariable.subset.0.woff2\` through \`PretendardVariable.subset.91.woff2\`
- License: SIL Open Font License 1.1; see \`OFL.txt\`

The assets are committed and served from the application origin. Run
\`npm run assets:fonts\` only when intentionally refreshing the pinned copy.
\`\`\`

- [ ] **Step 5: Switch the layout to the subset stylesheet**

Remove the \`@font-face\` rule from \`src/styles/typography.css\` but keep its token definitions:

\`\`\`css
:root {
  --font-korean: "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  --font-body: var(--font-korean);
  --font-display: var(--font-korean);
  --font-numeric: var(--font-korean);
}

[data-numeric] {
  font-family: var(--font-numeric);
  font-variant-numeric: tabular-nums;
}
\`\`\`

Add the stylesheet before \`<body>\` in \`src/app/layout.tsx\`:

\`\`\`tsx
<html data-scroll-behavior="smooth" lang="ko">
  <head>
    <link
      href="/fonts/pretendard/pretendardvariable-dynamic-subset.min.css"
      rel="stylesheet"
    />
  </head>
  <body className={geist.variable}>
    <a className="skip-link" href="#main-content">
      본문으로 건너뛰기
    </a>
    <div id="main-content">
      <AppShell>{children}</AppShell>
    </div>
  </body>
</html>
\`\`\`

Delete only \`apps/web/public/fonts/PretendardVariable.woff2\`; it remains recoverable from Git history.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/styles/design-system.test.ts
\`\`\`

Expected: all design-system tests PASS.

- [ ] **Step 7: Add the production performance harness and failing font budget**

Create \`apps/web/playwright.performance.config.ts\`:

\`\`\`ts
import { defineConfig } from "@playwright/test";

process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1", "localhost"]
  .filter(Boolean)
  .join(",");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "performance-budget.e2e.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3103",
    browserName: "chromium",
  },
  webServer: [
    {
      command: "node e2e/fixtures/test-api.mjs",
      url: "http://127.0.0.1:8011/api/postings",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "API_BASE_URL=http://127.0.0.1:8011 npm run start -- --hostname 127.0.0.1 --port 3103",
      url: "http://127.0.0.1:3103/privacy",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
\`\`\`

Create \`apps/web/e2e/performance-budget.e2e.ts\`:

\`\`\`ts
import { expect, test } from "@playwright/test";

type ResourceMetric = {
  name: string;
  transferSize: number;
};

async function coldResources(page: import("@playwright/test").Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  return page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        name: resource.name,
        transferSize: resource.transferSize,
      };
    }),
  ) as Promise<ResourceMetric[]>;
}

for (const route of ["/", "/market"]) {
  test(\`\${route} keeps the self-hosted font within budget\`, async ({ page }) => {
    const resources = await coldResources(page, route);
    const fontBytes = resources
      .filter(({ name }) => {
        const pathname = new URL(name).pathname;
        return pathname.includes("/fonts/pretendard/") ||
          pathname.endsWith(".woff2");
      })
      .reduce((total, resource) => total + resource.transferSize, 0);

    expect(fontBytes).toBeGreaterThan(0);
    expect(fontBytes).toBeLessThanOrEqual(450 * 1024);
    expect(
      await page.evaluate(() =>
        document.fonts.check('400 16px "Pretendard Variable"'),
      ),
    ).toBe(true);
  });
}
\`\`\`

Add this package script without running a second build inside it:

\`\`\`json
{
  "scripts": {
    "test:performance": "playwright test --config=playwright.performance.config.ts"
  }
}
\`\`\`

- [ ] **Step 8: Build and run the font budget**

Run:

\`\`\`bash
cd apps/web
npm run build
npm run test:performance
\`\`\`

Expected: two font-budget tests PASS and each reports at most 450 KB if a failure prints the received byte count.

- [ ] **Step 9: Commit the font optimization**

\`\`\`bash
git add apps/web/package.json apps/web/src/app/layout.tsx apps/web/src/styles/typography.css apps/web/src/styles/design-system.test.ts apps/web/scripts/sync-pretendard-subsets.mjs apps/web/public/fonts apps/web/playwright.performance.config.ts apps/web/e2e/performance-budget.e2e.ts
git commit -m "perf: subset the Korean web font"
\`\`\`

---

### Task 2: Stop Low-value Viewport Prefetches

**Files:**
- Modify: \`apps/web/e2e/performance-budget.e2e.ts\`
- Modify: \`apps/web/src/features/home-feed/home-feed.tsx\`
- Modify: \`apps/web/src/features/home-feed/following-post-list.tsx\`
- Modify: \`apps/web/src/features/home-feed/recent-topic-list.tsx\`
- Modify: \`apps/web/src/features/market/market-filters.tsx\`
- Modify: \`apps/web/src/features/market/technology-demand-chart.tsx\`
- Modify: \`apps/web/src/features/market/selected-technology-evidence.tsx\`
- Modify: \`apps/web/src/features/market/technology-trend-panel.tsx\`
- Modify: \`apps/web/src/features/jobs/job-list.tsx\`
- Modify: \`apps/web/src/features/jobs/job-detail-view.tsx\`
- Modify: \`apps/web/src/features/companies/company-profile.tsx\`
- Modify: \`apps/web/src/components/job-card.tsx\`

**Interfaces:**
- Produces: at most 15 automatic \`?_rsc=\` requests on cold \`/\` and \`/market\` loads.
- Consumes: ordinary \`next/link\` behavior; global navigation in \`AppShell\` remains unchanged.

- [ ] **Step 1: Add a failing production RSC request budget**

Extend \`performance-budget.e2e.ts\`:

\`\`\`ts
for (const route of ["/", "/market"]) {
  test(\`\${route} avoids speculative RSC request floods\`, async ({ page }) => {
    const prefetchedRsc: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.searchParams.has("_rsc")) {
        prefetchedRsc.push(\`\${url.pathname}?\${url.searchParams}\`);
      }
    });

    await page.goto(route);
    await page.waitForLoadState("networkidle");

    expect(
      prefetchedRsc.length,
      prefetchedRsc.join("\n"),
    ).toBeLessThanOrEqual(15);
  });
}
\`\`\`

- [ ] **Step 2: Build and verify RED**

Run:

\`\`\`bash
cd apps/web
npm run build
npm run test:performance -- --grep "RSC request floods"
\`\`\`

Expected: FAIL with approximately 50 RSC requests on \`/\` and 55 on \`/market\`.

- [ ] **Step 3: Disable prefetch on repeated home and market links**

For every repeated or secondary \`Link\` in the files named above, add the literal prop:

\`\`\`tsx
<Link href={item.href} prefetch={false}>
  {item.title}
</Link>
\`\`\`

For links with multiple props, preserve all existing behavior and add only \`prefetch={false}\`:

\`\`\`tsx
<Link
  aria-current={category === filter.value ? "page" : undefined}
  className={styles.filter}
  href={buildMarketFilterHref(careerType, filter.value)}
  key={filter.value || "all"}
  onClick={(event) =>
    navigateFilter(
      event,
      buildMarketFilterHref(careerType, filter.value),
    )
  }
  prefetch={false}
  scroll={false}
>
  {filter.value ? filter.label : "전체"}
</Link>
\`\`\`

Apply the same literal prop to:

- both links to each community post;
- community tag-search links;
- company links and job-detail links inside repeated feed/job/company lists;
- market category and career filters;
- each market technology-to-jobs row action;
- selected technology evidence job and skill-map links;
- job skill chips and pagination links;
- methodology/data-policy links rendered below data lists.

Do not add the prop to \`NAV_ITEMS\` in \`app-shell.tsx\`, the global search form, or action links rendered only inside error/empty states.

- [ ] **Step 4: Run focused component tests**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/features/home-feed/home-feed.test.tsx src/features/market/market-overview.test.tsx src/features/jobs/job-list.test.tsx src/features/companies/company-profile.test.tsx
\`\`\`

Expected: all focused behavior tests PASS with unchanged hrefs and navigation semantics.

- [ ] **Step 5: Build and verify GREEN**

Run:

\`\`\`bash
cd apps/web
npm run build
npm run test:performance -- --grep "RSC request floods"
\`\`\`

Expected: both routes PASS at 15 or fewer automatic RSC requests.

- [ ] **Step 6: Commit the prefetch policy**

\`\`\`bash
git add apps/web/e2e/performance-budget.e2e.ts apps/web/src/components/job-card.tsx apps/web/src/features/home-feed apps/web/src/features/market apps/web/src/features/jobs/job-list.tsx apps/web/src/features/jobs/job-detail-view.tsx apps/web/src/features/companies/company-profile.tsx
git commit -m "perf: constrain speculative route prefetch"
\`\`\`

Before committing, inspect \`git diff --cached --name-only\` and unstage any market file unrelated to prefetch.

---

### Task 3: Serve Technology Logos as On-demand Static Assets

**Files:**
- Create: \`apps/web/scripts/sync-technology-icons.mjs\`
- Create: \`apps/web/src/features/market/technology-icon-assets.ts\`
- Create: \`apps/web/src/features/market/technology-icon-assets.generated.ts\`
- Create: \`apps/web/public/technology-logos/simple-icons/*.svg\`
- Modify: \`apps/web/src/features/market/technology-icon.tsx\`
- Modify: \`apps/web/src/features/market/technology-icon.module.css\`
- Modify: \`apps/web/src/features/market/technology-icon.test.tsx\`
- Modify: \`apps/web/e2e/performance-budget.e2e.ts\`
- Modify: \`apps/web/package.json\`

**Interfaces:**
- Produces: \`resolveTechnologyBrandAsset(name): TechnologyBrandAsset | null\`.
- Produces: immutable URLs under \`/technology-logos/simple-icons/<slug>.svg\`.
- Consumes: Simple Icons only in the asset-sync script; no client module imports SVG path data.

- [ ] **Step 1: Write failing asset-registry tests**

Replace brand-path assertions in \`technology-icon.test.tsx\` and add:

\`\`\`ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  TECHNOLOGY_BRAND_ASSETS,
  resolveTechnologyBrandAsset,
} from "./technology-icon-assets";
import { TechnologyIcon } from "./technology-icon";

it.each([
  ["Python", "python"],
  ["Kubernetes", "kubernetes"],
  ["Apache Airflow", "apacheairflow"],
  ["React Native", "react"],
  [".NET", "dotnet"],
  ["TensorRT", "nvidia"],
])("maps %s to an on-demand static asset", (name, iconName) => {
  const asset = resolveTechnologyBrandAsset(name);
  expect(asset).toMatchObject({
    key: iconName,
    src: \`/technology-logos/simple-icons/\${iconName}.svg\`,
  });
  expect(asset?.hex).toMatch(/^[0-9A-F]{6}$/);
});

it("ships every registered technology logo asset", () => {
  for (const asset of Object.values(TECHNOLOGY_BRAND_ASSETS)) {
    expect(
      existsSync(resolve(process.cwd(), "public", asset.src.slice(1))),
      asset.src,
    ).toBe(true);
  }
});

it("keeps Simple Icons path data out of the client component", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/features/market/technology-icon.tsx"),
    "utf8",
  );
  expect(source).not.toContain('from "simple-icons"');
  expect(source).not.toContain("<path");
});
\`\`\`

Update the rendered brand assertion:

\`\`\`ts
const icon = container.querySelector("[data-technology-icon]");
expect(icon).toHaveAttribute("data-icon-kind", "brand");
expect(icon).toHaveAttribute("data-technology-icon", iconName);
expect(icon?.querySelector("[data-brand-mask]")).not.toBeNull();
\`\`\`

Append the production JavaScript budget to
\`e2e/performance-budget.e2e.ts\` before changing the implementation:

\`\`\`ts
test("/market keeps initial JavaScript within budget", async ({ page }) => {
  const resources = await coldResources(page, "/market");
  const scriptBytes = resources
    .filter(({ name }) => {
      const url = new URL(name);
      return url.pathname.startsWith("/_next/static/chunks/") &&
        url.pathname.endsWith(".js");
    })
    .reduce((total, resource) => total + resource.transferSize, 0);

  expect(scriptBytes).toBeGreaterThan(0);
  expect(scriptBytes).toBeLessThanOrEqual(275 * 1024);
});
\`\`\`

- [ ] **Step 2: Run both focused checks and verify RED**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/features/market/technology-icon.test.tsx
npm run build
npm run test:performance -- --grep "initial JavaScript"
\`\`\`

Expected: the unit test FAILS because \`technology-icon-assets.ts\` does not
exist, and the production budget FAILS near the measured 332 KB baseline.

- [ ] **Step 3: Create the deterministic icon generator**

Create \`apps/web/scripts/sync-technology-icons.mjs\`:

\`\`\`js
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as simpleIcons from "simple-icons";

const EXPORT_NAMES = [
  "siAndroid", "siAnsible", "siApacheairflow", "siApachecassandra",
  "siApacheflink", "siApachehive", "siApachekafka", "siApachespark",
  "siApple", "siArgo", "siC", "siCelery", "siClickhouse", "siCmake",
  "siCplusplus", "siDatabricks", "siDatadog", "siDocker", "siDotnet",
  "siFigma", "siGithubactions", "siGitlab", "siGnubash", "siGo",
  "siGooglebigquery", "siGooglecloud", "siGrafana", "siGradle",
  "siGraphql", "siHelm", "siHuggingface", "siIstio", "siJenkins",
  "siJira", "siJunit5", "siKotlin", "siKubernetes", "siLinux",
  "siMariadb", "siMilvus", "siMlflow", "siMongodb", "siMqtt",
  "siMysql", "siNodedotjs", "siNumpy", "siNvidia", "siOnnx",
  "siOpenjdk", "siOpensearch", "siOpentelemetry", "siPandas",
  "siPostgresql", "siPrometheus", "siPytest", "siPython", "siPytorch",
  "siRabbitmq", "siReact", "siReactquery", "siRedis", "siRedux",
  "siSentry", "siSnowflake", "siSonarqubeserver", "siSpring",
  "siStorybook", "siTailwindcss", "siTerraform", "siTypescript",
  "siUnity", "siVite", "siVllm", "siVulkan", "siWebpack", "siWebrtc",
];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(
  webRoot,
  "public",
  "technology-logos",
  "simple-icons",
);
const generatedModule = path.join(
  webRoot,
  "src",
  "features",
  "market",
  "technology-icon-assets.generated.ts",
);

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const assets = [];
for (const exportName of EXPORT_NAMES) {
  const icon = simpleIcons[exportName];
  if (!icon || typeof icon !== "object" || !("slug" in icon)) {
    throw new Error(\`Missing Simple Icons export: \${exportName}\`);
  }
  const source = path.join(
    webRoot,
    "node_modules",
    "simple-icons",
    "icons",
    \`\${icon.slug}.svg\`,
  );
  const destination = path.join(outputDirectory, \`\${icon.slug}.svg\`);
  await copyFile(source, destination);
  assets.push({
    hex: icon.hex.toUpperCase(),
    key: icon.slug,
    src: \`/technology-logos/simple-icons/\${icon.slug}.svg\`,
  });
}

assets.sort((left, right) => left.key.localeCompare(right.key));
const source = [
  "/* Generated by scripts/sync-technology-icons.mjs. */",
  "export const GENERATED_TECHNOLOGY_BRAND_ASSETS = ",
  JSON.stringify(Object.fromEntries(assets.map((asset) => [asset.key, asset])), null, 2),
  " as const;",
  "",
].join("\n");
await writeFile(generatedModule, source);
\`\`\`

Add:

\`\`\`json
{
  "scripts": {
    "assets:technology-icons": "node scripts/sync-technology-icons.mjs"
  }
}
\`\`\`

- [ ] **Step 4: Generate assets and add the hand-authored alias registry**

Run:

\`\`\`bash
cd apps/web
npm run assets:technology-icons
\`\`\`

Create \`technology-icon-assets.ts\`:

\`\`\`ts
import { GENERATED_TECHNOLOGY_BRAND_ASSETS } from "./technology-icon-assets.generated";

export type TechnologyBrandAsset = {
  hex: string;
  key: string;
  src: string;
};

const BRAND_ALIASES: Record<string, keyof typeof GENERATED_TECHNOLOGY_BRAND_ASSETS> = {
  ".net": "dotnet",
  android: "android",
  ansible: "ansible",
  "apache airflow": "apacheairflow",
  "apache cassandra": "apachecassandra",
  "apache flink": "apacheflink",
  "apache hive": "apachehive",
  "apache spark": "apachespark",
  "argo cd": "argo",
  bash: "gnubash",
  bigquery: "googlebigquery",
  c: "c",
  cassandra: "apachecassandra",
  celery: "celery",
  "c++": "cplusplus",
  clickhouse: "clickhouse",
  cmake: "cmake",
  databricks: "databricks",
  datadog: "datadog",
  docker: "docker",
  figma: "figma",
  gcp: "googlecloud",
  go: "go",
  golang: "go",
  gradle: "gradle",
  grafana: "grafana",
  graphql: "graphql",
  "github actions": "githubactions",
  "gitlab ci": "gitlab",
  helm: "helm",
  "hugging face": "huggingface",
  ios: "apple",
  istio: "istio",
  "isaac sim": "nvidia",
  java: "openjdk",
  jenkins: "jenkins",
  jira: "jira",
  junit: "junit5",
  kafka: "apachekafka",
  kotlin: "kotlin",
  kubernetes: "kubernetes",
  linux: "linux",
  mariadb: "mariadb",
  milvus: "milvus",
  mlflow: "mlflow",
  mongodb: "mongodb",
  mqtt: "mqtt",
  mysql: "mysql",
  "node.js": "nodedotjs",
  nodejs: "nodedotjs",
  numpy: "numpy",
  onnx: "onnx",
  openjdk: "openjdk",
  opensearch: "opensearch",
  opentelemetry: "opentelemetry",
  pandas: "pandas",
  postgresql: "postgresql",
  prometheus: "prometheus",
  pytest: "pytest",
  python: "python",
  pytorch: "pytorch",
  rabbitmq: "rabbitmq",
  react: "react",
  "react native": "react",
  "tanstack query": "reactquery",
  redis: "redis",
  redux: "redux",
  sentry: "sentry",
  snowflake: "snowflake",
  sonarqube: "sonarqubeserver",
  spring: "spring",
  "spring boot": "spring",
  storybook: "storybook",
  "tailwind css": "tailwindcss",
  tensorrt: "nvidia",
  terraform: "terraform",
  triton: "nvidia",
  typescript: "typescript",
  unity: "unity",
  vite: "vite",
  vllm: "vllm",
  vulkan: "vulkan",
  webpack: "webpack",
  webrtc: "webrtc",
};

export const TECHNOLOGY_BRAND_ASSETS = GENERATED_TECHNOLOGY_BRAND_ASSETS;

export function resolveTechnologyBrandAsset(
  name: string,
): TechnologyBrandAsset | null {
  const normalized = name.trim().toLocaleLowerCase("en-US");
  const key = BRAND_ALIASES[normalized];
  return key ? GENERATED_TECHNOLOGY_BRAND_ASSETS[key] : null;
}
\`\`\`

- [ ] **Step 5: Render static brand assets as masks**

Remove all \`simple-icons\` imports and \`BRAND_ICONS\` path objects from \`technology-icon.tsx\`. Import \`resolveTechnologyBrandAsset\` and render:

\`\`\`tsx
const brand = resolveTechnologyBrandAsset(name);

if (brand) {
  return (
    <span
      aria-hidden="true"
      className={styles.icon}
      data-icon-kind="brand"
      data-technology-icon={brand.key}
      style={{
        "--technology-icon-color": \`#\${brand.hex}\`,
        "--technology-icon-mask": \`url("\${brand.src}")\`,
        "--technology-icon-size": \`\${size}px\`,
      } as CSSProperties}
    >
      <span data-brand-mask className={styles.brandMask} />
    </span>
  );
}
\`\`\`

Keep the existing AWS local-logo branch before this branch, and keep all existing concept/category fallbacks after it.

Add to \`technology-icon.module.css\`:

\`\`\`css
.brandMask {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--technology-icon-color, currentColor);
  mask: var(--technology-icon-mask) center / contain no-repeat;
  -webkit-mask: var(--technology-icon-mask) center / contain no-repeat;
}
\`\`\`

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/features/market/technology-icon.test.tsx src/features/market/market-overview.test.tsx
\`\`\`

Expected: all focused tests PASS and every mapped SVG exists.

- [ ] **Step 7: Verify the market JavaScript budget is GREEN**

Run:

\`\`\`bash
cd apps/web
npm run build
npm run test:performance -- --grep "initial JavaScript"
\`\`\`

Expected: PASS at or below 275 KB. Inspect the production client manifest and fail the task if \`technology-icon.tsx\` still references a chunk containing Simple Icons path data.

- [ ] **Step 8: Commit the icon delivery optimization**

\`\`\`bash
git add apps/web/package.json apps/web/scripts/sync-technology-icons.mjs apps/web/public/technology-logos/simple-icons apps/web/src/features/market/technology-icon-assets.ts apps/web/src/features/market/technology-icon-assets.generated.ts apps/web/src/features/market/technology-icon.tsx apps/web/src/features/market/technology-icon.module.css apps/web/src/features/market/technology-icon.test.tsx apps/web/e2e/performance-budget.e2e.ts
git commit -m "perf: load technology logos on demand"
\`\`\`

---

### Task 4: Add Explicit API Freshness and Timeout Policies

**Files:**
- Create: \`apps/web/src/lib/api-request.ts\`
- Create: \`apps/web/src/lib/api-request.test.ts\`
- Create: \`apps/web/src/lib/api.test.ts\`
- Modify: \`apps/web/src/lib/api.ts\`

**Interfaces:**
- Produces: \`RequestPolicy = "public" | "durable" | "private"\`.
- Produces: \`requestJson<T>(baseUrl, path, options): Promise<T>\`.
- Produces: \`ApiError\` and \`ApiTimeoutError\`.
- Consumes: endpoint-specific policy and optional caller abort signals from \`api.ts\`.

- [ ] **Step 1: Write failing request-policy tests**

Create \`api-request.test.ts\`:

\`\`\`ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiTimeoutError,
  requestJson,
} from "./api-request";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

describe("requestJson", () => {
  it.each([
    ["public", { next: { revalidate: 60, tags: ["postings"] } }],
    ["durable", { next: { revalidate: 300, tags: ["catalog"] } }],
    ["private", { cache: "no-store" }],
  ] as const)("applies the %s request policy", async (policy, expected) => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await requestJson("https://api.example", "/resource", {
      policy,
      tags: policy === "public" ? ["postings"] : policy === "durable" ? ["catalog"] : [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/resource", "https://api.example"),
      expect.objectContaining(expected),
    );
  });

  it("classifies a timeout separately from an HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
      ),
    );

    await expect(
      requestJson("https://api.example", "/slow", {
        policy: "public",
        timeoutMs: 5,
      }),
    ).rejects.toBeInstanceOf(ApiTimeoutError);
  });

  it("keeps a caller cancellation distinct from a timeout", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
      ),
    );
    const request = requestJson("https://api.example", "/cancelled", {
      policy: "public",
      signal: controller.signal,
    });
    controller.abort(new DOMException("cancelled", "AbortError"));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
\`\`\`

Create \`api.test.ts\` before changing \`api.ts\`:

\`\`\`ts
import { afterEach, expect, it, vi } from "vitest";

import {
  analyzeFit,
  getPostings,
  getSkillCatalog,
} from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("assigns freshness by endpoint privacy and volatility", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          coverage: {
            matching_posting_count: 0,
            strong_fit_posting_count: 0,
          },
          domain_branches: [],
          recommended_next_skills: [],
        }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetchMock);

  await getPostings();
  await getSkillCatalog();
  await analyzeFit({ owned_skills: ["Python"] });

  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
    next: { revalidate: 60, tags: ["postings"] },
  });
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
    next: { revalidate: 300, tags: ["skill-catalog"] },
  });
  expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
    cache: "no-store",
    method: "POST",
  });
});
\`\`\`

- [ ] **Step 2: Run the focused test and verify RED**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/lib/api-request.test.ts src/lib/api.test.ts
\`\`\`

Expected: \`api-request.test.ts\` FAILS because \`api-request.ts\` does not
exist, and \`api.test.ts\` reports the current \`cache: "no-store"\` behavior
instead of the required public and durable policies.

- [ ] **Step 3: Implement the typed request transport**

Create \`api-request.ts\`:

\`\`\`ts
export type RequestPolicy = "public" | "durable" | "private";

type NextRequestInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

export type RequestJsonOptions = Omit<NextRequestInit, "cache" | "next"> & {
  policy: RequestPolicy;
  tags?: string[];
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;

export class ApiError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(\`API request failed: \${url} (\${status})\`);
    this.name = "ApiError";
  }
}

export class ApiTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
  ) {
    super(\`API request timed out: \${url} (\${timeoutMs}ms)\`);
    this.name = "ApiTimeoutError";
  }
}

function policyInit(
  policy: RequestPolicy,
  tags: string[],
): Pick<NextRequestInit, "cache" | "next"> {
  if (policy === "private") {
    return { cache: "no-store" };
  }
  return {
    next: {
      revalidate: policy === "durable" ? 300 : 60,
      ...(tags.length > 0 ? { tags } : {}),
    },
  };
}

function combinedSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal,
) {
  return callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  {
    policy,
    tags = [],
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    ...init
  }: RequestJsonOptions,
): Promise<T> {
  const url = new URL(path, baseUrl);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(url, {
      ...policyInit(policy, tags),
      ...init,
      headers: {
        ...(init.headers ?? {}),
      },
      signal: combinedSignal(callerSignal, timeoutSignal),
    });
    if (!response.ok) {
      throw new ApiError(url.toString(), response.status);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (timeoutSignal.aborted && !callerSignal?.aborted) {
      throw new ApiTimeoutError(url.toString(), timeoutMs);
    }
    throw error;
  }
}
\`\`\`

- [ ] **Step 4: Run the transport tests and verify GREEN**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/lib/api-request.test.ts
\`\`\`

Expected: all request policy, timeout, and caller cancellation tests PASS.

- [ ] **Step 5: Assign an explicit policy to every API endpoint**

In \`api.ts\`, import and re-export the errors:

\`\`\`ts
import {
  ApiError,
  ApiTimeoutError,
  requestJson,
  type RequestPolicy,
} from "./api-request";

export { ApiError, ApiTimeoutError };
\`\`\`

Replace the old request helper with:

\`\`\`ts
async function request<T>(
  path: string,
  options: RequestInit & {
    policy?: RequestPolicy;
    tags?: string[];
  } = {},
): Promise<T> {
  const {
    policy = "public",
    tags = [],
    ...init
  } = options;
  return requestJson<T>(API_BASE_URL, path, {
    ...init,
    policy,
    tags,
  });
}
\`\`\`

Use these exact endpoint policies:

\`\`\`ts
request<unknown>(\`/api/postings\${query}\`, {
  policy: "public",
  tags: ["postings"],
});

request<unknown>(\`/api/postings/\${encodeURIComponent(id)}\`, {
  policy: "public",
  signal,
  tags: ["postings"],
});

request<unknown>(\`/api/hiring/overview?\${params.toString()}\`, {
  policy: "public",
  tags: ["hiring"],
});

request<SkillStatsResponse>(\`/api/skills/stats\${query}\`, {
  policy: "public",
  tags: ["skills"],
});

request<SkillCatalogResponse>("/api/skills/catalog", {
  policy: "durable",
  tags: ["skill-catalog"],
});

request<SkillTrendResponse>(\`/api/skills/trends?\${params.toString()}\`, {
  policy: "public",
  tags: ["skill-trends"],
});

request<SourceDirectoryResponse>("/api/sources", {
  policy: "durable",
  tags: ["sources"],
});

request<SkillGraphResponse>(\`/api/graph/skills\${query}\`, {
  policy: "public",
  tags: ["skill-graph"],
});

request<FitAnalyzeResponse>("/api/fit/analyze", {
  method: "POST",
  policy: "private",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
  signal,
});
\`\`\`

- [ ] **Step 6: Verify endpoint-policy integration is GREEN**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/lib/api-request.test.ts src/lib/api.test.ts
\`\`\`

Expected: transport and endpoint-policy tests PASS using real response
normalizers and a mocked network boundary.

- [ ] **Step 7: Run API and page regression tests**

Run:

\`\`\`bash
cd apps/web
npm test -- --run src/lib/api-request.test.ts src/lib/api.test.ts src/app/page.test.tsx src/app/market/page.test.tsx src/app/jobs/page.test.tsx src/app/search/page.test.tsx
npm run lint
\`\`\`

Expected: all focused tests PASS and TypeScript reports zero errors.

- [ ] **Step 8: Commit API resilience**

\`\`\`bash
git add apps/web/src/lib/api-request.ts apps/web/src/lib/api-request.test.ts apps/web/src/lib/api.test.ts apps/web/src/lib/api.ts
git commit -m "perf: cache and bound public API reads"
\`\`\`

---

### Task 5: Full Verification, Integration, and Remote Delivery

**Files:**
- Modify only if verification exposes a regression in a file already changed by Tasks 1-4.

**Interfaces:**
- Consumes: all four independent optimization commits.
- Produces: verified branch, fast-forward integration into \`main\`, and synchronized \`origin/main\`.

- [ ] **Step 1: Verify generated assets and repository hygiene**

Run:

\`\`\`bash
cd apps/web
npm run assets:fonts
npm run assets:technology-icons
git diff --exit-code -- public/fonts/pretendard public/technology-logos/simple-icons src/features/market/technology-icon-assets.generated.ts
git diff --check
\`\`\`

Expected: asset generation is deterministic, no diff remains, and whitespace validation passes.

- [ ] **Step 2: Run the complete frontend unit suite**

Run:

\`\`\`bash
cd apps/web
npm test -- --run
\`\`\`

Expected: all test files and tests PASS with zero failures.

- [ ] **Step 3: Run typecheck and production build**

Run:

\`\`\`bash
cd apps/web
npm run lint
npm run build
\`\`\`

Expected: both commands exit 0 with no TypeScript or build errors.

- [ ] **Step 4: Run production performance budgets**

Run:

\`\`\`bash
cd apps/web
npm run test:performance
\`\`\`

Expected:

- \`/\` and \`/market\` font transfer is at most 450 KB;
- \`/market\` initial JavaScript transfer is at most 275 KB;
- \`/\` and \`/market\` each issue at most 15 automatic RSC prefetches;
- all performance tests PASS.

- [ ] **Step 5: Run the complete product E2E suite**

Run:

\`\`\`bash
cd apps/web
npm run test:e2e
\`\`\`

Expected: all Playwright scenarios PASS at every configured viewport with no browser console or page errors.

- [ ] **Step 6: Inspect the final diff and preserved user state**

Run from the repository root:

\`\`\`bash
git status -sb
git diff main...HEAD --stat
git diff main...HEAD --check
\`\`\`

Expected: only plan/spec and Task 1-4 implementation files are committed in the feature branch. The main worktree still retains its pre-existing \`apps/web/next-env.d.ts\` change and unrelated untracked files.

- [ ] **Step 7: Integrate and synchronize**

After verification, use the finishing-a-development-branch workflow. Fast-forward \`main\` only when \`origin/main\` has not advanced unexpectedly, then run:

\`\`\`bash
git push origin main
\`\`\`

Expected: \`main...origin/main\` reports \`0 0\`, and the user's unrelated dirty files remain local and uncommitted.
