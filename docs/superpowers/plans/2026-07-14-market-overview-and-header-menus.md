# Market Overview and Header Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move header disclosure menus below the full desktop header and replace `/market` with a responsive, partial-failure-safe market snapshot built only from existing API data.

**Architecture:** Keep the current AppShell disclosure state and anchors, changing only the desktop vertical offset and extending the existing Playwright contract. Load postings and skill statistics independently in the `/market` server page, transform them through a pure market model, and render a focused feature component with CSS Modules.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Public posting and skill figures must come only from `getPostings` and `getSkillStats`.
- Do not display trends, historical comparisons, predictions, or fabricated percentages.
- Preserve existing AppShell Escape, outside-click, route-close, and focus-return behavior.
- Keep all interactive targets at least 44×44px with visible focus states.
- Add no new runtime dependency, charting library, state manager, or backend endpoint.
- Preserve unrelated user files and existing worktrees.

---

### Task 1: Keep disclosure menus below desktop navigation

**Files:**
- Modify: `apps/web/e2e/header-brand-lockup.e2e.ts`
- Modify: `apps/web/src/components/app-shell/app-shell.module.css`

**Interfaces:**
- Consumes: AppShell buttons named `알림 열기` and `사용자 메뉴 열기`, navigation named `주요 탐색`.
- Produces: A rendered contract where each disclosure starts at least 8px below the desktop navigation bottom at 1536px.

- [ ] **Step 1: Write the failing browser test**

Append this test to `header-brand-lockup.e2e.ts`:

```ts
test("keeps utility menus below the desktop navigation", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1536 });
  await page.goto("/privacy");

  const navigation = page.getByRole("navigation", { name: "주요 탐색" });
  const navigationBox = await navigation.boundingBox();
  expect(navigationBox).not.toBeNull();

  for (const control of [
    { button: "알림 열기", menu: "알림" },
    { button: "사용자 메뉴 열기", menu: "사용자 메뉴" },
  ]) {
    await page.getByRole("button", { name: control.button }).click();
    const menu = page.getByLabel(control.menu, { exact: true });
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.y).toBeGreaterThanOrEqual(
      navigationBox!.y + navigationBox!.height + 8,
    );
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  }
});
```

- [ ] **Step 2: Run the test and confirm the current overlap**

Run:

```bash
cd apps/web
CI=1 npm run test:e2e -- --reporter=line --grep "below the desktop navigation"
```

Expected: FAIL because the menu starts around `y=63.5` while the navigation ends around `y=111`.

- [ ] **Step 3: Add the desktop-only offset**

Add this rule after the mobile layout block and before the 520px block:

```css
@media (min-width: 821px) {
  .menu {
    top: calc(100% + 4.125rem);
  }
}
```

This preserves horizontal anchoring and yields an approximately 9px gap below the 112px header without changing tablet or mobile menu placement.

- [ ] **Step 4: Run header browser and component tests**

Run:

```bash
CI=1 npm run test:e2e -- --reporter=line
npm test -- --run src/components/app-shell/app-shell.test.tsx
```

Expected: 7 Playwright tests and 6 AppShell tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/header-brand-lockup.e2e.ts apps/web/src/components/app-shell/app-shell.module.css
git commit -m "fix: place header menus below navigation"
```

---

### Task 2: Build the market snapshot model

**Files:**
- Create: `apps/web/src/features/market/model.ts`
- Create: `apps/web/src/features/market/model.test.ts`

**Interfaces:**
- Consumes: `ResourceState<PostingListResponse>`, `ResourceState<SkillStatsResponse>`, and a normalized `MarketCareerType`.
- Produces: `normalizeMarketCareerType`, `buildMarketJobsHref`, and `buildMarketOverviewSnapshot`.

- [ ] **Step 1: Write failing model tests**

Create `model.test.ts` with fixtures covering normalization, URL construction, invalid dates, missing requirement counts, sorting, and partial failure:

```ts
import { describe, expect, it } from "vitest";

import type { PostingListResponse, SkillStatsResponse } from "@/lib/types";

import {
  buildMarketJobsHref,
  buildMarketOverviewSnapshot,
  normalizeMarketCareerType,
} from "./model";

