# Community Feed Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard-style home and left application rail with an interactive, responsive community feed that combines mock community content with real posting, skill, and market data.

**Architecture:** Keep the existing Next.js App Router, API client, posting pages, skill graph, and trust pages. A server page loads the three existing API resources, pure model functions translate only verified API fields into typed feed items, and a focused client island provides feed tabs, reactions, saves, and local post composition. The shared application shell becomes a two-row desktop header and mobile bottom navigation.

**Tech Stack:** Next.js 16.2.10, React 19.2, TypeScript 5.8, CSS Modules, Vitest, Testing Library, Pretendard Variable, Phosphor Icons

## Global Constraints

- Community questions, interview reviews, comment previews, mock authors, and community reaction counts may use typed mock data.
- Posting, skill, market, source, sample-size, required-count, and preferred-count values must come only from existing API responses.
- Do not show historical trend percentages, projected job-count increases, acceptance probability, or precision fit scores because the API does not provide those facts.
- Preserve `/jobs`, `/jobs/[id]`, `/skills/graph`, trust pages, the API contract, and local owned-skill storage.
- Use the provided reference image for hierarchy and density, not for copied people, copy, or third-party logos.
- Use official company assets only when their source and usage are verifiable; otherwise render a deterministic initials mark.
- Add no UI framework, charting package, state library, or runtime logo service.
- Keep purple below roughly five percent of the visible interface and reserve it for active navigation, primary actions, selected tabs, and important links.
- Keep touch targets at least 44px and support keyboard focus, Escape dismissal, `aria-current`, `aria-selected`, and `aria-pressed`.
- Work test-first and commit each independently reviewable task.

---

## File Structure

### New files

- `docs/handoff/2026-07-13-community-feed-home-reference.png` — generated implementation reference derived from the supplied screenshot.
- `apps/web/src/features/home-feed/types.ts` — discriminated feed item and home snapshot contracts.
- `apps/web/src/features/home-feed/mock-community.ts` — typed mock community and interview-review content.
- `apps/web/src/features/home-feed/resource-state.ts` — shared settled-resource state used by the new home.
- `apps/web/src/features/home-feed/model.ts` — pure translation of API resources into honest feed items and side-rail summaries.
- `apps/web/src/features/home-feed/model.test.ts` — model trust-boundary and partial-failure tests.
- `apps/web/src/features/home-feed/feed-order.ts` and `feed-order.test.ts` — deterministic tab rules.
- `apps/web/src/features/home-feed/company-identity.ts` and `company-identity.test.ts` — verified logo lookup and initials fallback.
- `apps/web/src/features/home-feed/company-mark.tsx` — fixed-size logo or initials renderer.
- `apps/web/src/features/home-feed/home-feed.tsx`, `home-feed.test.tsx`, and `home-feed.module.css` — interactive home and responsive styling.
- `apps/web/src/components/route-shell/route-shell.tsx`, `route-shell.test.tsx`, and `route-shell.module.css` — honest future-route shell.
- `apps/web/src/lib/product-routes.ts` and `product-routes.test.ts` — skill-map compatibility URL conversion.
- `apps/web/src/app/market/page.tsx`, `career/page.tsx`, `posts/[id]/page.tsx`, and `skill-map/page.tsx` — new product routes.
- `apps/web/public/company-logos/naver.svg`, `kakao.svg`, optional verified `line-plus.svg`, and `SOURCES.md` — local company identity assets and provenance.

### Modified files

- `apps/web/src/app/page.tsx` and `page.test.tsx` — new server home integration.
- `apps/web/src/app/loading.tsx`, `layout.tsx`, and `sitemap.ts` — feed loading, product metadata, and routes.
- `apps/web/src/app/skills/graph/page.tsx` and `page.test.tsx` — accept a `seed` search parameter.
- `apps/web/src/components/app-shell/app-shell.tsx`, its module CSS, and tests — new header and mobile navigation.
- `apps/web/src/features/owned-skills/owned-skills-sheet.tsx` and tests — report skill changes.
- `apps/web/src/styles/tokens.css` and `design-system.test.ts` — approved semantic light palette.
- `apps/web/src/app/globals.css` — remove only proven-unused dashboard-home rules.

### Removed files after reference audit

- `apps/web/src/features/dashboard/dashboard-home.tsx`
- `apps/web/src/features/dashboard/dashboard-home.module.css`
- `apps/web/src/features/dashboard/dashboard-home.test.tsx`
- `apps/web/src/features/dashboard/model.ts`
- `apps/web/src/features/dashboard/model.test.ts`
- `apps/web/src/features/dashboard/state.ts`
- `apps/web/src/features/dashboard/state.test.ts`

Do not remove `apps/web/src/components/dashboard/**` until `rg` proves that surviving pages do not import those files.

---

### Task 1: Generate and lock the implementation reference

