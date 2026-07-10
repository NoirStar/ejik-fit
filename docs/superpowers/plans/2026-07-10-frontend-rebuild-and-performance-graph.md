# Frontend Rebuild and Performance Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Ejikfit frontend around honest production data, one accessible design system, and a Sigma.js WebGL skill graph that remains responsive at large graph sizes.

**Architecture:** Preserve the FastAPI contracts and domain calculations, introduce explicit resource states and feature view models, and replace the accumulated global dashboard CSS with shared tokens plus CSS Modules. Build the graph around Graphology, deterministic positions, adjacency indexes, camera-driven LOD, and a Sigma.js adapter; use a bounded ForceAtlas2 worker only while the graph settles.

**Tech Stack:** Next.js 16.2.10, React 19.2, TypeScript 5.8, Vitest 3.2, Testing Library, vanilla CSS Modules, Pretendard Variable 1.3.9, Geist, Sigma.js 3.0.3, Graphology 0.26.0, graphology-layout-forceatlas2 0.10.1, Playwright 1.61.1.

## Global Constraints

- Preserve the existing FastAPI endpoints, database models, crawlers, skill extraction rules, Fit calculation, and graph relationship calculation.
- Production UI must not import or render sample companies, fabricated D-days, fixed trend percentages, fixed chart coordinates, or decorative market signals.
- Display `요구 기술 일치도`; never describe Fit as a hiring probability.
- Exposed navigation is limited to `홈`, `공고 탐색`, `기술 맵`, and `내 스택` until additional routes are functional.
- Remove fake user identity, notification badge, disabled product menus, and controls without behavior.
- Use self-hosted Pretendard Variable for Korean and Geist for Latin text and tabular numbers.
- Use Sigma.js v3, Graphology, and ForceAtlas2 Worker; do not adopt Sigma.js v4 alpha.
- The global graph must not render every posting as a node; selected evidence is limited to 20 postings.
- Desktop engine capacity target is 50,000 nodes and 150,000 edges; mobile default visible budget is 500 nodes and 1,500 edges.
- CI graph interaction fixture is 5,000 nodes with average frame interval at or below 22ms and no long task at or above 200ms during the measured interaction.
- Each route has exactly one `<main>` landmark, visible keyboard focus, 44px touch targets, reduced-motion behavior, and no horizontal overflow at 390px, 768px, and 1440px.
- Keep the application runnable after every task and delete legacy dashboard/graph CSS only after feature parity tests pass.
- Do not stage, edit, or remove the existing untracked `.agents/` directory.

---

### Task 1: Dependency and Design-System Foundation

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Create: `apps/web/public/fonts/PretendardVariable.woff2`
- Create: `apps/web/public/fonts/OFL.txt`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/reset.css`
- Create: `apps/web/src/styles/typography.css`
- Create: `apps/web/src/styles/motion.css`
- Create: `apps/web/src/styles/design-system.test.ts`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Consumes: current root layout and Geist variable font.
- Produces: `--font-korean`, semantic color/space/radius tokens, normalized global element styles, and installed graph packages for Tasks 7–10.

- [ ] **Step 1: Write the failing design-system contract test**

```ts
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd apps/web && npm test -- --run src/styles/design-system.test.ts`

Expected: FAIL because `src/styles/tokens.css` and `src/styles/typography.css` do not exist.

- [ ] **Step 3: Install exact runtime and browser-test dependencies**

Run:

```bash
cd apps/web
npm install sigma@3.0.3 graphology@0.26.0 graphology-layout-forceatlas2@0.10.1
npm install --save-dev @playwright/test@1.61.1
```

Expected: `package.json` and `package-lock.json` contain the exact versions.

- [ ] **Step 4: Add the licensed local Pretendard asset**

Run:

```bash
curl -L https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/woff2/PretendardVariable.woff2 -o apps/web/public/fonts/PretendardVariable.woff2
curl -L https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/LICENSE -o apps/web/public/fonts/OFL.txt
```

Expected: the WOFF2 asset and license file exist under `public/fonts`.

- [ ] **Step 5: Create the four global foundation styles**

`tokens.css` must define light values on `:root`, dark values under `@media (prefers-color-scheme: dark)`, and these exact public tokens:

```css
:root {
  --color-bg: #f2f5f4;
  --color-surface: #ffffff;
  --color-surface-muted: #e9efed;
  --color-text: #101714;
  --color-muted: #58665f;
  --color-faint: #73827a;
  --color-line: #d5dfda;
  --color-accent: #17b77a;
  --color-accent-strong: #087b52;
  --color-info: #356fe5;
  --color-warning: #a65f12;
  --color-danger: #b63e4a;
  --color-graph: #07111d;
  --radius-control: 0.625rem;
  --radius-panel: 0.875rem;
  --radius-overlay: 1.125rem;
  --touch-target: 2.75rem;
  --content-max: 90rem;
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
}
```

`typography.css` must declare `@font-face` using `/fonts/PretendardVariable.woff2`, set `--font-korean`, and apply tabular figures to `[data-numeric]`. `reset.css` must normalize box sizing, margins, controls, links, and media. `motion.css` must disable nonessential animation and smooth scrolling under `prefers-reduced-motion: reduce`.

- [ ] **Step 6: Reduce the root layout to the shared global imports**

Import the four style files, keep `lang="ko"`, keep the skip link, and remove `SiteHeader` and the legacy global footer from the root layout. The product shell introduced in Task 3 owns product navigation and footer content.

- [ ] **Step 7: Run the focused test and typecheck**

Run:

```bash
cd apps/web
npm test -- --run src/styles/design-system.test.ts
npm run lint
```

Expected: PASS with zero TypeScript errors.

- [ ] **Step 8: Commit Task 1**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/public/fonts apps/web/src/styles apps/web/src/app/layout.tsx
git commit -m "feat: add frontend design system foundation"
```

