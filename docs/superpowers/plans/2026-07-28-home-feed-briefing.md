# Home Feed Career Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the home page around an actionable career briefing, a readable mixed feed, and an immediately reachable technology-demand panel while preserving the existing infinite-scroll behavior.

**Architecture:** Keep `useHomeFeedPagination` and every API/auth integration unchanged. Add a pure display-grouping helper for consecutive job items, then reshape `HomeFeed` into a two-column app layout with a compact briefing above the feed and a demand panel alongside it. Job and market cards reuse the existing feed item types and routes, with only the minimum model fields added to display requirement skills honestly.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library.

## Global Constraints

- Preserve the 10-item automatic infinite scroll, cursor handling, deduplication, retry state, and scroll position behavior.
- Keep the current purple brand tokens and `design.md` modern-minimal app system.
- Do not fabricate trend percentages; label current counts as current demand until historical snapshots exist.
- Show the skill-registration prompt once, never once per job.
- Keep official-source and save actions as 44px controls without competing with the internal detail destination.
- Do not delete routes, shared production components, or integration files.
- Verification is limited to the changed home-feed tests, lint/type checking, and one production build.

---

### Task 1: Consecutive job display groups

**Files:**
- Create: `apps/web/src/features/home-feed/feed-display-groups.ts`
- Create: `apps/web/src/features/home-feed/feed-display-groups.test.ts`

**Interfaces:**
- Consumes: `FeedItem` and `RecommendedJobFeedItem` from `./types`.
- Produces: `groupFeedForDisplay(items: FeedItem[]): FeedDisplayGroup[]`, where each group is either `{ kind: "item"; item: Exclude<FeedItem, RecommendedJobFeedItem> }` or `{ kind: "jobs"; items: RecommendedJobFeedItem[] }`.

- [x] **Step 1: Write the failing grouping tests**

```ts
it("keeps an isolated job as one job group between community items", () => {
  expect(groupFeedForDisplay([community("c1"), job("j1"), community("c2")]))
    .toMatchObject([
      { kind: "item", item: { id: "c1" } },
      { kind: "jobs", items: [{ id: "j1" }] },
      { kind: "item", item: { id: "c2" } },
    ]);
});

it("collects every consecutive job into one stable group", () => {
  expect(groupFeedForDisplay([job("j1"), job("j2"), job("j3")]))
    .toMatchObject([{ kind: "jobs", items: [{ id: "j1" }, { id: "j2" }, { id: "j3" }] }]);
});
```

- [x] **Step 2: Run the new test and confirm it fails because the helper is missing**

Run: `npm test -- --run src/features/home-feed/feed-display-groups.test.ts`

- [x] **Step 3: Implement the pure grouping helper without changing source ordering**

```ts
export function groupFeedForDisplay(items: FeedItem[]): FeedDisplayGroup[] {
  const groups: FeedDisplayGroup[] = [];
  for (const item of items) {
    const previous = groups.at(-1);
    if (item.type === "recommended_job") {
      if (previous?.kind === "jobs") previous.items.push(item);
      else groups.push({ kind: "jobs", items: [item] });
    } else {
      groups.push({ kind: "item", item });
    }
  }
  return groups;
}
```

- [x] **Step 4: Run the grouping test and confirm it passes**

Run: `npm test -- --run src/features/home-feed/feed-display-groups.test.ts`

- [x] **Step 5: Commit the grouping unit**

```bash
git add apps/web/src/features/home-feed/feed-display-groups.ts apps/web/src/features/home-feed/feed-display-groups.test.ts
git commit -m "feat: group consecutive home feed jobs"
```

### Task 2: Career briefing and two-column information architecture

**Files:**
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.styles.test.ts`

**Interfaces:**
- Consumes: `snapshot.careerInsight`, `snapshot.careerContext`, `snapshot.skillDemand`, and `snapshot.ownedSkills`.
- Produces: a labelled `내 커리어 브리핑` region and a two-column `.layout` containing `.feedColumn` and `.rightRail`.

- [x] **Step 1: Replace old rail assertions with failing briefing and layout assertions**

```ts
expect(screen.getByRole("region", { name: "내 커리어 브리핑" })).toBeInTheDocument();
expect(screen.getByText("맞는 공고")).toBeInTheDocument();
expect(screen.getByText("다음에 배울 기술")).toBeInTheDocument();
expect(screen.getByText("현재 수요 상위")).toBeInTheDocument();
expect(screen.queryByRole("complementary", { name: "내 커리어 바로가기" }))
  .not.toBeInTheDocument();
