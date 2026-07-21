# 이직핏 Hallmark 제품 UI 정돈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 기존 기능과 정보구조를 보존하면서 포커스 대비, 모바일 터치 규격, 두 줄 제어, 홈 공고 중첩 카드와 반복 eyebrow를 정돈한다.

**Architecture:** `design.md`와 기존 `apps/web/src/styles/tokens.css`를 앱 공통 설계 계약으로 사용한다. 기능 컴포넌트는 그대로 두고 의미가 바뀌는 짧은 라벨만 JSX에서 수정하며, 나머지는 CSS 모듈과 공통 토큰에서 해결한다. 시각 변경은 단위 테스트 대신 실제 브라우저 크기별 검사로 검증하고, 접근성 이름이나 DOM 계약이 바뀌는 부분만 기존 Vitest에 회귀 테스트를 추가한다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5.8 · CSS Modules · Vitest · Testing Library · Playwright

## Global Constraints

- API, DB, 인증, 크롤러, 데이터 매퍼와 라우트 구조를 변경하지 않는다.
- 새 UI·폰트·아이콘·애니메이션 패키지를 설치하지 않는다.
- Pretendard, 현재 보라색 브랜드와 시장 파스텔 팔레트를 유지한다.
- 포커스 링은 불투명하고 흰 배경에서 WCAG 3:1 이상이어야 한다.
- 터치 가능한 제어는 320·375·414·768px에서 최소 44px다.
- 버튼·탭·CTA의 보이는 라벨은 두 줄로 나뉘지 않는다.
- CSS와 레이아웃 조정에는 억지 TDD를 추가하지 않고, 사용자 동작과 접근성 이름 회귀만 테스트한다.
- 사용자의 기존 미추적 파일은 staging하거나 수정하지 않는다.

---

### Task 1: 공통 토큰과 포커스 표시 통일

**Files:**
- Modify: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles/typography.css`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/app-shell/app-shell.module.css`
- Modify: `apps/web/src/components/skill-graph-experience.module.css`
- Modify: `apps/web/src/features/notifications/activity-notification-center.module.css`
- Modify: `apps/web/src/features/saved-searches/saved-search-composer.module.css`
- Modify: `apps/web/src/features/companies/company-profile.module.css`
- Modify: `apps/web/src/features/companies/followed-companies.module.css`
- Modify: `apps/web/src/features/companies/company-follow-button.module.css`
- Modify: `apps/web/src/features/career/career-overview.module.css`
- Modify: `apps/web/src/features/search/search-results.module.css`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/features/auth/auth-panel.module.css`
- Modify: `apps/web/src/features/account/account-overview.module.css`

**Interfaces:**
- Produces: `--color-focus`, `--color-on-accent`, `--color-demand-*`, `--font-display`, `--font-body`, `--space-*`, `--ease-*`, `--dur-*`
- Consumes: existing `--color-*`, `--font-korean`, `--touch-target`

- [x] **Step 1: Record the failing focus audit**

Run:

```bash
rg -n 'outline:.*color-mix' apps/web/src --glob '*.css' --glob '*.module.css'
```

Expected: module-specific focus rules using 16–35% alpha are reported.

- [x] **Step 2: Extend the canonical tokens**

At the top of `tokens.css`, preserve the current visual values as OKLCH and add semantic roles:

```css
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
:root {
  --color-focus: var(--color-text);
  --color-on-accent: oklch(100% 0 0);
  --color-demand-required: oklch(68.53% 0.0803 235.68);
  --color-demand-preferred: oklch(81.20% 0.0562 177.39);
  --color-demand-unspecified: oklch(94.99% 0.0384 72.37);
  --color-demand-highlight: oklch(84.07% 0.0886 32.76);
  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
  --space-2xl: 4.5rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-instant: 100ms;
  --dur-short: 180ms;
  --dur-medium: 280ms;
}
```

- [x] **Step 3: Make typography roles intentional without adding a font**

Add to `typography.css`:

```css
:root {
  --font-body: var(--font-korean);
  --font-display: var(--font-korean);
  --font-numeric: var(--font-korean);
}
```

Use `--font-body` for controls/body and `--font-numeric` for `[data-numeric]`.

- [x] **Step 4: Replace weak module focus rings**

Replace every alpha-mixed outline in the listed CSS modules with:

```css
outline: 3px solid var(--color-focus);
outline-offset: 2px;
```

Keep focus appearance out of transition declarations. Set the global alias in `globals.css` to `--focus: var(--color-focus)`.

- [x] **Step 5: Remove mobile 100vw overlay sizing**

In `app-shell.module.css`, replace fixed menu widths with logical insets:

```css
.menu {
  right: 1rem;
  left: 1rem;
  width: auto;
}
```

- [x] **Step 6: Verify the focus contract**

Run:

```bash
rg -n 'outline:.*color-mix' apps/web/src --glob '*.css' --glob '*.module.css'
npm --prefix apps/web run lint
```

Expected: no alpha-mixed focus outline remains; TypeScript exits 0.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/styles/tokens.css apps/web/src/styles/typography.css apps/web/src/app/globals.css apps/web/src/components/app-shell/app-shell.module.css apps/web/src/components/skill-graph-experience.module.css apps/web/src/features/notifications/activity-notification-center.module.css apps/web/src/features/saved-searches/saved-search-composer.module.css apps/web/src/features/companies/company-profile.module.css apps/web/src/features/companies/followed-companies.module.css apps/web/src/features/companies/company-follow-button.module.css apps/web/src/features/career/career-overview.module.css apps/web/src/features/search/search-results.module.css apps/web/src/features/home-feed/home-feed.module.css apps/web/src/features/auth/auth-panel.module.css apps/web/src/features/account/account-overview.module.css
git commit -m "fix: unify accessible product focus styles"
```