---

### Task 2: Honest Resource State and Dashboard Model

**Files:**
- Create: `apps/web/src/features/dashboard/state.ts`
- Create: `apps/web/src/features/dashboard/state.test.ts`
- Create: `apps/web/src/features/dashboard/model.ts`
- Create: `apps/web/src/features/dashboard/model.test.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Produces: `ResourceState<T>`, `DashboardStatus`, `DashboardSnapshot`, `settledResource`, and `buildDashboardSnapshot`.
- Consumes: existing `PostingListResponse`, `SkillStatsResponse`, `SkillGraphResponse`, and owned skills.

`DashboardSnapshot` is the only home rendering input:

```ts
export type DashboardSnapshot = {
  status: DashboardStatus;
  ownedSkills: string[];
  jobs: Array<{
    id: string;
    title: string;
    companyName: string;
    location: string;
    careerLabel: string;
    sourceUrl: string;
    lastVerifiedLabel: string;
    matchedSkills: string[];
    matchScore: number | null;
  }>;
  skillDemand: Array<{
    label: string;
    count: number;
    requiredCount: number;
    preferredCount: number;
  }>;
  adjacentSkills: Array<{ label: string; cooccurrenceCount: number }>;
  displayedPostingCount: number;
  displayedSourceCount: number;
  matchingPostingCount: number;
  lastVerifiedAt: string | null;
  fitLabel: "요구 기술 일치도";
};
```

- [ ] **Step 1: Write failing state tests**

```ts
import { describe, expect, it } from "vitest";
import { dashboardStatus, settledResource } from "./state";

describe("dashboard resource state", () => {
  it("reports partial when one resource succeeds and another fails", () => {
    const ready = settledResource(Promise.resolve({ items: [1], total: 1 }));
    const failed = settledResource(Promise.reject(new Error("offline")));
    return Promise.all([ready, failed]).then((resources) => {
      expect(dashboardStatus(resources)).toBe("partial");
      expect(resources[1]).toMatchObject({ status: "error", retryable: true });
    });
  });

  it("reports empty when successful resources contain no items", async () => {
    const empty = await settledResource(Promise.resolve({ items: [], total: 0 }));
    expect(empty).toEqual({ status: "empty", reason: "no-data" });
    expect(dashboardStatus([empty])).toBe("empty");
  });
});
```

- [ ] **Step 2: Run the state test and verify RED**

Run: `cd apps/web && npm test -- --run src/features/dashboard/state.test.ts`

Expected: FAIL because `./state` does not exist.

- [ ] **Step 3: Implement the state union and settled adapter**

```ts
export type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; updatedAt?: string }
  | { status: "empty"; reason: "no-data" | "no-match" }
  | { status: "error"; message: string; retryable: boolean };

export type DashboardStatus = "ready" | "partial" | "empty" | "error";

export async function settledResource<T extends { items?: unknown[]; total?: number }>(
  promise: Promise<T>,
): Promise<ResourceState<T>> {
  try {
    const data = await promise;
    const empty = Array.isArray(data.items) && data.items.length === 0;
    return empty ? { status: "empty", reason: "no-data" } : { status: "ready", data };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.",
      retryable: true,
    };
  }
}

