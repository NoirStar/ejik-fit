# Home Feed Hallmark Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real mixed feed reachable in the first mobile viewport, correct the meaning of the fit count, and complete home-page touch and recency details without changing infinite scroll.

**Architecture:** Preserve the existing `HomeFeed` component, item model, API requests, and `useHomeFeedPagination`. Keep the desktop two-column Ecosystem Index, hide its duplicated supporting rail at 900px and below, and rely on the existing in-feed market cards for mobile market context. Copy and date changes stay inside the home presentation layer.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve automatic infinite scroll, item ordering, pagination cursors, deduplication, and scroll position.
- Preserve the locked `design.md` modern-minimal system, Pretendard, purple accent, and existing tokens.
- Use real snapshot values only; do not invent trend percentages or collection dates.
- Keep every touch-reachable control at least 44×44 CSS px.
- Do not delete routes, components, or production files.
- Run only changed home tests and one focused browser flow unless a failure requires more.

---

### Task 1: Lock the responsive and copy contracts with failing tests

**Files:**
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.styles.test.ts`
- Modify: `apps/web/src/app/page.test.tsx`
- Modify: `apps/web/e2e/home-market-context.e2e.ts`

**Interfaces:**
- Consumes: existing `HomeFeedSnapshot.lastVerifiedAt` and `matchingPostingCount`.
- Produces: test contracts for honest copy, explicit recency, mobile rail removal, feed priority, and 44px hit areas.

- [ ] **Step 1: Replace the old fit-label assertions and add the verified-date assertion**

```ts
expect(within(briefing).getByText("내 기술 포함 공고")).toBeInTheDocument();
expect(within(briefing).getByText("필수 기술 절반 이상 충족 4건"))
  .toBeInTheDocument();
expect(screen.getByText("공고 2개 분석 · 최신 확인 7월 13일"))
  .toBeInTheDocument();
```

- [ ] **Step 2: Replace the narrow-screen CSS expectation**

```ts
expect(css).toMatch(
  /@media \(max-width: 900px\)[\s\S]*?\.rightRail\s*\{[^}]*display: none;/,
);
expect(css).toMatch(
  /@media \(max-width: 900px\)[\s\S]*?\.feedColumn\s*\{[^}]*order: 2;/,
);
```

The same style test requires real 44px dimensions on rail links and an expanded 44px hit area on community and market title links.

- [ ] **Step 3: Add the browser-level fold contract**

```ts
if (width <= 900) {
  await expect(page.getByRole("complementary", { name: "채용 시장 요약" }))
    .toBeHidden();
  const firstArticle = page.getByRole("tabpanel").locator("article").first();
  const box = await firstArticle.boundingBox();
  expect(box?.y).toBeLessThan(900 - 80);
}
```

- [ ] **Step 4: Run the four focused tests and confirm failure for the old copy and old responsive order**

Run: `npm test -- --run src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts src/app/page.test.tsx`

Expected: FAIL because `맞는 공고`, `최근 수집 기준`, and `rightRail order: 2` still exist.

### Task 2: Implement the approved home presentation changes

**Files:**
- Modify: `design.md`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `HomeFeedSnapshot.lastVerifiedAt`.
- Produces: `formatLatestVerifiedLabel(value: string | null): string` and the unchanged `HomeFeed` public component.

- [ ] **Step 1: Document the responsive allowance in `design.md`**

```md
- 홈의 전체 기술 수요 레일은 901px 이상에서만 보인다. 900px 이하에서는 브리핑 뒤에 연속 피드를
  바로 두고, 시장 근거는 피드 안의 시장 카드로 제공한다.
```

- [ ] **Step 2: Implement the honest label and verified-date helper**

```ts
function formatLatestVerifiedLabel(value: string | null) {
  if (!value) return "최신 확인 시각 미상";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최신 확인 시각 미상";
  return `최신 확인 ${new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date)}`;
}
```

Render `내 기술 포함 공고`, `필수 기술 절반 이상 충족 N건`, and
`공고 N개 분석 · ${formatLatestVerifiedLabel(snapshot.lastVerifiedAt)}`.

- [ ] **Step 3: Make the feed the second narrow-screen region and remove the duplicate rail**

```css
@media (max-width: 900px) {
  .rightRail { display: none; }
  .feedColumn { order: 2; }
}
```

Do not change `use-home-feed-pagination.ts`, `feed-pagination.ts`, or the feed sentinel.

- [ ] **Step 4: Complete touch and tap states**

```css
.railHeadingRow > a,
.railFootnote a {
  display: inline-flex;
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  align-items: center;
}

.cardCopy h2 a::before,
.marketBody h2 a::before {
  position: absolute;
  inset: -0.75rem -0.25rem;
  content: "";
}
```

Add `:active` feedback and include the links in the existing explicit `:focus-visible` group.

- [ ] **Step 5: Run the focused unit tests and confirm they pass**

Run: `npm test -- --run src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts src/app/page.test.tsx`

Expected: PASS.

### Task 3: Verify the user-visible mobile outcome

**Files:**
- Modify only listed files if verification reveals a defect.

**Interfaces:**
- Confirms the existing infinite-scroll sentinel and API request flow remain unchanged.

- [ ] **Step 1: Run one focused Playwright spec**

Run: `npx playwright test e2e/home-market-context.e2e.ts`

Expected: desktop rail visible, mobile rail hidden, first feed article inside the initial viewport, no horizontal overflow, no browser errors.

- [ ] **Step 2: Run lint/type checking**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run diff checks**

Run: `git diff --check && git status --short`

Expected: only the files declared in this plan are changed.

### Task 4: Resolve the production placeholder post safely

**Files:**
- No repository file changes.

**Interfaces:**
- Consumes the public production community feed and an already-authorized owner or database session.
- Produces either one backed-up and deleted exact post or a clear authorization blocker; it never applies a content heuristic.

- [ ] **Step 1: Resolve the exact production row by title, body, tags, ID, and author**

Query the public community endpoint read-only and confirm one exact row matches `test1 / test / [test, 1, 2, 3]`.

- [ ] **Step 2: Check for an existing authorized owner or database session without extracting credentials**

If none is configured, stop this task and report the required owner action. Do not create a privileged path or broaden RLS.

- [ ] **Step 3: If authorized, back up that one row and delete only its exact UUID**

Confirm the public feed no longer returns the UUID. Do not delete any other post or comment.