> 실행 기록 (2026-07-13): built-in 이미지 생성이 두 차례 타임아웃됐고 CLI fallback에 필요한 `OPENAI_API_KEY`가 설정되지 않았다. 사용자가 추가 생성 이미지를 생략하고 `docs/handoff/image.png`를 직접 구현 기준으로 사용하는 것을 명시적으로 승인했다. 따라서 이 Task의 생성 파일과 설계 문서 추가 항목은 만들지 않으며, 원본 이미지를 original detail로 검토한 결과를 이후 시각 검증 기준으로 사용한다.

**Files:**
- Create: `docs/handoff/2026-07-13-community-feed-home-reference.png`
- Modify: `docs/superpowers/specs/2026-07-13-community-feed-home-design.md`

**Interfaces:**
- Consumes: `docs/handoff/image.png` and the approved design spec.
- Produces: one large horizontal reference used for later visual verification.

- [ ] **Step 1: Generate one fresh home reference from the supplied screenshot**

Use the image-generation tool with `docs/handoff/image.png` as the referenced image. Require a single 1536×1024 Korean desktop product screen with a two-row header, 232/744/300 three-column layout, text-first feed, restrained violet accent, verified-data cards without historical trend claims, neutral mock community avatars, and logo-or-initial company marks. Exclude copied screenshot logos, gradients, glow, glass effects, and precision fit scores.

- [ ] **Step 2: Inspect the generated image at original resolution**

Confirm the first feed card is visible at 1024px height, the middle column dominates, Korean text is readable, side rails are quieter, the page is not an analytics dashboard, and no unverified trend or prediction appears. Regenerate the full image if a check fails. Do not crop the supplied reference.

- [ ] **Step 3: Record the visual decision**

Add this exact subsection to the design spec:

```markdown
### 구현 레퍼런스

구현 시각 기준은 `docs/handoff/2026-07-13-community-feed-home-reference.png`다. 원본 레퍼런스의 3열 정보 계층을 유지하면서 헤더 높이, 데이터 신뢰 표현, 로고 fallback, 작은 노트북의 첫 화면 가시성을 이직핏 코드와 데이터 계약에 맞게 조정한 이미지다.
```

- [ ] **Step 4: Commit the reference**

```bash
git add docs/handoff/2026-07-13-community-feed-home-reference.png docs/superpowers/specs/2026-07-13-community-feed-home-design.md
git commit -m "docs: add community home visual reference"
```

---

### Task 2: Build the honest mixed-feed domain model

**Files:**
- Create: `apps/web/src/features/home-feed/types.ts`
- Create: `apps/web/src/features/home-feed/mock-community.ts`
- Create: `apps/web/src/features/home-feed/resource-state.ts`
- Create: `apps/web/src/features/home-feed/model.ts`
- Create: `apps/web/src/features/home-feed/model.test.ts`

**Interfaces:**
- Consumes: `PostingListResponse`, `SkillStatsResponse`, `SkillGraphResponse`, and `string[] ownedSkills`.
- Produces: `settledResource<T>(promise): Promise<ResourceState<T>>` and `buildHomeFeedSnapshot(input): HomeFeedSnapshot`.

- [ ] **Step 1: Write failing trust-boundary tests**

Create one API posting, one skill-stat row, one graph evidence row, and two mock social items. Assert:

```ts
expect(snapshot.feedItems.map((item) => item.type)).toEqual([
  "community_post",
  "recommended_job",
  "interview_review",
  "market_insight",
]);
expect(snapshot.recommendedJobs[0]).toMatchObject({
  companyName: "토스",
  matchedRequiredSkills: ["Java"],
  missingRequiredSkills: ["Spring"],
  matchedPreferredSkills: ["Kafka"],
});
expect(snapshot.marketInsights[0]).toMatchObject({
  skillName: "Kubernetes",
  postingCount: 14,
  requiredCount: 8,
  preferredCount: 4,
});
expect(snapshot.skillDemand).toEqual([
  { skillName: "Kubernetes", postingCount: 14, requiredCount: 8, preferredCount: 4 },
]);
expect(JSON.stringify(snapshot)).not.toContain("trendPercent");
expect(JSON.stringify(snapshot)).not.toContain("matchScore");
```

Add a partial-failure test: graph fails, postings succeed, `dataStatus` is `partial`, community and verified job items remain, and the graph error appears once.

- [ ] **Step 2: Run the new test and verify failure**

```bash
npm test -- --run src/features/home-feed/model.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Define the public contracts**

```ts
export type FeedTab = "recommended" | "following" | "latest" | "popular";
export type DataStatus = "ready" | "partial" | "empty" | "error";
export type SocialMetrics = { reactions: number; comments: number; saves: number };

export type CommunityPostFeedItem = {
  id: string; type: "community_post"; category: "이직 고민" | "커리어 질문" | "업무 이야기";
  authorName: string; authorHeadline: string; authorTone: "violet" | "blue" | "green" | "orange";
  isFollowing: boolean; createdAt: string; createdLabel: string; title: string; body: string;
  tags: string[]; href: string; metrics: SocialMetrics; source: "mock" | "local";
};