const postings: PostingListResponse = {
  total: 2,
  items: [
    {
      id: "job-new",
      title: "플랫폼 엔지니어",
      company_name: "새회사",
      career_type: "experienced",
      employment_type: "full_time",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://example.com/jobs/new",
      last_verified_at: "2026-07-14T03:00:00Z",
    },
    {
      id: "job-old",
      title: "백엔드 엔지니어",
      company_name: "예시회사",
      career_type: "experienced",
      employment_type: "full_time",
      career_min: 2,
      career_max: 5,
      location: null,
      status: "open",
      source_url: "https://example.org/jobs/old",
      last_verified_at: "invalid-date",
    },
  ],
};

const skillStats: SkillStatsResponse = {
  total: 2,
  items: [
    {
      skill: "Kubernetes",
      category: "infra",
      count: 12,
      required_count: 5,
      preferred_count: 4,
      unspecified_count: 3,
    },
    { skill: "Go", category: "language", count: 8 },
  ],
};

describe("market overview model", () => {
  it("normalizes only supported career filters", () => {
    expect(normalizeMarketCareerType("new_comer")).toBe("new_comer");
    expect(normalizeMarketCareerType(["experienced", "mixed"])).toBe("experienced");
    expect(normalizeMarketCareerType("unknown")).toBe("");
  });

  it("preserves the career filter in related job searches", () => {
    expect(buildMarketJobsHref("C++", "experienced")).toBe(
      "/jobs?q=C%2B%2B&career_type=experienced",
    );
    expect(buildMarketJobsHref("Go", "")).toBe("/jobs?q=Go");
  });

  it("builds an honest snapshot from ready API resources", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "experienced",
      postings: { status: "ready", data: postings },
      skillStats: { status: "ready", data: skillStats },
    });

    expect(snapshot.postingTotal).toBe(2);
    expect(snapshot.skillTotal).toBe(2);
    expect(snapshot.latestVerifiedAt).toBe("2026-07-14T03:00:00Z");
    expect(snapshot.skills[0]).toMatchObject({
      name: "Kubernetes",
      postingCount: 12,
      requiredCount: 5,
      preferredCount: 4,
      unspecifiedCount: 3,
      relativeDemand: 100,
    });
    expect(snapshot.skills[1]).toMatchObject({
      name: "Go",
      requiredCount: 0,
      preferredCount: 0,
      unspecifiedCount: 0,
    });
    expect(snapshot.jobs.map((job) => job.id)).toEqual(["job-new", "job-old"]);
  });

  it("keeps ready data when the other resource fails", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "",
      postings: { status: "error", message: "공고 데이터를 불러오지 못했습니다." },
      skillStats: { status: "ready", data: skillStats },
    });

    expect(snapshot.postingTotal).toBeNull();
    expect(snapshot.postingError).toBe("공고 데이터를 불러오지 못했습니다.");
    expect(snapshot.skills).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the model test and verify failure**

Run:

```bash
npm test -- --run src/features/market/model.test.ts
```

Expected: FAIL because `./model` does not exist.

- [ ] **Step 3: Implement the pure model**

Create `model.ts` with these exported contracts and behavior:

