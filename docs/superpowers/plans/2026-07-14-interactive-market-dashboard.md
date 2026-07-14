# Interactive Market Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a truthful, interactive, production-quality market dashboard from the existing official-posting and skill-stat APIs.

**Architecture:** Keep the initial request server-rendered, then preserve the dashboard client boundary across URL filter transitions. Pure market mapping functions derive demand composition, recent jobs, and co-occurrence; focused client components handle selection, sorting, fit analysis, and FLIP animation without inventing historical data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, Playwright, Simple Icons, existing Phosphor icons.

## Global Constraints

- Preserve the existing header, app shell, API client, Pretendard typography, routes, and query parameter names.
- Display `100건 이상 확인` when the 100-item posting request reaches its cap.
- Fetch up to 100 skill statistics so the live total is not confused with the old 30-item limit.
- Never display a relative-demand value as total-market share.
- Never display mock trend data in production.
- Use actual brand marks only for technologies with a recognized logo; use neutral local component icons otherwise.
- Respect `prefers-reduced-motion` and 44px interactive targets.

---

### Task 1: Define truthful market derivations

**Files:**
- Modify: `apps/web/src/features/market/model.ts`
- Modify: `apps/web/src/features/market/model.test.ts`

**Interfaces:**
- Consumes: `PostingListResponse`, `SkillStatsResponse`, current market filters.
- Produces: `MarketOverviewSnapshot`, `MarketSort`, `sortMarketSkills`, `jobsForSkill`, `buildSkillCombinations`, and honest summary labels.

- [ ] **Step 1: Write failing model tests** for a 100-item lower bound, `skillStats.total`, stable sorting, selected-skill jobs, requirement composition, and pair co-occurrence.
- [ ] **Step 2: Run `npm test -- src/features/market/model.test.ts --run`** and confirm failures describe the missing derivations.
- [ ] **Step 3: Implement the pure functions** with stable skill-name tie breaking, division-by-zero guards, and current-loaded-range wording.
- [ ] **Step 4: Run the model test** and confirm it passes.
- [ ] **Step 5: Commit** with `test/feat: define truthful interactive market model` after the complete task is green.

### Task 2: Add technology brand and fallback icons

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Create: `apps/web/src/features/market/technology-icon.tsx`
- Create: `apps/web/src/features/market/technology-icon.test.tsx`

**Interfaces:**
- Consumes: `{ name: string; category: string; size?: number }`.
- Produces: `TechnologyIcon`, rendered from selected Simple Icons data or a Phosphor fallback.

- [ ] **Step 1: Write failing icon tests** for Python, Kubernetes, LLM, SQL, and an unknown category.
- [ ] **Step 2: Run the focused test** and confirm the component is missing.
- [ ] **Step 3: Add `simple-icons`** and implement a normalized brand map with no remote image requests.
- [ ] **Step 4: Run the icon test** and confirm brand/fallback behavior passes.
- [ ] **Step 5: Commit** the dependency, component, and test.

### Task 3: Build the demand table and filters

**Files:**
- Create: `apps/web/src/features/market/market-filters.tsx`
- Create: `apps/web/src/features/market/demand-stacked-bar.tsx`
- Create: `apps/web/src/features/market/technology-demand-table.tsx`
- Create: `apps/web/src/features/market/use-demand-layout-animation.ts`
- Modify: `apps/web/src/features/market/market-overview.test.tsx`

**Interfaces:**
- Consumes: `MarketOverviewSnapshot`, selected skill, sort, pending filter state.
- Produces: accessible URL filters, sort control, clickable ranked rows, composition bars, relative bars, and a selected-skill callback.

- [ ] **Step 1: Replace the component expectations with failing tests** for button rows, sort labels, honest relative-demand copy, and selected state.
- [ ] **Step 2: Run the focused market component test** and confirm it fails for the new UI.
- [ ] **Step 3: Implement focused components** and the FLIP hook using `Element.animate`, stable skill names, transform/opacity, and reduced-motion guards.
- [ ] **Step 4: Run the focused component tests** and confirm they pass.
- [ ] **Step 5: Commit** the demand interaction slice.

### Task 4: Add trend collecting, recent jobs, combinations, and fit insight