export type InterviewReviewFeedItem = {
  id: string; type: "interview_review"; category: "면접 후기"; authorName: string;
  authorHeadline: string; authorTone: "violet" | "blue" | "green" | "orange";
  isFollowing: boolean; createdAt: string; createdLabel: string; companyType: string;
  role: string; stage: string; title: string; summary: string; tags: string[]; href: string;
  metrics: SocialMetrics; source: "mock";
};

export type MarketInsightFeedItem = {
  id: string; type: "market_insight"; skillName: string; title: string; summary: string;
  postingCount: number; requiredCount: number; preferredCount: number; sampleLabel: string;
  sourceLabel: string; href: string; source: "api";
};

export type RecommendedJobFeedItem = {
  id: string; type: "recommended_job"; companyName: string; title: string; location: string;
  careerLabel: string; employmentLabel: string; sourceUrl: string; verifiedLabel: string;
  matchedRequiredSkills: string[]; missingRequiredSkills: string[]; matchedPreferredSkills: string[];
  href: string; source: "api";
};

export type SkillDemandSummary = {
  skillName: string; postingCount: number; requiredCount: number; preferredCount: number;
};

export type FeedItem = CommunityPostFeedItem | InterviewReviewFeedItem | MarketInsightFeedItem | RecommendedJobFeedItem;
export type HomeFeedSnapshot = {
  dataStatus: DataStatus; feedItems: FeedItem[];
  communityItems: Array<CommunityPostFeedItem | InterviewReviewFeedItem>;
  recommendedJobs: RecommendedJobFeedItem[]; marketInsights: MarketInsightFeedItem[];
  skillDemand: SkillDemandSummary[];
  ownedSkills: string[]; postingCount: number; sourceCount: number; lastVerifiedAt: string | null;
  resourceErrors: string[];
};
```

- [ ] **Step 4: Add deterministic mock content**

Create four questions and two interview reviews. Use `서버정원`, `코드산책`, `데이터곰`, and `제품너머`. Use `국내 플랫폼 기업` and `B2B SaaS 기업`, never real companies. Dates differ, tags map to product routes, and reaction counts are irregular.

- [ ] **Step 5: Implement resource settlement and translation**

```ts
export type ResourceState<T> = { status: "ready"; data: T } | { status: "error"; message: string };
export async function settledResource<T>(promise: Promise<T>): Promise<ResourceState<T>>;
export type BuildHomeFeedSnapshotInput = {
  postings: ResourceState<PostingListResponse>;
  skillStats: ResourceState<SkillStatsResponse>;
  graph: ResourceState<SkillGraphResponse>;
  ownedSkills: string[];
};
export function buildHomeFeedSnapshot(input: BuildHomeFeedSnapshotInput): HomeFeedSnapshot;
```

Normalize skills case-insensitively, derive requirement matches from evidence, avoid invented nullable values, count source hosts, retain the top five API skill-demand rows, create at most two job and two market feed items, and merge in this order when available: first question, first job, first review, first insight, second question, second job, second insight, remaining social items.

- [ ] **Step 6: Run and commit**

```bash
npm test -- --run src/features/home-feed/model.test.ts
git add apps/web/src/features/home-feed/types.ts apps/web/src/features/home-feed/mock-community.ts apps/web/src/features/home-feed/resource-state.ts apps/web/src/features/home-feed/model.ts apps/web/src/features/home-feed/model.test.ts
git commit -m "feat: model mixed community and market feed"
```

Expected: PASS before commit.

### Task 3: Add deterministic feed ordering

**Files:**
- Create: `apps/web/src/features/home-feed/feed-order.ts`
- Create: `apps/web/src/features/home-feed/feed-order.test.ts`

**Interfaces:**
- Consumes: `FeedItem[]` and `FeedTab` from Task 2.
- Produces: `itemsForTab(items: FeedItem[], tab: FeedTab): FeedItem[]`.

- [ ] **Step 1: Write failing ordering tests**

```ts
expect(itemsForTab(items, "recommended").map(({ id }) => id)).toEqual(["community-1", "job-1", "review-1", "market-1"]);
expect(itemsForTab(items, "following").map(({ id }) => id)).toEqual(["community-1"]);
expect(itemsForTab(items, "latest").map(({ id }) => id)).toEqual(["review-1", "community-1", "job-1", "market-1"]);
expect(itemsForTab(items, "popular").map(({ id }) => id)).toEqual(["review-1", "community-1"]);
```

Use dates and metrics that make the order unambiguous. `popular` contains only social items and scores `reactions + comments * 2 + saves`.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --run src/features/home-feed/feed-order.test.ts
```

Expected: FAIL because `itemsForTab` is missing.

- [ ] **Step 3: Implement without mutating input**