### Task 2: 홈 공식 공고를 연속 피드 문법으로 정돈

**Files:**
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/features/home-feed/home-feed.styles.test.ts`

**Interfaces:**
- Consumes: existing `JobFeedCard` markup and `--color-brand-subtle`
- Produces: flat official-job band, readable stack prompt, unchanged job actions

- [x] **Step 1: Add a focused style-contract test**

Extend `home-feed.styles.test.ts`:

```ts
it("separates official jobs without a side stripe or nested card frame", () => {
  expect(rule("jobCard")).toContain("border-left: 0;");
  expect(rule("jobCard")).toContain("border-radius: 0;");
  expect(rule("jobCard")).toContain("margin: 0;");
  expect(rule("stackPrompt")).toContain("background: transparent;");
});
```

- [x] **Step 2: Run the test and confirm it fails**

Run:

```bash
npm --prefix apps/web test -- --run src/features/home-feed/home-feed.styles.test.ts
```

Expected: FAIL because `.jobCard` still has a 3px side stripe, radius and margin.

- [x] **Step 3: Flatten the job band**

Change the relevant rules to:

```css
.jobCard {
  margin: 0;
  padding: 1rem 1.125rem;
  border: 0;
  border-bottom: 1px solid var(--color-line-soft);
  border-left: 0;
  border-radius: 0;
  background: color-mix(in srgb, var(--color-brand-subtle) 34%, var(--color-surface));
}

.stackPrompt {
  margin-top: 0.875rem;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--color-line);
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
}
```

Keep `.jobActions > a:first-child` as the solid primary action using `--color-accent-strong` and `--color-on-accent`.

- [x] **Step 4: Run targeted tests**

Run:

```bash
npm --prefix apps/web test -- --run src/features/home-feed/home-feed.styles.test.ts src/features/home-feed/home-feed.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/features/home-feed/home-feed.module.css apps/web/src/features/home-feed/home-feed.styles.test.ts
git commit -m "fix: simplify official job presentation in home feed"
```

### Task 3: 모바일 공고 탭과 기업 더보기 라벨 안정화

**Files:**
- Modify: `apps/web/src/features/jobs/job-list.tsx`
- Modify: `apps/web/src/features/jobs/job-list.module.css`
- Modify: `apps/web/src/features/jobs/job-list.test.tsx`
- Modify: `apps/web/src/features/sources/source-directory.tsx`
- Modify: `apps/web/src/app/trust-pages.module.css`
- Modify: `apps/web/src/app/trust-pages.test.tsx`

**Interfaces:**
- Produces: visible tab labels `전체`, `기술 일치`, `저장`; accessible names retain counts and page scope
- Produces: visible more label `${nextCount}개 더 보기`; accessible name retains remaining count

- [x] **Step 1: Update behavior expectations first**

In `job-list.test.tsx`, keep role queries stable through explicit aria labels and assert compact visible copy:

```ts
expect(screen.getByRole("button", { name: "전체 공고 2" })).toHaveTextContent("전체2");
expect(screen.getByRole("button", { name: "내 기술 겹침 1" })).toHaveTextContent("기술 일치1");
expect(screen.getByRole("button", { name: "저장한 공고 0" })).toHaveTextContent("저장0");
expect(screen.queryByText("이 페이지")).not.toBeInTheDocument();
```

In `trust-pages.test.tsx`, change the large-directory button query to:

```ts
screen.getByRole("button", {
  name: "6개 기업 더 보기, 모두 표시하면 남은 기업 0개",
});
```

- [x] **Step 2: Run targeted tests and confirm the new contract fails**

Run:

```bash
npm --prefix apps/web test -- --run src/features/jobs/job-list.test.tsx src/app/trust-pages.test.tsx
```

Expected: FAIL on the old visible labels and source-directory accessible name.

- [x] **Step 3: Implement compact labels**

Use the following visible copy while keeping detailed `aria-label` values:

```tsx
<button aria-label={`전체 공고 ${total}`}>
  전체 <span>{total}</span>