export function dashboardStatus(resources: ResourceState<unknown>[]): DashboardStatus {
  const ready = resources.filter((item) => item.status === "ready").length;
  const empty = resources.filter((item) => item.status === "empty").length;
  const error = resources.filter((item) => item.status === "error").length;
  if (ready > 0 && error > 0) return "partial";
  if (ready > 0) return "ready";
  if (empty > 0 && error === 0) return "empty";
  return "error";
}
```

- [ ] **Step 4: Write failing dashboard model tests**

Tests must prove that the snapshot contains only API postings, derives skill counts from API values, labels fit as `요구 기술 일치도`, and contains no `trendPercent`, `deadlineBadge`, or generated company rows.

```ts
expect(snapshot.jobs.map((job) => job.companyName)).toEqual(["토스"]);
expect(snapshot.skillDemand[0]).toMatchObject({ label: "Kubernetes", count: 14 });
expect(snapshot.fitLabel).toBe("요구 기술 일치도");
expect(JSON.stringify(snapshot)).not.toMatch(/38%|D-2|네이버|카카오/);
```

- [ ] **Step 5: Implement `DashboardSnapshot` without fallbacks**

The model must expose actual jobs, actual skill demand, matching count, source count derived from unique source URL hostnames, last verified timestamp, owned skills, and methodology copy. Supplemental API postings are allowed but must be labeled `전체 공식 공고`; no fixture data is allowed.

- [ ] **Step 6: Extend `getPostings` with exact supported query parameters**

Add `company?: string` and `limit?: number` to the function input and URL serialization. Do not send unsupported region or period query parameters to FastAPI.

- [ ] **Step 7: Rewire the home server page**

Use `settledResource` for postings, stats, and graph requests. Request up to 100 postings, pass resource states into the new snapshot builder, and render the Task 4 home component interface. Until Task 4 lands, use a minimal semantic `<main>` showing the computed status and actual posting count so this task remains buildable.

- [ ] **Step 8: Run focused tests and typecheck**

Run:

```bash
cd apps/web
npm test -- --run src/features/dashboard/state.test.ts src/features/dashboard/model.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add apps/web/src/features/dashboard apps/web/src/lib/api.ts apps/web/src/app/page.tsx
git commit -m "feat: model honest dashboard states"
```

---

### Task 3: Shared Product Shell and Owned-Skills Sheet

**Files:**
- Create: `apps/web/src/components/app-shell/app-shell.tsx`
- Create: `apps/web/src/components/app-shell/app-shell.module.css`
- Create: `apps/web/src/components/app-shell/app-shell.test.tsx`
- Create: `apps/web/src/features/owned-skills/owned-skills-sheet.tsx`
- Create: `apps/web/src/features/owned-skills/owned-skills-sheet.module.css`
- Create: `apps/web/src/features/owned-skills/owned-skills-sheet.test.tsx`
- Modify: `apps/web/src/lib/owned-skills.ts`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: `<AppShell>`, `<OwnedSkillsSheet>`, and `EMPTY_OWNED_SKILLS` first-visit behavior.
- Consumes: `BrandMark`, localStorage helpers, and Next pathname/navigation.

- [ ] **Step 1: Write the failing shell test**

```tsx
render(<AppShell><p>내용</p></AppShell>);
expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("href", "/");
expect(screen.getByRole("link", { name: "공고 탐색" })).toHaveAttribute("href", "/jobs");
expect(screen.getByRole("link", { name: "기술 맵" })).toHaveAttribute("href", "/skills/graph");
expect(screen.getByRole("button", { name: "내 스택 열기" })).toBeInTheDocument();
expect(screen.queryByText("김민준")).not.toBeInTheDocument();
expect(screen.queryByText("준비중")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the shell test and verify RED**

Run: `cd apps/web && npm test -- --run src/components/app-shell/app-shell.test.tsx`

Expected: FAIL because the app shell module does not exist.

- [ ] **Step 3: Implement the shell**

Use one desktop side rail and one mobile bottom navigation. Both variants must render text labels. The shell footer links to `/data-policy`, `/methodology`, `/privacy`, `/corrections`, and GitHub. Calculate active state from `usePathname`; do not hardcode active flags.

- [ ] **Step 4: Write failing first-visit and focus tests for the sheet**

The tests must assert that no default skills are shown after clearing localStorage, the sheet opens from `내 스택 열기`, adding `Spring` persists it, Escape closes the sheet, and focus returns to the opener.

- [ ] **Step 5: Implement the owned-skills sheet**

Keep normalized add/remove validation, add `clearOwnedSkills`, remove automatic Java/Spring/AWS defaults for first-time users, and render onboarding copy: `로그인 없이 사용하며, 선택한 기술은 이 브라우저에만 저장됩니다.`

- [ ] **Step 6: Apply the shared shell once in the root layout**

Wrap route children in `<AppShell>` from `app/layout.tsx`. The shell owns product navigation
and the public footer for home, jobs, graph, and trust pages without moving or duplicating route
segments.

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```bash
cd apps/web
npm test -- --run src/components/app-shell/app-shell.test.tsx src/features/owned-skills/owned-skills-sheet.test.tsx src/lib/owned-skills.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add apps/web/src/components/app-shell apps/web/src/features/owned-skills apps/web/src/lib/owned-skills.ts apps/web/src/app
git commit -m "feat: add shared product shell"
```

---

### Task 4: Rebuilt Honest Home Dashboard

**Files:**
- Create: `apps/web/src/features/dashboard/dashboard-home.tsx`
- Create: `apps/web/src/features/dashboard/dashboard-home.module.css`
- Create: `apps/web/src/features/dashboard/dashboard-home.test.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Delete after passing replacement tests: `apps/web/src/components/dashboard/daily-dashboard-home.tsx`
- Delete after passing replacement tests: `apps/web/src/components/dashboard/app-shell.tsx`

**Interfaces:**
- Consumes: `DashboardSnapshot`, `DashboardStatus`, `ResourceState` values, and current URL filters.
- Produces: production home with honest overview, actual jobs, actual skill demand, visible partial/error states, and no fixed chart.

```ts
export type DashboardHomeProps = {
  snapshot: DashboardSnapshot;
  resourceErrors: string[];
};
```

- [ ] **Step 1: Write failing home behavior tests**

Cover all four states. The ready test asserts actual company names and source count; partial asserts a visible `일부 데이터를 불러오지 못했습니다` status; empty asserts stack onboarding; error asserts `다시 시도` and `/data-policy`. Every test asserts the absence of `김민준`, `FIT SCORE 82%`, `지난주 대비`, `D-2`, `7일`, `30일`, and `90일`.

- [ ] **Step 2: Run the home test and verify RED**

Run: `cd apps/web && npm test -- --run src/features/dashboard/dashboard-home.test.tsx`

Expected: FAIL because the rebuilt home component does not exist.

- [ ] **Step 3: Implement the desktop home composition**

Render these semantic sections in order:

1. Header: `오늘의 공식 채용 신호`, last verified time, data-policy link.
2. Trust strip: analysis scope, unique source count, actual posting count, selected skill count.
3. Matching summary: matching posting count and methodology note, without a fabricated overall percentage.
4. Recent official postings: up to eight linked job rows and separate official-source links.
5. Skill demand: actual API counts with required/preferred breakdown where present.
6. Adjacent skills: graph co-occurrence counts only.

- [ ] **Step 4: Implement responsive CSS Module**

Use a 12-column desktop grid, one-column mobile flow, minmax grid tracks, ellipsis only on desktop titles/locations, 44px controls, semantic tokens, no shadows on ordinary panels, and no decorative gradients. At 820px and below, preserve every action and let the app shell handle mobile navigation.

- [ ] **Step 5: Rewire the route and remove the replaced legacy home files**

The server route passes resource states and snapshot to `<DashboardHome>`. Delete the two replaced legacy files only after the focused tests pass. Remove imports from `src/app/page.test.tsx` and migrate its assertions to the new feature test.

- [ ] **Step 6: Run home and filter regression tests**

Run:

```bash
cd apps/web
npm test -- --run src/features/dashboard src/components/dashboard/dashboard-filters.test.ts src/app/page.test.tsx
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add apps/web/src/features/dashboard apps/web/src/app apps/web/src/components/dashboard apps/web/src/app/page.test.tsx
git commit -m "feat: rebuild home with honest data"
```

---

### Task 5: Jobs Explorer and Trusted Job Detail

**Files:**
- Create: `apps/web/src/features/jobs/job-list.tsx`
- Create: `apps/web/src/features/jobs/job-list.module.css`
- Create: `apps/web/src/features/jobs/job-list.test.tsx`
- Create: `apps/web/src/app/jobs/page.tsx`
- Modify: `apps/web/src/app/jobs/[id]/page.tsx`
- Create: `apps/web/src/app/jobs/[id]/error.tsx`
- Create: `apps/web/src/app/jobs/[id]/page.test.tsx`
- Modify: `apps/web/src/components/source-meta.tsx`
- Modify: `apps/web/src/components/skill-evidence.tsx`
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces: `/jobs`, shared-shell job detail, dynamic metadata, and `JobPosting` JSON-LD.
- Consumes: `getPostings`, `getPosting`, URL query values, source metadata, and skill evidence.

- [ ] **Step 1: Write failing job-list tests**

Tests must assert URL-backed query/career filters, result count, internal detail link, official source link with `target="_blank"`, filter reset, and distinct empty/error messages.

- [ ] **Step 2: Run the job-list test and verify RED**

Run: `cd apps/web && npm test -- --run src/features/jobs/job-list.test.tsx`

Expected: FAIL because the job list feature does not exist.

- [ ] **Step 3: Implement the server route and list component**

The server route sends `q`, supported `career_type`, and `limit: 100` to `getPostings`. Region filtering may operate on the complete returned page; period and deadline controls must not render because the summary API lacks opening/closing dates. The list component renders only controls that have actual behavior.

- [ ] **Step 4: Add dynamic job metadata and JSON-LD**

`generateMetadata` uses company and title, canonical `/jobs/{id}`, and a description based on location/career without copying the full posting. Render a JSON-LD script with `@type: "JobPosting"`, title, hiringOrganization name, jobLocation text, datePosted when `opens_at` exists, validThrough when `closes_at` exists, and direct official URL.

- [ ] **Step 5: Integrate trust actions**

Place official source, last verified time, requirement evidence, methodology link, and corrections link above the long description. The error boundary offers retry, `/jobs`, and `/data-policy`.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
cd apps/web
npm test -- --run src/features/jobs src/components/job-card.test.tsx src/components/skill-evidence.test.tsx
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/web/src/features/jobs apps/web/src/app apps/web/src/components/source-meta.tsx apps/web/src/components/skill-evidence.tsx apps/web/src/lib/api.ts
git commit -m "feat: add trusted jobs experience"
```

---

### Task 6: Public Trust Pages and Search Metadata

**Files:**
- Create: `apps/web/src/app/data-policy/page.tsx`
- Create: `apps/web/src/app/methodology/page.tsx`
- Create: `apps/web/src/app/privacy/page.tsx`
- Create: `apps/web/src/app/corrections/page.tsx`
- Create: `apps/web/src/app/trust-pages.module.css`
- Create: `apps/web/src/app/trust-pages.test.tsx`
- Create: `apps/web/src/app/robots.ts`
- Create: `apps/web/src/app/sitemap.ts`
- Create: `apps/web/src/app/manifest.ts`
- Create: `apps/web/src/lib/site-url.ts`
- Create: `apps/web/src/lib/site-url.test.ts`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: public data-policy, methodology, privacy, corrections routes and canonical metadata helpers.
- Consumes: README collection principles and `NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 1: Write failing trust-page and site URL tests**

Assert that each page has a unique H1 and required link, privacy mentions `ejik-fit:owned-skills` and URL query storage, corrections links to `https://github.com/NoirStar/ejik-fit/issues`, and `siteUrl()` returns localhost only outside production.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd apps/web && npm test -- --run src/app/trust-pages.test.tsx src/lib/site-url.test.ts`

Expected: FAIL because the pages and helper do not exist.

- [ ] **Step 3: Implement the four pages with specific content**

- Data policy: public pages only, no auth/CAPTCHA bypass, three consecutive missing runs before closure, official source and verification time.
- Methodology: dictionary-based extraction, confidence threshold, required/preferred evidence, Fit definition, sample size requirement, no hiring prediction.
- Privacy: no account, localStorage key, query parameters, clear-data action, no cookie claim unless code verifies it.
- Corrections: required report fields and GitHub Issues link; do not invent an operator email or business identity.

- [ ] **Step 4: Implement metadata files**

Add root metadataBase, canonical, Open Graph, Twitter card, manifest, robots, and sitemap entries for all public routes. Use `NEXT_PUBLIC_SITE_URL` in production and `http://localhost:3000` in development.

- [ ] **Step 5: Run focused tests, metadata tests, and build**

Run:

```bash
cd apps/web
npm test -- --run src/app/trust-pages.test.tsx src/lib/site-url.test.ts
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add apps/web/src/app apps/web/src/lib/site-url.ts apps/web/src/lib/site-url.test.ts
git commit -m "feat: publish trust and metadata pages"
```

---

### Task 7: Graphology Model, Deterministic Layout, Adjacency, and LOD

**Files:**
- Create: `apps/web/src/features/graph/model/build-graph.ts`
- Create: `apps/web/src/features/graph/model/build-graph.test.ts`
- Create: `apps/web/src/features/graph/model/adjacency.ts`
- Create: `apps/web/src/features/graph/model/adjacency.test.ts`
- Create: `apps/web/src/features/graph/layout/deterministic-position.ts`
- Create: `apps/web/src/features/graph/layout/deterministic-position.test.ts`
- Create: `apps/web/src/features/graph/layout/graph-fingerprint.ts`
- Create: `apps/web/src/features/graph/layout/graph-fingerprint.test.ts`
- Create: `apps/web/src/features/graph/model/lod.ts`
- Create: `apps/web/src/features/graph/model/lod.test.ts`

**Interfaces:**
- Produces: `buildGraphologyGraph`, `buildAdjacencyIndex`, `deterministicPosition`, `graphFingerprint`, and `createGraphLodState`.
- Consumes: current `SkillGraphResponse`; output is a Graphology graph with Sigma node attributes.

```ts
export type AdjacencyIndex = {
  neighbors(nodeId: string): ReadonlySet<string>;
  edgeIds(nodeId: string): readonly string[];
  neighborhood(nodeId: string, depth: 1 | 2): ReadonlySet<string>;
};

export type GraphLodState = {
  mode: "overview" | "medium" | "detail";
  hiddenNodeIds: ReadonlySet<string>;
  hiddenEdgeIds: ReadonlySet<string>;
  forcedLabelIds: ReadonlySet<string>;
  selectedNeighborhoodIds: ReadonlySet<string>;
};

export function graphFingerprint(
  nodeIds: readonly string[],
  edges: readonly { source: string; target: string }[],
): Promise<string>;
```

- [ ] **Step 1: Write failing graph model tests**

The graph builder test asserts skill nodes only in the global graph, edge weights and domain colors, owned/seed attributes, and evidence stored in a posting lookup rather than inserted as all global nodes.

- [ ] **Step 2: Write failing adjacency tests**

```ts
const index = buildAdjacencyIndex([
  { source: "Java", target: "Spring" },
  { source: "Spring", target: "Kafka" },
]);
expect([...index.neighbors("Spring")].sort()).toEqual(["Java", "Kafka"]);
expect(index.edgeIds("Spring")).toHaveLength(2);
```

- [ ] **Step 3: Write failing deterministic layout and fingerprint tests**

Assert identical IDs/domains produce identical coordinates across calls, different node IDs do not collide exactly, positions are finite, and fingerprint is stable regardless of node/edge input ordering.

- [ ] **Step 4: Write failing camera LOD tests**

Assert overview has at most 24 labels and aggregated/hidden individual edges, medium includes owned/hub labels in viewport, detail includes only selected one/two-hop edges, and mobile sampling respects 500 nodes and 1,500 edges.

- [ ] **Step 5: Run all graph-core tests and verify RED**

Run: `cd apps/web && npm test -- --run src/features/graph/model src/features/graph/layout`

Expected: FAIL because the feature modules do not exist.

- [ ] **Step 6: Implement graph builder and indexes**

Use `graphology` `UndirectedGraph`. Node attributes include `x`, `y`, `size`, `color`, `label`, `domain`, `demandCount`, `owned`, `seed`, and `kind: "skill"`. Precompute neighbor and edge ID maps once. Keep at most 20 evidence items per selected skill in a lookup keyed by skill ID.

- [ ] **Step 7: Implement deterministic position and fingerprint**

Use a stable string hash to assign domain sectors and node jitter. Use `crypto.subtle.digest("SHA-256", encodedIds)` when available for graph fingerprint and a deterministic synchronous test fallback based on the same normalized ID sequence.

- [ ] **Step 8: Implement real LOD state**

Return hidden node IDs, hidden edge IDs, forced label IDs, selected neighborhood IDs, and mode `overview | medium | detail`. Accept camera ratio, viewport node IDs, selected ID, mobile flag, and adjacency index.

- [ ] **Step 9: Run graph-core tests and typecheck**

Run:

```bash
cd apps/web
npm test -- --run src/features/graph/model src/features/graph/layout
npm run lint
```

Expected: PASS.

- [ ] **Step 10: Commit Task 7**

```bash
git add apps/web/src/features/graph/model apps/web/src/features/graph/layout
git commit -m "feat: add scalable graph model"
```

---

### Task 8: Sigma WebGL Renderer and Bounded Worker Layout

**Files:**
- Create: `apps/web/src/features/graph/renderer/types.ts`
- Create: `apps/web/src/features/graph/renderer/sigma-adapter.ts`
- Create: `apps/web/src/features/graph/renderer/sigma-adapter.test.ts`
- Create: `apps/web/src/features/graph/renderer/graph-canvas.tsx`
- Create: `apps/web/src/features/graph/renderer/graph-canvas.module.css`
- Create: `apps/web/src/features/graph/renderer/force-layout.ts`
- Create: `apps/web/src/features/graph/renderer/force-layout.test.ts`
- Create: `apps/web/src/features/graph/layout/position-cache.ts`
- Create: `apps/web/src/features/graph/layout/position-cache.test.ts`

**Interfaces:**
- Produces: `SigmaGraphAdapter`, `<GraphCanvas>`, `startBoundedLayout`, and IndexedDB position cache.
- Consumes: Graphology graph, adjacency index, LOD state, selection callback, and reduced-motion preference.

```ts
export type GraphRendererView = {
  selectedId: string | null;
  hoveredId: string | null;
  hiddenNodeIds: ReadonlySet<string>;
  hiddenEdgeIds: ReadonlySet<string>;
  forcedLabelIds: ReadonlySet<string>;
};

export type BoundedLayoutController = {
  stop(): void;
  isRunning(): boolean;
};

export type ForceAtlasWorkerFactory = (
  graph: import("graphology").default,
  settings: { barnesHutOptimize: true },
) => {
  start(): void;
  stop(): void;
  kill(): void;
  isRunning(): boolean;
};

export function startBoundedLayout(input: {
  graph: import("graphology").default;
  reducedMotion: boolean;
  timeoutMs?: number;
  workerFactory?: ForceAtlasWorkerFactory;
}): BoundedLayoutController;
```

- [ ] **Step 1: Define and test the renderer lifecycle contract**

```ts
export type GraphRendererAdapter = {
  mount(container: HTMLElement): void;
  setGraph(graph: import("graphology").default): void;
  setView(view: GraphRendererView): void;
  focusNode(nodeId: string): void;
  resize(): void;
  destroy(): void;
};
```

The test uses injected Sigma constructor and asserts one mount, reducer updates without remount, camera focus, and complete destroy cleanup.

- [ ] **Step 2: Run adapter test and verify RED**

Run: `cd apps/web && npm test -- --run src/features/graph/renderer/sigma-adapter.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the Sigma adapter**

Use node and edge reducers to apply LOD, selection, hover, and dimming. Register click/hover/camera handlers once. Do not perform React state updates on every camera frame; throttle semantic LOD updates with `requestAnimationFrame`.

- [ ] **Step 4: Write and implement bounded worker layout tests**

Test that reduced motion skips Worker, graphs above 10,000 nodes skip live refinement, normal graphs start ForceAtlas2 with `barnesHutOptimize: true`, the layout stops after 1,200ms, and camera interaction stops it immediately.

- [ ] **Step 5: Implement position cache with injected IndexedDB boundary**

Store `{ fingerprint, positions, savedAt }`, restore matching positions, retain coordinates for unchanged nodes, and ignore corrupt or mismatched entries. Tests use an in-memory adapter, not browser-global IndexedDB.

- [ ] **Step 6: Implement `<GraphCanvas>`**

Mount the adapter once, expose visible loading/error/fallback layers, detect WebGL availability, use ResizeObserver, pause layout on `visibilitychange`, and destroy Sigma/Worker/observer on unmount. The canvas remains visual, while Task 9 supplies accessible DOM navigation.

- [ ] **Step 7: Run renderer tests and typecheck**

Run:

```bash
cd apps/web
npm test -- --run src/features/graph/renderer src/features/graph/layout/position-cache.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit Task 8**

```bash
git add apps/web/src/features/graph/renderer apps/web/src/features/graph/layout/position-cache.ts apps/web/src/features/graph/layout/position-cache.test.ts
git commit -m "feat: add Sigma WebGL graph renderer"
```

---

### Task 9: Obsidian-Style Skill Map Experience and Accessible Fallback

**Files:**
- Create: `apps/web/src/features/graph/components/skill-map.tsx`
- Create: `apps/web/src/features/graph/components/skill-map.module.css`
- Create: `apps/web/src/features/graph/components/skill-map.test.tsx`
- Create: `apps/web/src/features/graph/components/graph-search.tsx`
- Create: `apps/web/src/features/graph/components/graph-inspector.tsx`
- Create: `apps/web/src/features/graph/components/graph-settings.tsx`
- Create: `apps/web/src/features/graph/components/graph-fallback-list.tsx`
- Modify: `apps/web/src/app/skills/graph/page.tsx`
- Delete after replacement tests pass: `apps/web/src/components/skill-graph-experience.tsx`
- Delete after replacement tests pass: `apps/web/src/components/skill-graph-force-canvas.tsx`

**Interfaces:**
- Consumes: Task 7 graph model, Task 8 canvas, `SkillGraphResponse`, owned skills, and Fit response.
- Produces: full-screen graph, search, selected-neighborhood inspector, lazy evidence, settings popover, mobile sheets, and non-WebGL fallback list.

```ts
export type SkillMapProps = {
  graphState: ResourceState<SkillGraphResponse>;
  ownedSkills: string[];
  fitState: ResourceState<FitAnalyzeResponse>;
  onRetry(): void;
};
```

- [ ] **Step 1: Write failing interaction and accessibility tests**

Tests must assert labeled graph search, keyboard ArrowDown/Enter selection, visible node/neighbor DOM list, no fake calendar, visible API error with retry, no permanent settings sidebar, at most 20 evidence rows, and accessible settings/inspector buttons.

- [ ] **Step 2: Run the skill-map test and verify RED**

Run: `cd apps/web && npm test -- --run src/features/graph/components/skill-map.test.tsx`

Expected: FAIL because the rebuilt components do not exist.

- [ ] **Step 3: Implement the desktop composition**

Use a full-bleed graph stage inside the shared shell. Place search and actual graph counts in a compact top overlay, domain legend and controls in a settings popover, and selection detail in a dismissible right drawer. Keep the graph visible behind overlays and reserve no permanent 320px settings column.

- [ ] **Step 4: Implement local selection behavior**

Selecting a node focuses the camera, dims unrelated nodes/edges, opens inspector, renders one/two-hop neighbors from the adjacency index, requests Fit only when needed, and exposes up to 20 supporting postings with internal/detail links.

- [ ] **Step 5: Implement mobile and no-WebGL behavior**

At mobile width, search remains above the graph and settings/inspector open as bottom sheets. Default sampling is 500 nodes/1,500 edges and live force is disabled. If WebGL is unavailable, render searchable skill and neighborhood lists with the same selection model.

- [ ] **Step 6: Rewire the route and remove old graph components**

Use explicit `ready | empty | error` graph state. On API error, render no decorative nodes or signals. Delete the two old graph components only after focused tests pass.

- [ ] **Step 7: Run graph UI and route tests**

Run:

```bash
cd apps/web
npm test -- --run src/features/graph src/app/skills/graph/page.test.tsx
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit Task 9**

```bash
git add apps/web/src/features/graph apps/web/src/app apps/web/src/components/skill-graph-experience.tsx apps/web/src/components/skill-graph-force-canvas.tsx
git commit -m "feat: rebuild the interactive skill map"
```

---

### Task 10: Real Browser Graph Performance Harness

**Files:**
- Create: `apps/web/src/app/__graph-benchmark/page.tsx`
- Create: `apps/web/src/features/graph/performance/fixture.ts`
- Create: `apps/web/src/features/graph/performance/metrics.ts`
- Create: `apps/web/src/features/graph/performance/metrics.test.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/graph-performance.spec.ts`
- Create: `apps/web/scripts/write-graph-performance-report.mjs`
- Modify: `apps/web/package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: guarded benchmark route, 5k CI performance assertion, 10k/50k local reports, and `npm run test:graph-performance`.
- Consumes: actual Task 8 renderer and deterministic graph fixtures.

```ts
export type GraphPerformanceMetrics = {
  nodeCount: number;
  edgeCount: number;
  averageFrameMs: number;
  p95FrameMs: number;
  fps: number;
  longTasks: number[];
  jsHeapBytes: number | null;
};
```

- [ ] **Step 1: Write failing metrics unit tests**

Test frame interval average/p95 calculation, long-task threshold at 200ms, and pass/fail evaluation at 22ms average.

- [ ] **Step 2: Implement deterministic performance fixtures**

Generate 5,000, 10,000, and 50,000 skill nodes with ring, community, and bridge edges. Use the production graph builder and renderer; do not benchmark artifact conversion alone.

- [ ] **Step 3: Implement guarded benchmark route**

The route calls `notFound()` unless `GRAPH_BENCHMARK === "1"`. When enabled, accept only `5000`, `10000`, or `50000` as the node-count query, render the real graph canvas, and expose readiness through `[data-graph-ready="true"]`.

- [ ] **Step 4: Add Playwright measurement**

Start Next on port 3100 with `GRAPH_BENCHMARK=1`, open 5,000 nodes in Chromium, wait for readiness, record animation frame intervals and PerformanceObserver long tasks during scripted pan/zoom, and assert average interval at or below 22ms with no task at or above 200ms.

- [ ] **Step 5: Add local report generation**

The report script runs 10k and 50k without failing on target misses, then writes timestamped JSON and Markdown under `docs/performance/`. Include node/edge counts, browser, viewport, average/p95 frame time, FPS, long tasks, and JS heap when available.

- [ ] **Step 6: Wire package scripts and CI**

Add `test:graph-performance` and `report:graph-performance`. In CI, install Chromium with `npx playwright install --with-deps chromium` after `npm ci`, then run the 5k performance test after unit tests.

- [ ] **Step 7: Run unit and browser performance tests**

Run:

```bash
cd apps/web
npm test -- --run src/features/graph/performance/metrics.test.ts
npx playwright install chromium
npm run test:graph-performance
```

Expected: the unit test passes and the 5k browser fixture satisfies the CI thresholds.

- [ ] **Step 8: Generate the 10k/50k report**

Run: `cd apps/web && npm run report:graph-performance`

Expected: one JSON and one Markdown report appear under `docs/performance/` with both sizes.

- [ ] **Step 9: Commit Task 10**

```bash
git add apps/web/src/app/__graph-benchmark apps/web/src/features/graph/performance apps/web/playwright.config.ts apps/web/e2e apps/web/scripts apps/web/package.json apps/web/package-lock.json .github/workflows/ci.yml docs/performance
git commit -m "test: measure real graph performance"
```

---

### Task 11: Legacy CSS and Component Removal

**Files:**
- Replace: `apps/web/src/app/globals.css`
- Delete unused files under: `apps/web/src/components/dashboard/`
- Delete if unused: `apps/web/src/components/site-header.tsx`
- Delete if replaced: `apps/web/src/components/job-card.tsx`
- Delete if replaced: `apps/web/src/components/job-card.test.tsx`
- Delete: `apps/web/src/lib/graph-renderer.ts`
- Delete: `apps/web/src/lib/graph-renderer.test.ts`
- Delete: `apps/web/src/lib/large-graph.bench.ts`
- Delete or migrate then delete: `apps/web/src/lib/graph-lod.ts`
- Delete or migrate then delete: `apps/web/src/lib/graph-lod.test.ts`
- Modify: remaining imports and CSS contract tests

**Interfaces:**
- Consumes: all replacement features from Tasks 1–10.
- Produces: no legacy `daily-*`, `reference-*`, or `ti-*` selectors and no unused old graph renderer.

- [ ] **Step 1: Write the failing legacy-removal contract test**

Read all production TSX and CSS files and assert absence of `SAMPLE_WEEKLY_JOBS`, `SAMPLE_DEADLINE_JOBS`, `FALLBACK_TRENDS`, `reference-`, `daily-`, `ti-`, `김민준`, `지난주 대비`, and `D-2`. Assert `globals.css` is below 250 lines and contains no feature selectors.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `cd apps/web && npm test -- --run src/styles/legacy-removal.test.ts`

Expected: FAIL with the current legacy selectors and constants.

- [ ] **Step 3: Delete replaced legacy components and libraries**

Use `rg` to prove each file has no remaining import before deleting it. Migrate any still-valid pure transformation into `features/*` before removing the old module.

- [ ] **Step 4: Replace `globals.css`**

Keep only compatibility imports or global root layout rules not already moved to the four foundation styles. Feature selectors belong in CSS Modules. Remove all repeated visual correction passes.

- [ ] **Step 5: Run the whole web test suite and typecheck**

Run:

```bash
cd apps/web
npm test -- --run
npm run lint
```

Expected: PASS with no import errors.

- [ ] **Step 6: Commit Task 11**

```bash
git add -A apps/web/src
git commit -m "refactor: remove legacy frontend system"
```

---

### Task 12: Browser QA, Accessibility, Build, and Final Documentation

**Files:**
- Create: `apps/web/e2e/product-routes.spec.ts`
- Create: `apps/web/e2e/fixture-api.mjs`
- Create: `docs/qa/2026-07-10-frontend-rebuild-verification.md`
- Modify when a verified defect requires it: rebuilt feature or style files only
- Modify: `docs/superpowers/status/2026-07-09-current-implementation-status.md`

**Interfaces:**
- Consumes: complete rebuilt frontend.
- Produces: verified desktop/mobile/light/dark/reduced-motion routes and durable verification record.

- [ ] **Step 1: Add route and accessibility browser checks**

Start `e2e/fixture-api.mjs` on port 4100 and Next with
`API_BASE_URL=http://127.0.0.1:4100`. The fixture server returns deterministic responses for
postings, one posting detail, skill stats, graph, and Fit endpoints. Cover `/`, `/jobs`, the
fixture-backed `/jobs/job-1`, `/skills/graph`, `/data-policy`, `/methodology`, `/privacy`, and
`/corrections`. For 390, 768, and 1440 widths, assert body scrollWidth equals viewport width,
exactly one main exists, every visible button/link has an accessible name, and keyboard
navigation reaches all product routes and stack controls.

- [ ] **Step 2: Capture light, dark, and reduced-motion screenshots**

Capture home, jobs, detail, and graph at 390 and 1440 in light/dark, plus graph in reduced motion. Store verification images in `/tmp` and record inspected outcomes in the QA Markdown; do not commit binary screenshots unless the repository later adopts visual baselines.

- [ ] **Step 3: Run the full verification set**

Run:

```bash
cd apps/web
npm test -- --run
npm run lint
npm run build
npm run test:graph-performance
cd ../..
git diff --check
```

Expected: all commands exit zero.

- [ ] **Step 4: Inspect browser console and responsive layout**

There must be no hydration mismatch, unhandled rejection, missing asset, nested main, horizontal overflow, clipped controls, hidden mobile stack action, or fake data on any checked route.

- [ ] **Step 5: Update durable documentation**

The QA record includes commands, exit codes, viewport matrix, graph performance summary, fixed defects, remaining external-data limitations, and the generated performance report path. Update current implementation status to reference the rebuilt frontend and audit/spec/plan documents.

- [ ] **Step 6: Commit Task 12**

```bash
git add apps/web/e2e docs/qa docs/superpowers/status apps/web/src apps/web/package.json apps/web/package-lock.json
git commit -m "docs: verify rebuilt frontend"
```

- [ ] **Step 7: Run final branch verification**

Run:

```bash
cd apps/web
npm test -- --run
npm run lint
npm run build
npm run test:graph-performance
cd ../..
git status --short
git log --oneline --max-count=15
```

Expected: verification commands exit zero; only the pre-existing untracked `.agents/` may remain outside committed changes.

## Plan Self-Review Coverage

| Spec area | Implementing tasks |
| --- | --- |
| Shared typography, tokens, motion, surface system | 1, 11 |
| Explicit ready/partial/empty/error data states | 2, 4 |
| Removal of fixtures, fixed percentages, fake D-days | 2, 4, 11 |
| Shared route shell and mobile owned-skills access | 3 |
| Honest home dashboard | 4 |
| Jobs explorer, detail trust, metadata, JSON-LD | 5 |
| Data policy, methodology, privacy, corrections, SEO | 6 |
| Graphology model, adjacency, deterministic positions, fingerprint, LOD | 7 |
| Sigma WebGL lifecycle, bounded Worker, position cache | 8 |
| Obsidian-style graph UI, keyboard navigation, fallback | 9 |
| 5k CI and 10k/50k browser performance evidence | 10 |
| Legacy CSS and component removal | 11 |
| Responsive, accessibility, console, build, and final documentation | 12 |

No accepted specification requirement is intentionally deferred beyond this plan.