```ts
export function itemsForTab(items: FeedItem[], tab: FeedTab): FeedItem[] {
  if (tab === "recommended") return [...items];
  if (tab === "following") {
    return items.filter((item) => (item.type === "community_post" || item.type === "interview_review") && item.isFollowing);
  }
  if (tab === "latest") {
    return [...items].sort((left, right) => {
      const rightTime = "createdAt" in right ? Date.parse(right.createdAt) : 0;
      const leftTime = "createdAt" in left ? Date.parse(left.createdAt) : 0;
      return rightTime - leftTime;
    });
  }
  return items
    .filter((item): item is CommunityPostFeedItem | InterviewReviewFeedItem => item.type === "community_post" || item.type === "interview_review")
    .sort((left, right) => {
      const leftScore = left.metrics.reactions + left.metrics.comments * 2 + left.metrics.saves;
      const rightScore = right.metrics.reactions + right.metrics.comments * 2 + right.metrics.saves;
      return rightScore - leftScore;
    });
}
```

- [ ] **Step 4: Run and commit**

```bash
npm test -- --run src/features/home-feed/feed-order.test.ts
git add apps/web/src/features/home-feed/feed-order.ts apps/web/src/features/home-feed/feed-order.test.ts
git commit -m "feat: add home feed tab ordering"
```

Expected: PASS before commit.

---

### Task 4: Add company identity resolution and verified assets

**Files:**
- Create: `apps/web/src/features/home-feed/company-identity.ts`
- Create: `apps/web/src/features/home-feed/company-identity.test.ts`
- Create: `apps/web/src/features/home-feed/company-mark.tsx`
- Create: `apps/web/public/company-logos/naver.svg`
- Create: `apps/web/public/company-logos/kakao.svg`
- Create after successful verification: `apps/web/public/company-logos/line-plus.svg`
- Create: `apps/web/public/company-logos/SOURCES.md`

**Interfaces:**
- Consumes: `companyName: string` and optional `sourceUrl: string`.
- Produces: `companyIdentity(companyName, sourceUrl): CompanyIdentity` and `<CompanyMark companyName sourceUrl size />`.

- [ ] **Step 1: Write failing resolver tests**

```ts
expect(companyIdentity("네이버", "https://recruit.navercorp.com/jobs/1")).toEqual({ kind: "logo", src: "/company-logos/naver.svg", alt: "네이버 로고", initials: "네" });
expect(companyIdentity("카카오", "https://careers.kakao.com/jobs/1").src).toBe("/company-logos/kakao.svg");
expect(companyIdentity("DeepAuto.ai", "https://deepauto-ai.career.greetinghr.com/ko")).toEqual({ kind: "initials", initials: "DA", alt: "DeepAuto.ai" });
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --run src/features/home-feed/company-identity.test.ts
```

Expected: FAIL because the resolver is missing.

- [ ] **Step 3: Locate official assets and record provenance**

Use web search only to reach each company’s official corporate, newsroom, or brand page. Save only assets whose official page makes reuse or download available. Record a concrete official URL, retrieval date `2026-07-13`, and usage note `Displayed only to identify the company beside its posting.` for every stored file in `SOURCES.md`. If LINE Plus terms are unclear, keep initials fallback and do not map a logo path.

- [ ] **Step 4: Implement resolver and renderer**

```ts
export type CompanyIdentity = {
  kind: "logo" | "initials";
  src?: string;
  alt: string;
  initials: string;
};
export function companyIdentity(companyName: string, sourceUrl?: string): CompanyIdentity;
```

Normalize spaces, punctuation, English case, and known aliases. Match only stored assets with recorded provenance. The renderer uses a fixed square frame, `object-fit: contain`, and `aria-hidden="true"` when adjacent text repeats the company name.

- [ ] **Step 5: Run and commit**

```bash
npm test -- --run src/features/home-feed/company-identity.test.ts
git add apps/web/src/features/home-feed/company-identity.ts apps/web/src/features/home-feed/company-identity.test.ts apps/web/src/features/home-feed/company-mark.tsx apps/web/public/company-logos
git commit -m "feat: add verified company identity marks"
```

Expected: PASS and every mapped path exists.

---

### Task 5: Rebuild the shared application shell

**Files:**
- Modify: `apps/web/src/components/app-shell/app-shell.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.module.css`
- Modify: `apps/web/src/components/app-shell/app-shell.test.tsx`
- Modify: `apps/web/src/features/owned-skills/owned-skills-sheet.tsx`
- Modify: `apps/web/src/features/owned-skills/owned-skills-sheet.test.tsx`

**Interfaces:**
- Consumes: existing `BrandMark`, `OwnedSkillsSheet`, `usePathname`, `useRouter`, and `ownedSkillsToDashboardHref`.
- Produces: global search, five-link navigation, write link, notification and career menus, and owned-skill URL synchronization.

