# Dashboard Hero Dedupe Dark Tone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicate dashboard KPI cards and retune the home dashboard to the dense dark reference tone while keeping light/dark support.

**Architecture:** Keep the existing Next.js dashboard components and CSS system. Move the repeated metrics into a compact hero stats row, delete the redundant KPI section, keep full stack editing in the left `내 스택 요약` panel, then update the `reference-*` CSS surface tokens and responsive layout. Remove unused dashboard summary code only when it has no imports.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, Phosphor Icons, vanilla CSS in `globals.css`.

## Global Constraints

- Product name remains `이직핏`; English mark remains `EJIK FIT`.
- Support both light mode and dark mode via `prefers-color-scheme`.
- Do not reintroduce `기술 채용 인텔리전스` or `Tech Hiring Intelligence`.
- Do not add decorative or unconnected "surrounding signal" widgets to the main dashboard.
- Do not duplicate the full owned stack chip list in the hero; the hero shows only one focus badge such as `Spring 중심`.
- Stack add/remove controls live in the left `내 스택 요약` panel, not in the middle of the hero.
- Do not leave local dev servers running after browser verification.
- Do not touch untracked `.agents/`.

---

### Task 1: Home Duplicate KPI Regression Test

**Files:**
- Modify: `apps/web/src/app/page.test.tsx`

**Interfaces:**
- Consumes: `DailyDashboardHome` rendered by `Home`.
- Produces: test coverage that hero stats exist and standalone KPI cards do not.

- [ ] **Step 1: Write the failing test expectation**

In `renders the weekly stack intelligence dashboard with the Ejikfit brand`, keep the hero heading assertion and replace the four standalone KPI heading expectations with:

```ts
expect(screen.getByText("신규 매칭 공고")).toBeInTheDocument();
expect(screen.getByText("80% 이상 Fit")).toBeInTheDocument();
expect(screen.getByText("마감 임박")).toBeInTheDocument();
expect(screen.queryByLabelText("이번 주 핵심 지표")).not.toBeInTheDocument();
expect(screen.queryByRole("heading", { name: "상승 기술" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd apps/web
npm test -- --run src/app/page.test.tsx
```

Expected: FAIL because the current page still renders `<section aria-label="이번 주 핵심 지표">` and a standalone `상승 기술` heading.

### Task 2: Hero Stats and Redundant UI Removal

**Files:**
- Modify: `apps/web/src/components/dashboard/daily-dashboard-home.tsx`
- Delete: `apps/web/src/components/dashboard/daily-summary-strip.tsx`

**Interfaces:**
- Produces: hero-only summary metrics and no standalone KPI section.

- [ ] **Step 1: Implement hero stats**

Add a single `reference-focus-badge` in the hero, then add a `reference-hero-stats` block after the hero paragraph with four compact metrics:

```tsx
<span className="reference-focus-badge">{focusSkill} 중심</span>
```

```tsx
<dl className="reference-hero-stats" aria-label="이번 주 요약 지표">
  <div>
    <dt>FIT SCORE</dt>
    <dd>82%</dd>
    <span>지난주 대비 +12%</span>
  </div>
  <div>
    <dt>신규 매칭 공고</dt>
    <dd>{matchedCount}</dd>
    <span>+38%</span>
  </div>
  <div>
    <dt>80% 이상 Fit</dt>
    <dd>{highFitCount}</dd>
    <span>+17%</span>
  </div>
  <div>
    <dt>마감 임박</dt>
    <dd>{urgentCount}</dd>
    <span>확인 필요</span>
  </div>
</dl>
```

- [ ] **Step 2: Remove redundant cards**

Delete the entire `<section className="reference-kpis" aria-label="이번 주 핵심 지표">...</section>` block from `daily-dashboard-home.tsx`.

- [ ] **Step 3: Move stack editing out of the hero**

Render the full stack list and add/remove controls in a left rail `reference-stack-panel`. The hero must not render `aria-label="분석 기준 기술스택"` and must not render the `내 스택에 추가할 기술` input.

- [ ] **Step 4: Remove unused code**

Delete `Sparkline`, and remove unused imports `Clock` and `TrendUp`. Keep `ArrowUp` because the `급상승 관련 기술 TOP 5` list still uses it. Delete `apps/web/src/components/dashboard/daily-summary-strip.tsx` because `rg` shows no imports.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd apps/web
npm test -- --run src/app/page.test.tsx
```

Expected: PASS.

### Task 3: Visual Tone CSS

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/dashboard/app-shell.tsx`

**Interfaces:**
- Consumes: existing `reference-*` class names.
- Produces: dark reference tone, light mode parity, responsive layout with no duplicated KPI CSS.

- [ ] **Step 1: Retune `reference-dashboard-main` tokens**

Set dark mode to deep navy surfaces and emerald accent matching the reference. Keep light mode readable and restrained.

- [ ] **Step 2: Style hero stats**

Add `.reference-hero-stats` as a compact grid inside the hero, with tabular numbers and separators. It must collapse to two columns on tablet and one column on small mobile.

- [ ] **Step 3: Remove KPI CSS**

Remove `.reference-kpis`, `.reference-kpi-card`, `.reference-sparkline`, and `.reference-kpi-icon` CSS blocks and their responsive overrides.

- [ ] **Step 4: Retune panels and tables**

Make panels flatter and denser: 8px radius, low/no shadow, subtle borders, compact table rows, green ranking bars for `TOP 5` if it improves scanability without changing data.

- [ ] **Step 5: Run typecheck**

Run:

```bash
cd apps/web
npm run lint
```

Expected: PASS.

### Task 4: Browser Verification and Push

**Files:**
- No new source files unless a verification fix requires it.

**Interfaces:**
- Produces: verified desktop/mobile screenshots and a pushed commit.

- [ ] **Step 1: Build production bundle**

Run:

```bash
cd apps/web
npm run build
```

Expected: PASS.

- [ ] **Step 2: Run browser verification**

Start a temporary local server, inspect desktop and mobile screenshots, and stop the server before finishing.

- [ ] **Step 3: Fix visual issues**

If text overlaps, cards duplicate, or the page reads too flat compared with the reference, patch CSS and repeat tests/build/browser checks.

- [ ] **Step 4: Commit and push**

Commit docs, test, UI, and CSS changes. Push to `origin/main` so Vercel can deploy.
