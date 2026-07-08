# 이직핏 브랜드 대시보드 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app UI from `기술 채용 인텔리전스` to `이직핏`, add branded favicon/logo assets, and polish the home dashboard plus skill graph for both light and dark modes.

**Architecture:** Keep the existing Next.js App Router, dashboard components, and force graph renderer. Add a small reusable brand component backed by SVG assets, then update dashboard and graph copy/layout/CSS with system-color light and dark theme tokens. Finish with real browser screenshot QA and a fix loop.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, Phosphor Icons, vanilla CSS in `globals.css`, SVG brand assets.

## Global Constraints

- Product name is `이직핏`; English mark is `EJIK FIT`.
- Remove user-facing `기술 채용 인텔리전스` and `Tech Hiring Intelligence` from the dashboard and skill graph shell.
- Support both light mode and dark mode via `prefers-color-scheme`.
- Light home is a clean operational dashboard; dark home is a deep navy analytics dashboard.
- The skill graph canvas stays dark in both themes.
- Run actual browser verification and revise UX issues before completion.
- Do not touch untracked `.agents/`.

---

### Task 1: Brand Contract Tests

**Files:**
- Modify: `apps/web/src/app/page.test.tsx`
- Modify: `apps/web/src/app/skills/graph/page.test.tsx`

**Interfaces:**
- Consumes: current `Home()` and `SkillGraphPage()` server components.
- Produces: failing tests that require the `이직핏` brand and reject the old product copy.

- [ ] **Step 1: Update the home test to require 이직핏**

Replace the old heading assertion in `apps/web/src/app/page.test.tsx`:

```ts
expect(
  screen.getByRole("heading", { name: "기술 채용 인텔리전스" }),
).toBeInTheDocument();
```

with:

```ts
expect(screen.getByRole("heading", { name: "이직핏" })).toBeInTheDocument();
expect(screen.getByText("내 기술이 맞는 시장을 찾다")).toBeInTheDocument();
expect(screen.queryByText("기술 채용 인텔리전스")).not.toBeInTheDocument();
expect(screen.queryByText("Tech Hiring Intelligence")).not.toBeInTheDocument();
```

- [ ] **Step 2: Update the skill graph test to require 이직핏 기술 맵**

Replace the old heading assertion in `apps/web/src/app/skills/graph/page.test.tsx`:

```ts
expect(
  screen.getByRole("heading", { name: "기술 채용 인텔리전스" }),
).toBeInTheDocument();
```

with:

```ts
expect(screen.getByRole("heading", { name: "이직핏 기술 맵" })).toBeInTheDocument();
expect(screen.getByText("내 기술이 맞는 시장을 찾다")).toBeInTheDocument();
expect(screen.queryByText("기술 채용 인텔리전스")).not.toBeInTheDocument();
expect(screen.queryByText("Tech Hiring Intelligence")).not.toBeInTheDocument();
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
cd apps/web
npm test -- --run src/app/page.test.tsx src/app/skills/graph/page.test.tsx
```

Expected: FAIL because UI still renders old `기술 채용 인텔리전스` copy.

---

### Task 2: Brand Assets and Brand Component

**Files:**
- Create: `apps/web/src/components/brand/brand-mark.tsx`
- Create: `apps/web/public/brand/ejikfit-mark.svg`
- Create: `apps/web/public/brand/ejikfit-logo.svg`
- Create: `apps/web/src/app/icon.svg`
- Create: `apps/web/src/app/apple-icon.svg`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: `BrandMark({ size?: "sm" | "md" | "lg"; showWordmark?: boolean; className?: string })`.
- Produces: Next metadata icons for favicon and apple icon.

- [ ] **Step 1: Create SVG logo assets**

Create `apps/web/public/brand/ejikfit-mark.svg` as a compact path/node/fit mark. Use this exact structure:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title>이직핏 브랜드 마크</title>
  <rect width="64" height="64" rx="18" fill="#1769ff"/>
  <path d="M20 39.5V24.8L32 17.7l12 7.1v14.7l-12 6.8-12-6.8Z" fill="none" stroke="white" stroke-width="5.8" stroke-linejoin="round"/>
  <path d="M25.8 33.2 31 38.2 42 25.8" fill="none" stroke="#37d099" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="20" cy="39.5" r="4.4" fill="#9fc1ff"/>
  <circle cx="44" cy="24.8" r="4.4" fill="#9fc1ff"/>