- [ ] **Step 1: Replace shell tests with the new contract**

```ts
expect(screen.getAllByRole("link", { name: "홈" })[0]).toHaveAttribute("href", "/");
expect(screen.getAllByRole("link", { name: "시장" })[0]).toHaveAttribute("href", "/market");
expect(screen.getAllByRole("link", { name: "스킬맵" })[0]).toHaveAttribute("href", "/skill-map");
expect(screen.getAllByRole("link", { name: "공고" })[0]).toHaveAttribute("href", "/jobs");
expect(screen.getAllByRole("link", { name: "내 커리어" })[0]).toHaveAttribute("href", "/career");
expect(screen.getByRole("searchbox", { name: "통합 검색" })).toHaveAttribute("name", "q");
expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute("href", "/?compose=1");
```

Click `알림 열기` and `사용자 메뉴 열기`, assert visible menus, press Escape, and assert closure. Update the owned-skill test to assert `onSkillsChange(["React"])` after adding React.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --run src/components/app-shell/app-shell.test.tsx src/features/owned-skills/owned-skills-sheet.test.tsx
```

Expected: FAIL against the fixed rail and old sheet signature.

- [ ] **Step 3: Add the owned-skill callback**

```ts
type OwnedSkillsSheetProps = {
  open: boolean;
  onClose(): void;
  onSkillsChange?(skills: string[]): void;
  openerRef: RefObject<HTMLButtonElement | null>;
};
```

Call the callback after add, remove, and clear with the exact returned normalized array. Preserve storage and focus restoration.

- [ ] **Step 4: Implement the new shell**

```ts
const NAV_ITEMS = [
  { href: "/", label: "홈", icon: House },
  { href: "/market", label: "시장", icon: ChartLineUp },
  { href: "/skill-map", label: "스킬맵", icon: Graph },
  { href: "/jobs", label: "공고", icon: Briefcase },
  { href: "/career", label: "내 커리어", mobileLabel: "내 정보", icon: UserCircle },
] as const;
```

The first row contains brand, `<form action="/jobs" role="search">`, write link, notification button, and career-menu button. The second row is text navigation. Mobile repeats all five destinations at the bottom. Pressing `/` outside editable controls focuses search. Menus close on Escape and route change. No fake person appears.

When skills change on home, call `router.replace(ownedSkillsToDashboardHref(skills), { scroll: false })` and `router.refresh()`.

- [ ] **Step 5: Replace shell CSS**

Above 820px, shell top padding equals `--header-height-desktop`, header stays at top with two rows, search clamps from 320px to 520px, and navigation uses an active underline. Below 820px, desktop navigation hides and a fixed five-column bottom nav appears. Mobile content reserves `calc(4.5rem + env(safe-area-inset-bottom))`. Icon controls are 44×44px. Dropdowns use one border and a subtle tinted shadow without blur.

- [ ] **Step 6: Run and commit**

```bash
npm test -- --run src/components/app-shell/app-shell.test.tsx src/features/owned-skills/owned-skills-sheet.test.tsx
git add apps/web/src/components/app-shell apps/web/src/features/owned-skills/owned-skills-sheet.tsx apps/web/src/features/owned-skills/owned-skills-sheet.test.tsx
git commit -m "feat: replace app rail with community navigation"
```

Expected: PASS.

### Task 6: Add route shells and skill-map compatibility

**Files:**
- Create: `apps/web/src/components/route-shell/route-shell.tsx`
- Create: `apps/web/src/components/route-shell/route-shell.module.css`
- Create: `apps/web/src/components/route-shell/route-shell.test.tsx`
- Create: `apps/web/src/lib/product-routes.ts`
- Create: `apps/web/src/lib/product-routes.test.ts`
- Create: `apps/web/src/app/market/page.tsx`
- Create: `apps/web/src/app/career/page.tsx`
- Create: `apps/web/src/app/posts/[id]/page.tsx`
- Create: `apps/web/src/app/skill-map/page.tsx`
- Modify: `apps/web/src/app/skills/graph/page.tsx`
- Modify: `apps/web/src/app/skills/graph/page.test.tsx`

**Interfaces:**
- Consumes: App Router search parameters and existing `getSkillGraph`.
- Produces: `buildSkillGraphHref(params): string`, future-route shells, and seed-aware graph loading.

- [ ] **Step 1: Write failing helper and shell tests**

```ts
expect(buildSkillGraphHref({ skill: "cpp", field: "systems" })).toBe("/skills/graph?seed=cpp&field=systems");
expect(buildSkillGraphHref({ skill: ["cpp", "rust"], owned_skills: ["Linux", "Docker"] })).toBe("/skills/graph?seed=cpp&owned_skills=Linux&owned_skills=Docker");
```

Render `RouteShell` with title, description, and one action. Assert heading, `준비 중`, action, and home link. Extend the graph test so `seed: "Kubernetes"` reaches `getSkillGraph`.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --run src/lib/product-routes.test.ts src/components/route-shell/route-shell.test.tsx src/app/skills/graph/page.test.tsx
```