**Files:**
- Create: `apps/web/src/features/market/technology-trend-panel.tsx`
- Create: `apps/web/src/features/market/recent-job-list.tsx`
- Create: `apps/web/src/features/market/skill-combination-recommendations.tsx`
- Create: `apps/web/src/features/market/use-market-fit.ts`
- Modify: `apps/web/src/features/market/market-overview.test.tsx`

**Interfaces:**
- Consumes: selected skill, mapped jobs, combinations, current career filter, and `ejik-fit:owned-skills`.
- Produces: no-fake-data trend state, selected-skill recent jobs, honest co-occurrence, and fit API insight.

- [ ] **Step 1: Add failing tests** for `추세 수집 중`, absence of SVG trend lines and growth language, selected-skill job updates, honest co-occurrence, and the no-owned-skills state.
- [ ] **Step 2: Run the focused tests** and verify the expected failures.
- [ ] **Step 3: Implement the panels and hook**, reusing `CompanyMark`, `readOwnedSkills`, `subscribeOwnedSkills`, and `/skills/graph/fit`.
- [ ] **Step 4: Run the focused tests** and confirm all states pass without console warnings.
- [ ] **Step 5: Commit** the insight panels.

### Task 5: Assemble the responsive dashboard

**Files:**
- Rewrite: `apps/web/src/features/market/market-overview.tsx`
- Rewrite: `apps/web/src/features/market/market-overview.module.css`
- Modify: `apps/web/src/features/market/market-overview.styles.test.ts`
- Modify: `apps/web/src/app/market/page.tsx`
- Create: `apps/web/src/app/market/loading.tsx`

**Interfaces:**
- Consumes: the server-built snapshot and all focused market components.
- Produces: the 1280px dense dashboard, 2-column/stacked responsive layouts, structural skeleton, and a 100-item skill-stat request.

- [ ] **Step 1: Add failing style and page tests** for the compact type scale, `minmax(0, 1fr) 22rem` grid, notice copy, 100-skill request, no gradients, and reduced-motion.
- [ ] **Step 2: Run the focused style/page tests** and confirm the old implementation fails the contract.
- [ ] **Step 3: Assemble the client dashboard and CSS** using the reference image's hierarchy without its inaccurate percentages or fake chart.
- [ ] **Step 4: Run all market unit/style tests** and confirm they pass.
- [ ] **Step 5: Commit** the assembled responsive dashboard.

### Task 6: Update browser fixtures and E2E behavior

**Files:**
- Modify: `apps/web/e2e/fixtures/test-api.mjs`
- Rewrite: `apps/web/e2e/market-overview.e2e.ts`

**Interfaces:**
- Consumes: deterministic skill and posting API fixtures.
- Produces: browser assertions for filters, selection, responsive layout, data honesty, and console safety.

- [ ] **Step 1: Write failing E2E assertions** for 1440/820/390 widths, 100+ copy, trend collection, technology selection, recent-job replacement, no market-share text, and no horizontal overflow.
- [ ] **Step 2: Run `npm run test:e2e -- e2e/market-overview.e2e.ts`** and confirm the old fixture/UI fails.
- [ ] **Step 3: Update only the fixture records needed** to expose two technologies with distinct recent jobs and realistic requirement counts.
- [ ] **Step 4: Re-run the market E2E file** and confirm all widths and interactions pass.
- [ ] **Step 5: Commit** the E2E coverage.

### Task 7: Full verification and production inspection

**Files:**
- Modify only files required by defects found during verification.

**Interfaces:**
- Consumes: the completed dashboard.
- Produces: test, type-check, production-build, and screenshot evidence.

- [ ] **Step 1: Run `npm test -- --run`** in `apps/web` and record the passed test count.
- [ ] **Step 2: Run `npm run lint`** and require exit code 0.
- [ ] **Step 3: Run the production Vercel build** with `VERCEL=1 VERCEL_ENV=production VERCEL_PROJECT_PRODUCTION_URL=ejik-fit-web.vercel.app API_BASE_URL=https://ejik-fit-api.vercel.app npm run build` and require exit code 0.
- [ ] **Step 4: Run the complete Playwright suite** and require zero failures.
- [ ] **Step 5: Inspect screenshots** at 1440, 820, and 390 pixels; compare type, density, overflow, fixed navigation, and selected states against the reference.
- [ ] **Step 6: Re-run any verification affected by visual fixes**, inspect `git diff --check`, commit intentionally, and push `main` so Vercel deploys the verified revision.