</button>
<button aria-label={`내 기술 겹침 ${matchingCount}`}>
  기술 일치 <span>{matchingCount}</span>
</button>
<button aria-label={`저장한 공고 ${savedCount}`}>
  저장 <span>{savedCount}</span>
</button>
```

For the directory button:

```tsx
<button
  aria-label={`${nextCount}개 기업 더 보기, 모두 표시하면 남은 기업 ${remainingCount - nextCount}개`}
>
  {nextCount}개 더 보기
</button>
```

- [x] **Step 4: Lock one-line affordances and 44px controls**

In the relevant CSS modules:

```css
.viewTabs button,
.sourceMoreButton,
.sourceStatusFilters button {
  min-height: var(--touch-target);
  white-space: nowrap;
}

.sourceSearch input {
  min-height: var(--touch-target);
}
```

- [x] **Step 5: Run targeted tests**

Run:

```bash
npm --prefix apps/web test -- --run src/features/jobs/job-list.test.tsx src/features/jobs/job-list.styles.test.ts src/app/trust-pages.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/features/jobs/job-list.tsx apps/web/src/features/jobs/job-list.module.css apps/web/src/features/jobs/job-list.test.tsx apps/web/src/features/sources/source-directory.tsx apps/web/src/app/trust-pages.module.css apps/web/src/app/trust-pages.test.tsx
git commit -m "fix: keep mobile discovery controls compact"
```

### Task 4: 시장 제어 규격과 팔레트 토큰 연결

**Files:**
- Modify: `apps/web/src/features/market/market-overview.module.css`
- Modify: `apps/web/src/features/market/market-overview.styles.test.ts`

**Interfaces:**
- Consumes: `--color-demand-required`, `--color-demand-preferred`, `--color-demand-unspecified`, `--color-demand-highlight`
- Produces: unchanged data semantics with canonical shared palette and 44px touch controls

- [x] **Step 1: Update the existing palette contract test**

Replace literal palette assertions with token assertions and add control height checks:

```ts
expect(rule(".page")).toContain("--market-required: var(--color-demand-required);");
expect(rule(".page")).toContain("--market-preferred: var(--color-demand-preferred);");
expect(rule(".page")).toContain("--market-unspecified: var(--color-demand-unspecified);");
expect(rule(".page")).toContain("--market-relative: var(--color-demand-highlight);");
expect(rule(".sortControl select")).toContain("min-height: var(--touch-target);");
expect(rule(".trendAddControl select")).toContain("min-height: var(--touch-target);");
```

- [x] **Step 2: Run the style test and confirm it fails**

Run:

```bash
npm --prefix apps/web test -- --run src/features/market/market-overview.styles.test.ts
```

Expected: FAIL on literal colors and 30–32px select heights.

- [x] **Step 3: Connect shared tokens and touch sizes**

Update `.page` aliases and both select controls:

```css
.page {
  --market-required: var(--color-demand-required);
  --market-preferred: var(--color-demand-preferred);
  --market-unspecified: var(--color-demand-unspecified);
  --market-relative: var(--color-demand-highlight);
}