Expected: FAIL because helper and shell are absent and graph ignores search parameters.

- [ ] **Step 3: Implement the route helper**

```ts
type RouteParams = Record<string, string | string[] | undefined>;

export function buildSkillGraphHref(params: RouteParams): string {
  const output = new URLSearchParams();
  const skill = Array.isArray(params.skill) ? params.skill[0] : params.skill;
  if (skill) output.set("seed", skill);
  for (const [key, value] of Object.entries(params)) {
    if (key === "skill" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) output.append(key, item);
  }
  const query = output.toString();
  return `/skills/graph${query ? `?${query}` : ""}`;
}
```

- [ ] **Step 4: Implement the pages**

`/skill-map` calls `redirect(buildSkillGraphHref(await searchParams))`. `/market` states that verified demand counts are on home and links there. `/career` explains browser-only saved skills. `/posts/[id]` finds IDs in `mock-community.ts`; known IDs render the mock content with `커뮤니티 예시 콘텐츠`, and unknown IDs call `notFound()`.

Update the graph page contract:

```ts
type SkillGraphPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
```

Resolve the first seed and pass it to `getSkillGraph` without injecting default skills.

- [ ] **Step 5: Run and commit**

```bash
npm test -- --run src/lib/product-routes.test.ts src/components/route-shell/route-shell.test.tsx src/app/skills/graph/page.test.tsx
git add apps/web/src/components/route-shell apps/web/src/lib/product-routes.ts apps/web/src/lib/product-routes.test.ts apps/web/src/app/market apps/web/src/app/career apps/web/src/app/posts apps/web/src/app/skill-map apps/web/src/app/skills/graph/page.tsx apps/web/src/app/skills/graph/page.test.tsx
git commit -m "feat: add community product route shells"
```

Expected: PASS.

---

### Task 7: Build the interactive feed and responsive home

**Files:**
- Create: `apps/web/src/features/home-feed/home-feed.tsx`
- Create: `apps/web/src/features/home-feed/home-feed.module.css`
- Create: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/page.test.tsx`

**Interfaces:**
- Consumes: `HomeFeedSnapshot`, `itemsForTab`, `CompanyMark`, and `compose=1`.
- Produces: `<HomeFeed snapshot={snapshot} />` and completed `/`.

- [ ] **Step 1: Write failing interaction tests**

```ts
expect(screen.getByRole("heading", { name: "내 커리어와 가까운 이야기" })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "추천" })).toHaveAttribute("aria-selected", "true");
expect(screen.getByRole("article", { name: /3년차 백엔드 개발자/ })).toBeInTheDocument();
expect(screen.getByRole("article", { name: /Kubernetes/ })).toBeInTheDocument();
expect(screen.getByText("필수 8건")).toBeInTheDocument();
expect(screen.getByText("우대 4건")).toBeInTheDocument();
```

Click `팔로잉`: API cards disappear and followed mock content remains. Toggle first `공감` and `저장`: `aria-pressed` becomes true and count increases by one. Open composer, submit empty values to show inline errors, submit valid title/body, and assert the local post appears first. With `dataStatus="partial"`, assert the notice and social feed coexist.

- [ ] **Step 2: Write failing page integration tests**

```ts
expect(getPostings).toHaveBeenCalledWith({ limit: 40 });
expect(getSkillStats).toHaveBeenCalledWith({ limit: 8 });
expect(getSkillGraph).toHaveBeenCalledWith({ seed: "Java", owned_skills: ["Java", "Spring"], limit: 30 });
```

Assert a mock community heading, real company, real skill count, and absence of `/지난주 대비|합격 가능성|\d+\.\d+점/`.

- [ ] **Step 3: Run and verify failure**

```bash
npm test -- --run src/features/home-feed/home-feed.test.tsx src/app/page.test.tsx
```

Expected: FAIL because the component is absent and page renders `DashboardHome`.

- [ ] **Step 4: Implement client state**

```ts
export type HomeFeedProps = { snapshot: HomeFeedSnapshot; composeInitiallyOpen?: boolean };
type ReactionState = Record<string, boolean>;
type LocalPostDraft = { title: string; body: string; tags: string };
```

Keep tab, reactions, saves, composer, draft, and validation in local state. Create IDs with `crypto.randomUUID()` and a timestamp fallback. Parse comma-separated tags, trim, deduplicate, and cap at four. Close dialog on Escape, restore focus, render an empty tab state, and announce result counts and local-post confirmation with `aria-live="polite"`. Never persist reactions as server facts.

- [ ] **Step 5: Implement semantic cards and rails**

```tsx
<main className={styles.page}>
  <div className={styles.layout}>
    <aside aria-label="내 커리어 바로가기" className={styles.leftRail} />
    <section aria-labelledby="home-feed-title" className={styles.feedColumn} />
    <aside aria-label="채용 시장 요약" className={styles.rightRail} />
  </div>