</svg>
```

Create `apps/web/public/brand/ejikfit-logo.svg` with the same mark plus `이직핏` and `EJIK FIT` wordmark.

- [ ] **Step 2: Create Next app icons**

Copy the mark SVG structure into:

```txt
apps/web/src/app/icon.svg
apps/web/src/app/apple-icon.svg
```

Expected: Next App Router can serve the favicon automatically.

- [ ] **Step 3: Create `BrandMark`**

Create `apps/web/src/components/brand/brand-mark.tsx`:

```tsx
import Image from "next/image";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};

export function BrandMark({
  size = "md",
  showWordmark = true,
  className = "",
}: BrandMarkProps) {
  return (
    <span className={`brand-lockup brand-lockup--${size} ${className}`.trim()}>
      <Image
        alt=""
        aria-hidden="true"
        className="brand-lockup__mark"
        height={44}
        priority
        src="/brand/ejikfit-mark.svg"
        width={44}
      />
      {showWordmark && (
        <span className="brand-lockup__copy">
          <strong>이직핏</strong>
          <small>EJIK FIT</small>
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Update metadata icons**

In `apps/web/src/app/layout.tsx`, add:

```ts
icons: {
  icon: "/icon.svg",
  apple: "/apple-icon.svg",
},
```

inside `metadata`.

- [ ] **Step 5: Run typecheck**

Run:

```bash
cd apps/web
npm run lint
```

Expected: PASS.

---

### Task 3: Home Dashboard Rebrand and Mini Graph

**Files:**
- Modify: `apps/web/src/components/dashboard/app-shell.tsx`
- Modify: `apps/web/src/components/dashboard/daily-dashboard-home.tsx`
- Modify: `apps/web/src/components/dashboard/mini-market-signals.tsx`
- Modify: `apps/web/src/components/site-header.tsx`

**Interfaces:**
- Consumes: `BrandMark` from `@/components/brand/brand-mark`.
- Produces: home heading `이직핏`, tagline `내 기술이 맞는 시장을 찾다`, and a visible mini tech map panel.

- [ ] **Step 1: Replace dashboard sidebar brand**

In `DashboardShell`, import `BrandMark` and replace the current `daily-brand-mark` / old copy with:

```tsx
<Link className="daily-brand" href="/" aria-label="이직핏 대시보드 홈">
  <BrandMark size="md" />
</Link>
```

Update the shell `aria-label` to `이직핏 대시보드`.

- [ ] **Step 2: Replace home hero copy**

In `DailyDashboardHome`, change:

```tsx
<span>오늘의 채용 브리핑</span>
<h1>기술 채용 인텔리전스</h1>
<p>최근 공고와 내 스택 기준 신호만 빠르게 확인하세요.</p>
```

to:

```tsx
<span>오늘의 이직 브리핑</span>
<h1>이직핏</h1>
<p>내 기술이 맞는 시장을 찾다</p>
```

Add a second sentence in the surrounding UI only where space allows:

```tsx
<small>기술 스택과 채용 신호를 연결해 다음 이직 판단을 돕습니다.</small>
```

- [ ] **Step 3: Add mini tech map panel**

In `MiniMarketSignals`, add a third panel before the two signal columns:

```tsx
<article className="market-signal-card market-signal-card--graph">
  <div className="daily-card-core market-signal-card__core">
    <header className="mini-graph__header">
      <div>
        <span>기술 맵 미리보기</span>
        <h2>내 스택 주변 신호</h2>
      </div>
      <a href="/skills/graph">열기</a>
    </header>
    <div className="mini-graph" aria-hidden="true">
      <span className="mini-graph__node mini-graph__node--core">Spring</span>
      <span className="mini-graph__node mini-graph__node--a">Java</span>
      <span className="mini-graph__node mini-graph__node--b">AWS</span>
      <span className="mini-graph__node mini-graph__node--c">Kubernetes</span>
      <span className="mini-graph__node mini-graph__node--d">Kafka</span>
      <i className="mini-graph__line mini-graph__line--a" />
      <i className="mini-graph__line mini-graph__line--b" />
      <i className="mini-graph__line mini-graph__line--c" />
      <i className="mini-graph__line mini-graph__line--d" />
    </div>
  </div>
</article>
```

- [ ] **Step 4: Rebrand SiteHeader**

In `SiteHeader`, import `BrandMark` and replace the text `ejik` brand link content with:

```tsx
<BrandMark size="sm" />
```

Keep aria-label as `이직핏 홈`.

- [ ] **Step 5: Run brand tests**

Run:

```bash
cd apps/web
npm test -- --run src/app/page.test.tsx src/app/skills/graph/page.test.tsx
```

Expected: PASS after CSS-independent brand copy changes.

---

### Task 4: Skill Graph Rebrand and Dark Graph Focus

**Files:**
- Modify: `apps/web/src/components/skill-graph-experience.tsx`

**Interfaces:**
- Consumes: existing `SkillGraphForceCanvas`.
- Produces: heading `이직핏 기술 맵`, tagline `내 기술이 맞는 시장을 찾다`, and branded sidebar.

- [ ] **Step 1: Replace skill graph shell brand**

Import `BrandMark` and replace old graph sidebar wordmark with the same brand link pattern:

```tsx
<BrandMark size="md" />
```

- [ ] **Step 2: Replace main graph heading**

Update the graph screen heading from old product copy to:

```tsx
<h1>이직핏 기술 맵</h1>
<p>내 기술이 맞는 시장을 찾다</p>
```

Keep graph controls, evidence, owned skill storage, and fallback behavior unchanged.

- [ ] **Step 3: Run graph test**

Run:

```bash
cd apps/web
npm test -- --run src/app/skills/graph/page.test.tsx
```

Expected: PASS.

---

### Task 5: Light and Dark Theme Polish

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes class names from Tasks 2-4.
- Produces: responsive brand lockup, light dashboard, dark dashboard, and always-dark graph/mini graph panels.

- [ ] **Step 1: Add brand lockup CSS**

Add styles for:

```css
.brand-lockup {}
.brand-lockup__mark {}
.brand-lockup__copy {}
.brand-lockup--sm {}
.brand-lockup--md {}
.brand-lockup--lg {}
```

The mark must stay at stable dimensions and never stretch.

- [ ] **Step 2: Restore full light and dark dashboard tokens**

Keep light mode defaults under `.daily-dashboard-page, .daily-shell`.

Add a dark block:

```css
@media (prefers-color-scheme: dark) {
  body:has(.daily-dashboard-page) {
    background: #050912;
    color-scheme: dark;
  }

  .daily-dashboard-page,
  .daily-shell {
    --daily-bg: #050912;
    --daily-surface: #0b1422;
    --daily-surface-muted: #111c2d;
    --daily-canvas: #07101c;
    --daily-line: rgb(183 199 229 / 0.14);
    --daily-line-strong: rgb(183 199 229 / 0.22);
    --daily-text: #f3f7ff;
    --daily-muted: #a4afc1;
    --daily-faint: #778399;
    --daily-accent: #72a2ff;
    --daily-accent-soft: rgb(114 162 255 / 0.14);
    --daily-good: #37d099;
  }
}
```

- [ ] **Step 3: Style mini graph**

Add `.mini-graph` styles so the panel is dark in both themes, uses stable aspect ratio, and does not overflow at 320px.

- [ ] **Step 4: Improve skill graph canvas CSS**

Tune existing `.ti-*` and `.force-canvas` rules so `/skills/graph` reads like a dark graph-first workspace while preserving controls and fallback.

- [ ] **Step 5: Run CSS and focused tests**

Run:

```bash
cd apps/web
npm test -- --run src/app/page.test.tsx src/app/skills/graph/page.test.tsx src/components/dashboard/dashboard-layout-css.test.ts
npm run lint
```

Expected: PASS.

---

### Task 6: Full Verification and Browser UX Fix Loop

**Files:**
- Modify any files needed from browser findings.

**Interfaces:**
- Produces verified light/dark UX for `/` and `/skills/graph`.

- [ ] **Step 1: Static verification**

Run:

```bash
cd apps/web
npm test -- --run
npm run build
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Start dev server**

Run:

```bash
cd apps/web
npm run dev
```

Expected: server starts on an available localhost port.

- [ ] **Step 3: Browser screenshot QA**

Use Playwright or browser automation to inspect:

```txt
/
/skills/graph
```

at:

```txt
320x720
768x900
1024x900
1440x1000
```

and both color schemes:

```txt
light
dark
```

- [ ] **Step 4: UX fix loop**

For every issue found, patch CSS/TSX and rerun the affected screenshot check. Required checks:

```txt
No horizontal overflow
No text clipped inside buttons/cards
Brand logo visible in sidebar/header
Favicon route serves an SVG
Home shows recent jobs and mini graph
Skill graph shows dark graph canvas
Controls remain reachable on mobile
```

- [ ] **Step 5: Final verification**

Run:

```bash
cd apps/web
npm run lint
npm test -- --run
npm run build
git diff --check
```

Expected: all pass.

- [ ] **Step 6: Commit implementation**

Run:

```bash
git add apps/web/src apps/web/public docs/superpowers/specs/2026-07-08-ejikfit-brand-dashboard-redesign-design.md docs/superpowers/plans/2026-07-08-ejikfit-brand-dashboard-redesign.md
git commit -m "feat: redesign ejikfit brand dashboard"
```