```

The style test must require `grid-template-columns: minmax(0, 1fr) 17.5rem;` and a mobile rule that orders `.rightRail` before `.feedColumn`.

- [x] **Step 2: Run the two changed tests and confirm the new expectations fail**

Run: `npm test -- --run src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts`

- [x] **Step 3: Implement `CareerBriefing`, remove the duplicate left rail from the page composition, and place the market rail before the feed on narrow screens**

The no-skill state must render exactly one link named `내 기술 등록` with this supporting copy: `기술을 등록하면 맞는 공고와 다음에 배울 기술을 보여드려요.` The personalized state must bind real fit and demand values from the snapshot.

- [x] **Step 4: Run the two changed tests and confirm they pass**

Run: `npm test -- --run src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts`

### Task 3: Compact actionable job clusters and honest market visualization

**Files:**
- Modify: `apps/web/src/features/home-feed/types.ts`
- Modify: `apps/web/src/features/home-feed/model.ts`
- Modify: `apps/web/src/features/home-feed/model.test.ts`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`

**Interfaces:**
- Adds `requiredSkills: string[]` and `preferredSkills: string[]` to `RecommendedJobFeedItem`.
- Produces `JobCluster` and compact `JobCard` rendering without altering `visibleItems` or pagination state.

- [x] **Step 1: Write failing model and UI assertions**

```ts
expect(item.requiredSkills).toEqual(["Java", "Spring"]);
expect(item.preferredSkills).toEqual(["Kafka"]);
expect(screen.getByText("필수 1/2 일치")).toBeInTheDocument();
expect(screen.queryByText("공고 상세")).not.toBeInTheDocument();
expect(screen.getByRole("link", { name: "Backend Engineer 공고 보기" }))
  .toHaveAttribute("href", "/jobs/job-1");
expect(screen.getByRole("link", { name: "Backend Engineer 공식 원문" }))
  .toHaveAttribute("href", "https://careers.toss.im/job-1");
```

Add a no-skill assertion that `Java` and `Spring` remain visible while `내 기술 등록` appears only once on the page.

- [x] **Step 2: Run the focused model and home-feed tests and confirm failure**

Run: `npm test -- --run src/features/home-feed/model.test.ts src/features/home-feed/home-feed.test.tsx`

- [x] **Step 3: Extend the feed model, render grouped jobs, replace the action footer with one large internal detail link plus official/save icon controls, and replace market count chips with a labelled distribution bar**

Every data-driven bar width must use existing color tokens; inline styles may contain only numeric layout proportions. Job requirements display at most four named skills plus plain text `외 N개`.

- [x] **Step 4: Run the focused model, grouping, home-feed, and style tests**

Run: `npm test -- --run src/features/home-feed/model.test.ts src/features/home-feed/feed-display-groups.test.ts src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts`

- [x] **Step 5: Commit the approved home redesign**

```bash
git add apps/web/src/features/home-feed docs/superpowers/plans/2026-07-28-home-feed-briefing.md
git commit -m "feat: make home feed action oriented"
```

### Task 4: Focused verification and handoff

**Files:**
- Modify only if verification exposes a defect in the files already listed.

**Interfaces:**
- Confirms no change to `use-home-feed-pagination.ts` or `feed-pagination.ts`.

- [x] **Step 1: Run the changed home-feed suite once**

Run: `npm test -- --run src/features/home-feed/model.test.ts src/features/home-feed/feed-display-groups.test.ts src/features/home-feed/feed-pagination.test.ts src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts`

- [x] **Step 2: Run lint/type checking**

Run: `npm run lint`

- [x] **Step 3: Run one production build**

Run: `npm run build`

- [x] **Step 4: Verify scope**

Run: `git diff --check && git diff origin/main --stat && git status --short`

Confirm that pagination implementation files are unchanged and no unrelated workspace files are present.