</main>
```

Left rail shows owned skills, career setup, saved links, and recent mock topics without a fake person. Center shows context, heading, tabs, and cards. Social cards prioritize text and actions. Market cards show API sample and required/preferred counts with one skill-map link. Job cards show `CompanyMark`, verified fields, graph-backed requirement matches when present, source link, detail link, and save. Right rail shows five mock topics, up to five entries from `snapshot.skillDemand`, verification scope, data policy, and market link without change arrows.

- [ ] **Step 6: Implement reference-matched CSS**

```css
.layout {
  display: grid;
  grid-template-columns: 14.5rem minmax(0, 46.5rem) 18.75rem;
  gap: 1.25rem;
  width: min(100% - 2rem, 88.75rem);
  margin-inline: auto;
  align-items: start;
}
```

At 1180px hide left rail and use `minmax(0, 1fr) 18rem`. At 900px use one column and place insights after feed. At 640px remove viewport-edge card radii, keep 16px horizontal padding, wrap tags, and stack job metadata. Cards use white, 1px cool-gray borders, 14px radius, no default shadow, 20–24px padding, and 12–16px gaps. Transitions are at most 180ms and limited to transform, opacity, color, background, and border color.

- [ ] **Step 7: Replace the server home**

Keep `dynamic = "force-dynamic"`. Load three resources with `settledResource`, build the snapshot, and render:

```tsx
return (
  <HomeFeed
    composeInitiallyOpen={resolvedSearchParams?.compose === "1"}
    snapshot={buildHomeFeedSnapshot({ postings, skillStats, graph, ownedSkills })}
  />
);
```

Set title `이직핏 홈` and describe community experience joined to official posting data.

- [ ] **Step 8: Run and commit**

```bash
npm test -- --run src/features/home-feed/home-feed.test.tsx src/app/page.test.tsx
git add apps/web/src/features/home-feed/home-feed.tsx apps/web/src/features/home-feed/home-feed.module.css apps/web/src/features/home-feed/home-feed.test.tsx apps/web/src/app/page.tsx apps/web/src/app/page.test.tsx
git commit -m "feat: build interactive community feed home"
```

Expected: PASS without act warnings.

### Task 8: Apply the light design system and loading state

**Files:**
- Modify: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles/design-system.test.ts`
- Modify: `apps/web/src/app/loading.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/sitemap.ts`

**Interfaces:**
- Consumes: variables used by shell, home, jobs, graph, and trust pages.
- Produces: one semantic light token contract and feed-shaped loading UI.

- [ ] **Step 1: Write the failing token test**

```ts
expect(tokens).toContain("--color-bg: #f6f7f9");
expect(tokens).toContain("--color-surface: #ffffff");
expect(tokens).toContain("--color-text: #16181d");
expect(tokens).toContain("--color-muted: #667085");
expect(tokens).toContain("--color-line: #e5e7eb");
expect(tokens).toContain("--color-accent: #7657f6");
expect(tokens).toContain("--header-height-desktop: 7rem");
expect(tokens).not.toContain("@media (prefers-color-scheme: dark)");
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --run src/styles/design-system.test.ts
```

Expected: FAIL against the current green automatic light/dark palette.

- [ ] **Step 3: Replace tokens and metadata**

Define the exact tested colors plus `--color-surface-subtle`, `--color-brand-subtle`, `--color-success`, `--color-warning`, `--color-danger`, three radius tokens, `--shadow-subtle`, `--header-height-desktop`, and `--mobile-nav-height`. Keep aliases only where surviving pages use them. Remove automatic dark switching.

Set root description to `실제 커리어 경험과 공식 채용공고 데이터를 함께 탐색하는 이직핏 커리어 네트워크입니다.` Add `/market`, `/skill-map`, and `/career` to sitemap; exclude mock post detail routes.

- [ ] **Step 4: Replace loading UI**

Render a semantic main with left, center, and right skeleton regions and `aria-label="홈 피드를 불러오는 중"`. Use home-feed CSS so skeleton geometry matches real cards and obeys reduced motion.

- [ ] **Step 5: Run and commit**

```bash
npm test -- --run src/styles/design-system.test.ts src/app/trust-pages.test.tsx
git add apps/web/src/styles/tokens.css apps/web/src/styles/design-system.test.ts apps/web/src/app/loading.tsx apps/web/src/app/layout.tsx apps/web/src/app/sitemap.ts
git commit -m "feat: apply community home design system"
```

Expected: PASS.

---

### Task 9: Remove obsolete home dashboard code safely