```ts
import { formatCareer, formatEmployment } from "@/lib/labels";
import type {
  PostingListResponse,
  SkillStatsResponse,
} from "@/lib/types";
import type { ResourceState } from "@/features/home-feed/resource-state";

export type MarketCareerType = "" | "new_comer" | "experienced" | "mixed";

export const MARKET_CAREER_FILTERS = [
  { value: "", label: "전체" },
  { value: "new_comer", label: "신입" },
  { value: "experienced", label: "경력" },
  { value: "mixed", label: "신입·경력" },
] as const satisfies ReadonlyArray<{ value: MarketCareerType; label: string }>;

const SUPPORTED = new Set<MarketCareerType>(["", "new_comer", "experienced", "mixed"]);

export function normalizeMarketCareerType(
  value: string | string[] | undefined,
): MarketCareerType {
  const first = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  return SUPPORTED.has(first as MarketCareerType) ? first as MarketCareerType : "";
}

export function buildMarketFilterHref(careerType: MarketCareerType) {
  return careerType ? `/market?career_type=${careerType}` : "/market";
}

export function buildMarketJobsHref(skill: string, careerType: MarketCareerType) {
  const params = new URLSearchParams({ q: skill });
  if (careerType) params.set("career_type", careerType);
  return `/jobs?${params.toString()}`;
}

function latestDate(values: string[]) {
  return values
    .filter((value) => !Number.isNaN(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

export function buildMarketOverviewSnapshot(input: {
  careerType: MarketCareerType;
  postings: ResourceState<PostingListResponse>;
  skillStats: ResourceState<SkillStatsResponse>;
}) {
  const postings = input.postings.status === "ready" ? input.postings.data : null;
  const stats = input.skillStats.status === "ready" ? input.skillStats.data : null;
  const orderedSkills = [...(stats?.items ?? [])].sort(
    (left, right) => right.count - left.count || left.skill.localeCompare(right.skill),
  );
  const maxDemand = Math.max(1, ...orderedSkills.map((item) => item.count));

  return {
    careerType: input.careerType,
    postingTotal: postings?.total ?? null,
    skillTotal: stats?.items.length ?? null,
    latestVerifiedAt: latestDate((postings?.items ?? []).map((item) => item.last_verified_at)),
    postingError: input.postings.status === "error" ? input.postings.message : null,
    skillError: input.skillStats.status === "error" ? input.skillStats.message : null,
    skills: orderedSkills.map((item) => ({
      name: item.skill,
      category: item.category,
      postingCount: item.count,
      requiredCount: item.required_count ?? 0,
      preferredCount: item.preferred_count ?? 0,
      unspecifiedCount: item.unspecified_count ?? 0,
      relativeDemand: Math.round((item.count / maxDemand) * 100),
      skillHref: `/skill-map?skill=${encodeURIComponent(item.skill)}`,
      jobsHref: buildMarketJobsHref(item.skill, input.careerType),
    })),
    jobs: (postings?.items ?? []).slice(0, 5).map((item) => ({
      id: item.id,
      companyName: item.company_name,
      title: item.title,
      careerLabel: formatCareer(item.career_type),
      employmentLabel: formatEmployment(item.employment_type),
      location: item.location ?? "근무지 미기재",
      verifiedAt: item.last_verified_at,
      href: `/jobs/${encodeURIComponent(item.id)}`,
    })),
  };
}

export type MarketOverviewSnapshot = ReturnType<typeof buildMarketOverviewSnapshot>;
```

- [ ] **Step 4: Run the model tests**

Run:

```bash
npm test -- --run src/features/market/model.test.ts
```

Expected: all market model tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/market/model.ts apps/web/src/features/market/model.test.ts
git commit -m "feat: model live market snapshot"
```

---

### Task 3: Replace the market route shell with the live overview

**Files:**
- Create: `apps/web/src/features/market/market-overview.tsx`
- Create: `apps/web/src/features/market/market-overview.module.css`
- Create: `apps/web/src/features/market/market-overview.test.tsx`
- Create: `apps/web/src/app/market/page.test.tsx`
- Modify: `apps/web/src/app/market/page.tsx`

**Interfaces:**
- Consumes: `MarketOverviewSnapshot` from Task 2 and existing `settledResource`, `getPostings`, `getSkillStats`.
- Produces: A dynamic `/market` route with URL career filters, metrics, skill ranking, recent real postings, and independent failure states.

- [ ] **Step 1: Write component and page tests**

The component test must render a ready snapshot and assert:

```ts
expect(screen.getByRole("heading", { name: "채용 시장", level: 1 })).toBeInTheDocument();
expect(screen.getByText("확인 공고").closest("div")).toHaveTextContent("2건");
expect(screen.getByText(/최대 100개/)).toBeInTheDocument();
expect(screen.getByText(/상위 최대 30개/)).toBeInTheDocument();
expect(screen.getByRole("link", { name: "Kubernetes 스킬맵" })).toHaveAttribute(
  "href",
  "/skill-map?skill=Kubernetes",
);
expect(screen.getByRole("link", { name: "Kubernetes 관련 공고" })).toHaveAttribute(
  "href",
  "/jobs?q=Kubernetes&career_type=experienced",
);
expect(screen.queryByText(/증가|감소|실시간|예측/)).not.toBeInTheDocument();
```

It must also render a partial-failure snapshot and assert that the safe error appears while the ready skill list remains visible.

The page test must mock `@/lib/api`, call `MarketPage({ searchParams: Promise.resolve({ career_type: "experienced" }) })`, render the result, and assert:

```ts
expect(getPostings).toHaveBeenCalledWith({ career_type: "experienced", limit: 100 });
expect(getSkillStats).toHaveBeenCalledWith({ career_type: "experienced", limit: 30 });
```

- [ ] **Step 2: Run both tests and confirm failure**

Run:

```bash
npm test -- --run src/features/market/market-overview.test.tsx src/app/market/page.test.tsx
```

Expected: FAIL because the new component does not exist and the route still renders `RouteShell`.

- [ ] **Step 3: Implement the server route**

Replace `app/market/page.tsx` with a force-dynamic server page that:

```ts
const careerType = normalizeMarketCareerType(resolvedSearchParams.career_type);
const filter = careerType ? { career_type: careerType } : {};
const [postings, skillStats] = await Promise.all([
  settledResource(
    getPostings({ ...filter, limit: 100 }),
    "공고 데이터를 불러오지 못했습니다.",
  ),
  settledResource(
    getSkillStats({ ...filter, limit: 30 }),
    "기술 수요 데이터를 불러오지 못했습니다.",
  ),
]);