.sortControl select,
.trendAddControl select {
  min-height: var(--touch-target);
}
```

Keep required/preferred/unspecified labels and segment text; do not encode meaning with color alone.

- [x] **Step 4: Run market tests**

Run:

```bash
npm --prefix apps/web test -- --run src/features/market/market-overview.styles.test.ts src/features/market/market-overview.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/features/market/market-overview.module.css apps/web/src/features/market/market-overview.styles.test.ts
git commit -m "fix: align market controls with shared design tokens"
```

### Task 5: 장식형 페이지 eyebrow 제거

**Files:**
- Modify: `apps/web/src/features/jobs/job-list.tsx`
- Modify: `apps/web/src/features/jobs/job-list.module.css`
- Modify: `apps/web/src/features/career/career-overview.tsx`
- Modify: `apps/web/src/features/career/career-overview.module.css`
- Modify: `apps/web/src/features/companies/company-profile.tsx`
- Modify: `apps/web/src/features/companies/company-profile.module.css`
- Modify: `apps/web/src/components/skill-graph-experience.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.module.css`

**Interfaces:**
- Consumes: existing H1, descriptions, summary/trust lines
- Produces: same accessible page headings and trust information without decorative pre-heading copy

- [x] **Step 1: Remove only intro-level eyebrow markup**

Delete these four decorative paragraphs:

```tsx
<p className={styles.eyebrow}>검증된 공식 채용 데이터</p>
<p className={styles.eyebrow}>공식 공고와 내 기술 비교</p>
<p className={styles.eyebrow}>공식 채용 공고 기준 기업 보기</p>
<p className={styles.eyebrow}>공식 채용 공고 관계 데이터</p>
```

Do not remove panel labels such as `분석 기준`, source status, or error-state provenance.

- [x] **Step 2: Remove unused intro eyebrow selectors**

Delete `.eyebrow` from intro selector groups only when no remaining element uses it; keep selectors required by empty/error states.

- [x] **Step 3: Run affected component tests**

Run:

```bash
npm --prefix apps/web test -- --run src/features/jobs/job-list.test.tsx src/features/career/career-overview.test.tsx src/features/companies/company-profile.test.tsx src/app/skills/graph/page.test.tsx
```

Expected: PASS; H1 names and trust links remain available.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/features/jobs/job-list.tsx apps/web/src/features/jobs/job-list.module.css apps/web/src/features/career/career-overview.tsx apps/web/src/features/career/career-overview.module.css apps/web/src/features/companies/company-profile.tsx apps/web/src/features/companies/company-profile.module.css apps/web/src/components/skill-graph-experience.tsx apps/web/src/components/skill-graph-experience.module.css
git commit -m "fix: remove repetitive page intro kickers"
```

### Task 6: 실제 화면과 빌드 검증

**Files:**
- Create: `.hallmark/log.json`
- Modify: `docs/superpowers/plans/2026-07-21-hallmark-product-ui-redesign.md` (checkbox completion only)

**Interfaces:**
- Consumes: completed UI changes
- Produces: verified responsive build and Hallmark app-run record

- [x] **Step 1: Run targeted and project checks**

Run:

```bash
npm --prefix apps/web test -- --run src/features/home-feed/home-feed.styles.test.ts src/features/home-feed/home-feed.test.tsx src/features/jobs/job-list.test.tsx src/features/jobs/job-list.styles.test.ts src/features/market/market-overview.styles.test.ts src/features/market/market-overview.test.tsx src/features/career/career-overview.test.tsx src/features/companies/company-profile.test.tsx src/app/trust-pages.test.tsx src/app/skills/graph/page.test.tsx
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

Expected: all tests pass; TypeScript exits 0; production build completes.

- [x] **Step 2: Run responsive browser verification**

Use Playwright against `/`, `/market`, `/jobs`, `/skills/graph?skill=Kubernetes`, `/career`, `/companies/nexon`, `/data-policy`, and `/login` at 320, 375, 414, 768 and 1440px. For each route verify:

```ts
expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
  document.documentElement.clientWidth,
);
```

Also measure visible buttons/selects/inputs on touch widths and require `height >= 44`; ensure the jobs tabs and source-more button each have one rendered text line.

- [x] **Step 3: Inspect actual screenshots**

Capture desktop and 375px screenshots of home, market, jobs, career and data policy. Confirm:

- official job is a tinted feed band with no side stripe;
- primary job CTA remains visually dominant;
- page titles start without repeated purple kickers;
- market colors remain blue, mint, cream and coral;
- no fixed bottom navigation overlaps the last actionable content.

- [x] **Step 4: Run Hallmark slop test and record the app redesign**

Create `.hallmark/log.json` with:

```json
[
  {
    "date": "2026-07-21",
    "scope": "app",
    "macrostructure": "Workbench family",
    "theme": "custom ejik-fit violet and pastel data palette",
    "enrichment": "none",
    "brief": "Conservative product UI cleanup after Hallmark audit"
  }
]
```

Load and run `references/slop-test.md`; fix any failing universal gate before handoff.

- [x] **Step 5: Commit and push**

```bash
git add .hallmark/log.json docs/superpowers/plans/2026-07-21-hallmark-product-ui-redesign.md
git commit -m "docs: record verified hallmark app redesign"
git push origin main
```

Expected: `origin/main` advances and the Vercel production build starts.