**Files:**
- Remove: `apps/web/src/features/dashboard/dashboard-home.tsx`
- Remove: `apps/web/src/features/dashboard/dashboard-home.module.css`
- Remove: `apps/web/src/features/dashboard/dashboard-home.test.tsx`
- Remove: `apps/web/src/features/dashboard/model.ts`
- Remove: `apps/web/src/features/dashboard/model.test.ts`
- Remove: `apps/web/src/features/dashboard/state.ts`
- Remove: `apps/web/src/features/dashboard/state.test.ts`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: replacement model and home from Tasks 2 and 7.
- Produces: no imports of old home files and no selectors dedicated only to deleted UI.

- [ ] **Step 1: Prove old files are unreferenced**

```bash
rg -n "features/dashboard/(dashboard-home|model|state)|DashboardHome|dashboard-home\.module" apps/web/src --glob '!features/dashboard/**'
```

Expected: no matches.

- [ ] **Step 2: Remove the seven proven-unused files**

Use `apply_patch` file deletions. Do not delete `components/dashboard`.

- [ ] **Step 3: Remove only proven-dead global selectors**

```bash
rg -o "className=\"[^\"]+\"|className=\{[^}]+\}" apps/web/src | rg "daily-|dashboard-app-page|reference-" || true
rg -n "^\.daily-|^body:has\(\.daily-dashboard-page\)|^#main-content:has\(\.daily-dashboard-page\)" apps/web/src/app/globals.css
```

Delete a selector block only when surviving JSX has no matching class. Preserve `dashboard-app-page` and graph selectors used by `SkillGraphExperience`.

- [ ] **Step 4: Run the complete suite**

```bash
npm test -- --run
```

Expected: PASS. Test-file count reflects removed dashboard tests and new home/routing/resolver tests.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A apps/web/src/features/dashboard apps/web/src/app/globals.css
git commit -m "refactor: remove obsolete dashboard home"
```

---

### Task 10: Verify behavior, responsiveness, and production build

**Files:**
- Modify if a defect is found: only files intentionally changed by Tasks 1–9.

**Interfaces:**
- Consumes: complete implementation.
- Produces: test, typecheck, build, visual, keyboard, and console evidence.

- [ ] **Step 1: Run automated verification**

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: every command exits 0. Route table includes `/`, `/market`, `/career`, `/posts/[id]`, `/skill-map`, `/jobs`, and `/skills/graph`.

- [ ] **Step 2: Start the production server**

```bash
npm run start
```

Test `http://localhost:3000`. If occupied, run `npm run start -- -p 3100` and use port 3100.

- [ ] **Step 3: Verify three viewports**

Capture full-page screenshots at 1536×1024, 1024×900, and 390×844. Compare desktop with the generated reference. Confirm first feed visibility, desktop three columns, tablet at most two columns, mobile one column with bottom nav, and no horizontal overflow.

- [ ] **Step 4: Verify interaction and accessibility**

1. Press `/`; search gains focus.
2. Switch all four tabs.
3. Toggle reaction and save; visible and accessible states change.
4. Open composer, trigger validation, submit a local post, close with Escape, and confirm focus restoration.
5. Open and close notification and career menus.
6. Add a skill; URL and verified API criteria update.
7. Follow a skill tag through `/skill-map` to graph.
8. Open real job detail and official source.
9. Tab through controls and confirm visible focus.

Expected browser console: no hydration errors, uncaught exceptions, mapped-logo failures, or accessibility warnings.

- [ ] **Step 5: Fix each discovered defect test-first**

Add the smallest failing test to the nearest test file, run it to see failure, patch with `apply_patch`, rerun targeted test, then rerun all three commands from Step 1.

- [ ] **Step 6: Review diff and commit verification fixes**

```bash
git status --short
git diff --check
git diff --stat
git log --oneline --decorate -12
```

Confirm `docs/handoff/2026-07-13-remake-ui.md`, `docs/handoff/image.png`, and `.agents/` remain untouched user-owned files. If Step 5 changed files:

```bash
git add apps/web docs/handoff/2026-07-13-community-feed-home-reference.png docs/superpowers/specs/2026-07-13-community-feed-home-design.md
git commit -m "fix: polish community feed verification"
```

Do not create an empty commit.

---

## Plan Self-Review

- Spec coverage: visual reference, mixed-data boundary, company identity, two-row shell, three-column home, interactions, route shells, responsive layout, loading/error/empty states, accessibility, cleanup, and full verification each have an owning task.
- Placeholder scan: every step names concrete files, interfaces, commands, assertions, and outcomes; no deferred implementation markers remain.
- Type consistency: Tasks 2, 3, 4, 6, and 7 share the exact `FeedItem`, `FeedTab`, `HomeFeedSnapshot`, `CompanyIdentity`, and `buildSkillGraphHref` names defined before use.
- Scope: the plan changes one product shell and one home experience while preserving backend and detailed data products; it does not add community persistence, authentication, history analytics, or a new graph.

## Execution Handoff

Execute inline in this session with `superpowers:executing-plans`. Multi-agent execution is not selected because the user requested progress without explicitly authorizing subagent delegation.