return (
  <MarketOverview
    snapshot={buildMarketOverviewSnapshot({ careerType, postings, skillStats })}
  />
);
```

Keep the existing metadata title and update the description to state that the page shows current official posting data.

- [ ] **Step 4: Implement semantic market markup**

`market-overview.tsx` must contain:

- `<main>` with the title, source description, and `현재 수집 데이터` badge.
- `<nav aria-label="경력 조건">` with four links and `aria-current` on the selected filter.
- `<section aria-labelledby="market-snapshot-title">` with public posting, confirmed skill, and latest verification values.
- `<section aria-labelledby="skill-demand-title">` with an ordered skill list, text requirement counts, decorative demand bars, and two named links per skill.
- `<aside aria-labelledby="recent-jobs-title">` with up to five API jobs or a safe error/empty state.
- A method note linking to `/methodology` and `/data-policy`.

Format valid dates with `Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" })`; render `확인 시각 없음` for null or invalid values.

- [ ] **Step 5: Implement responsive CSS**

The CSS Module must use these concrete layout rules:

```css
.page {
  width: min(100%, 72rem);
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4.5rem) clamp(1rem, 3vw, 2.5rem) 5rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter {
  display: inline-flex;
  min-height: var(--touch-target);
  align-items: center;
  padding: 0 0.875rem;
  border: 1px solid var(--color-line);
  border-radius: 0.625rem;
}

.filter[aria-current="page"] {
  border-color: color-mix(in srgb, var(--color-accent) 28%, var(--color-line));
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid var(--color-line);
}

.contentGrid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(17rem, 20rem);
  gap: 1.5rem;
  align-items: start;
}

.skillItem {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) minmax(12rem, 1.3fr) auto;
  gap: 1rem;
  min-width: 0;
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-line-soft);
}

@media (max-width: 960px) {
  .contentGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .metrics {
    grid-template-columns: 1fr;
  }

  .skillItem {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }
}
```

Add the remaining named rules exactly as follows:

```css
.intro,
.sectionHeader,
.jobList,
.method {
  display: grid;
}

.intro {
  max-width: 48rem;
  gap: 0.75rem;
}

.eyebrow,
.metric span,
.category,
.counts,
.verified {
  color: var(--color-muted);
  font-size: 0.8125rem;
}

.eyebrow {
  margin: 0;
  color: var(--color-accent-strong);
  font-weight: 800;
}

.title,
.description,
.sectionHeader h2,
.sectionHeader p,
.metric strong,
.job h3,
.job p,
.method p {
  margin: 0;
}

.title {
  color: var(--color-text);
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.description {
  max-width: 42rem;
  color: var(--color-muted);
  font-size: 1rem;
  line-height: 1.7;
}

.badge {
  width: fit-content;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  font-size: 0.75rem;
  font-weight: 800;
}

.filter:hover,
.filter:focus-visible,
.skillLink:hover,
.skillLink:focus-visible,
.job:hover,
.job:focus-visible,
.textLink:hover,
.textLink:focus-visible {
  color: var(--color-accent-strong);
}

.filter:focus-visible,
.skillLink:focus-visible,
.job:focus-visible,
.textLink:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-accent) 28%, transparent);
  outline-offset: 2px;
}

.metric {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
  padding: 1.25rem 1rem;
}

.metric + .metric {
  border-left: 1px solid var(--color-line);
}

.metric strong {
  color: var(--color-text);
  font-size: clamp(1.25rem, 3vw, 1.75rem);
}

.contentGrid,
.metrics,
.filters {
  margin-top: 2rem;
}

.panel {
  min-width: 0;
  padding: 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.sectionHeader {
  gap: 0.375rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-line-soft);
}

.sectionHeader h2 {
  color: var(--color-text);
  font-size: 1.125rem;
}

.sectionHeader p,
.method p {
  color: var(--color-muted);
  line-height: 1.65;
}

.skillList,
.jobList {
  margin: 0;
  padding: 0;
  list-style: none;
}

.skillHead,
.skillActions,
.counts,
.jobMeta,
.methodLinks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.skillHead,
.jobMeta {
  gap: 0.5rem;
}

.skillLink,
.job,
.textLink {
  color: var(--color-text);
  text-decoration: none;
}

.skillLink {
  font-weight: 800;
}

.category {
  padding: 0.25rem 0.4375rem;
  border-radius: 0.375rem;
  background: var(--color-surface-muted);
}

.demand {
  display: grid;
  min-width: 0;
  gap: 0.5rem;
}

.barTrack {
  height: 0.375rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-muted);
}

.bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent);
}

.counts {
  gap: 0.75rem;
}

.skillActions {
  justify-content: flex-end;
  gap: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
}

.jobList {
  gap: 0;
}

.job {
  display: grid;
  min-height: var(--touch-target);
  gap: 0.375rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-line-soft);
}

.job h3 {
  font-size: 0.9375rem;
  line-height: 1.45;
}

.job p,
.jobMeta {
  color: var(--color-muted);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.state {
  padding: 1.25rem 0;
  color: var(--color-muted);
  line-height: 1.6;
}

.method {
  gap: 0.5rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-line);
}

.methodLinks {
  gap: 1rem;
}

.textLink {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  color: var(--color-accent-strong);
  font-weight: 750;
}

@media (max-width: 640px) {
  .metric + .metric {
    border-top: 1px solid var(--color-line);
    border-left: 0;
  }

  .skillActions {
    justify-content: flex-start;
  }
}
```

- [ ] **Step 6: Run focused tests and TypeScript**

Run:

```bash
npm test -- --run src/features/market/model.test.ts src/features/market/market-overview.test.tsx src/app/market/page.test.tsx
npm run lint
```

Expected: all focused tests and TypeScript pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/market apps/web/src/features/market
git commit -m "feat: build live hiring market overview"
```

---

### Task 4: Verify the complete experience

**Files:**
- No source file is expected to change; any failed assertion returns to the task that owns that file.

**Interfaces:**
- Consumes: completed header menu and market overview.
- Produces: review-ready commits with automated and manual evidence.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
cd apps/web
rm -rf .next
npm test -- --run
CI=1 npm run test:e2e -- --reporter=line
npm run lint
VERCEL=1 VERCEL_ENV=production \
  VERCEL_PROJECT_PRODUCTION_URL=ejik-fit-web.vercel.app \
  API_BASE_URL=https://ejik-fit-api.vercel.app \
  npm run build
```

Expected: all Vitest and Playwright tests, TypeScript, and the production build pass.

- [ ] **Step 2: Inspect responsive layouts with real API data**

Start the production build with `API_BASE_URL=https://ejik-fit-api.vercel.app` and inspect `/market` at 1440px, 820px, and 390px. Confirm:

- No horizontal overflow.
- All four career filters are reachable and update the URL.
- Metrics and skill counts match the API response.
- Ranking collapses to one column on mobile.
- Notification and user menus do not overlap desktop navigation.
- Browser console contains no errors.

- [ ] **Step 3: Run an independent code review**

Request review from base `3a0f169` to the feature head. Resolve every Critical and Important finding and rerun the affected checks.

- [ ] **Step 4: Integrate and deploy**

Fast-forward the reviewed branch into `main`, rerun the merged web checks, push `main`, and monitor GitHub backend/web CI plus Vercel API/web deployments until all succeed. Confirm `/market` returns HTTP 200 and repeat the live menu overlap assertion.
