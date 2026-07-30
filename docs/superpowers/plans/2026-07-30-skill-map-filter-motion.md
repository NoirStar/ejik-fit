# Skill Map Filter Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every skill-map filter produce an obvious, smooth, low-cost visual result while preserving graph position and separating filter, transition, toolbar, and renderer responsibilities.

**Architecture:** Keep one bounded layout topology per server response and derive a filtered display view from it. Pass visible node/link sets into the Canvas renderer, where a requestAnimationFrame transition updates opacity without a React render, network request, force restart, or camera reset. Move domain semantics into a pure model and toolbar menu markup into a focused component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.8, force-graph Canvas 2D, d3-force, Vitest, Testing Library, Playwright, CSS Modules.

## Global Constraints

- Preserve the existing `/skills/graph` route, URL parameters, data endpoints, purple brand accent, and `design.md` Map / Diagram system.
- Domain selection is `[] = all`; the first domain click isolates it, later clicks add/remove comparison domains, and removing the last returns to all.
- Domain, relationship-density, and label-density changes make zero topology requests, zero force reheats, and zero camera-fit calls.
- Graph visibility motion lasts at most 220ms and uses opacity plus scale only; reduced motion removes scale and finishes within 120ms.
- Keep visible budgets at desktop 48 nodes / 84 links and mobile 30 nodes / 48 links.
- Keep layout budgets at desktop 60 nodes / 96 links and mobile 40 nodes / 64 links.
- Add no runtime dependency and delete no production route or component.
- Use the existing 4px spacing tokens and named easing tokens; do not add browser-default `ease` or `transition-all`.
- Write and verify a failing test before every production behavior change.

---

### Task 1: Pure Domain Filter Model

**Files:**
- Create: `apps/web/src/lib/skill-graph-filters.test.ts`
- Create: `apps/web/src/lib/skill-graph-filters.ts`

**Interfaces:**
- Produces: `type SkillGraphDomainSelection = readonly string[]`
- Produces: `toggleSkillGraphDomain(selection, domain, availableDomains): string[]`
- Produces: `resolveSkillGraphEnabledDomains(selection, availableDomains): string[] | undefined`
- Produces: `skillGraphDomainSummary(selection): string`

- [ ] **Step 1: Write failing domain semantics tests**

```ts
import { describe, expect, it } from "vitest";

import {
  resolveSkillGraphEnabledDomains,
  skillGraphDomainSummary,
  toggleSkillGraphDomain,
} from "./skill-graph-filters";

const domains = ["backend", "frontend", "data"];

describe("skill graph domain filters", () => {
  it("isolates the first selected domain from the all state", () => {
    expect(toggleSkillGraphDomain([], "backend", domains)).toEqual(["backend"]);
  });

  it("adds comparison domains and returns to all after removing the last", () => {
    expect(toggleSkillGraphDomain(["backend"], "data", domains))
      .toEqual(["backend", "data"]);
    expect(toggleSkillGraphDomain(["backend"], "backend", domains)).toEqual([]);
  });

  it("drops unknown domains and summarizes the effective selection", () => {
    expect(resolveSkillGraphEnabledDomains(["backend", "unknown"], domains))
      .toEqual(["backend"]);
    expect(resolveSkillGraphEnabledDomains([], domains)).toBeUndefined();
    expect(skillGraphDomainSummary([])).toBe("전체");
    expect(skillGraphDomainSummary(["backend", "data"])).toBe("2개");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-filters.test.ts`

Expected: FAIL because `./skill-graph-filters` does not exist.

- [ ] **Step 3: Implement the smallest pure model**

```ts
export type SkillGraphDomainSelection = readonly string[];

function normalize(
  selection: SkillGraphDomainSelection,
  availableDomains: readonly string[],
) {
  const available = new Set(availableDomains);
  return [...new Set(selection)].filter((domain) => available.has(domain));
}

export function toggleSkillGraphDomain(
  selection: SkillGraphDomainSelection,
  domain: string,
  availableDomains: readonly string[],
) {
  const current = normalize(selection, availableDomains);
  if (!availableDomains.includes(domain)) return current;
  if (current.includes(domain)) return current.filter((item) => item !== domain);
  return [...current, domain];
}

export function resolveSkillGraphEnabledDomains(
  selection: SkillGraphDomainSelection,
  availableDomains: readonly string[],
) {
  const current = normalize(selection, availableDomains);
  return current.length > 0 ? current : undefined;
}

export function skillGraphDomainSummary(selection: SkillGraphDomainSelection) {
  if (selection.length === 0) return "전체";
  return `${selection.length}개`;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-filters.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Commit the model**

```bash
git add apps/web/src/lib/skill-graph-filters.ts apps/web/src/lib/skill-graph-filters.test.ts
git commit -m "feat(skill-map): define direct domain filter semantics"
```

---

### Task 2: Shared Visibility Transition Model

**Files:**
- Create: `apps/web/src/lib/skill-graph-visibility-transition.test.ts`
- Create: `apps/web/src/lib/skill-graph-visibility-transition.ts`
- Modify: `apps/web/src/lib/skill-graph-canvas-style.test.ts`
- Modify: `apps/web/src/lib/skill-graph-canvas-style.ts`

**Interfaces:**
- Produces: `VisibilityTransition` with `from`, `to`, `startedAt`, `duration`
- Produces: `visibilityAt(transition, now, reduceMotion): number`
- Changes: `skillGraphLinkColor(score, focused, emphasized, opacity = 1): string`

- [ ] **Step 1: Write failing transition and link-opacity tests**

```ts
import { describe, expect, it } from "vitest";
import { visibilityAt } from "./skill-graph-visibility-transition";

describe("visibilityAt", () => {
  const transition = { from: 0, to: 1, startedAt: 100, duration: 220 };

  it("starts at the old value and ends at the target", () => {
    expect(visibilityAt(transition, 100, false)).toBe(0);
    expect(visibilityAt(transition, 320, false)).toBe(1);
  });

  it("moves monotonically and finishes immediately for reduced motion", () => {
    const early = visibilityAt(transition, 140, false);
    const late = visibilityAt(transition, 220, false);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
    expect(visibilityAt(transition, 100, true)).toBe(1);
  });
});
```

Add to `skill-graph-canvas-style.test.ts`:

```ts
expect(skillGraphLinkColor(1, true, false, 0)).toBe("rgba(86, 56, 198, 0)");
expect(skillGraphLinkColor(1, true, false, 0.5)).toBe("rgba(86, 56, 198, 0.23)");
```

- [ ] **Step 2: Run both tests and verify RED**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-visibility-transition.test.ts src/lib/skill-graph-canvas-style.test.ts`

Expected: FAIL because `visibilityAt` and the opacity parameter do not exist.

- [ ] **Step 3: Implement the transition primitive and opacity multiplier**

```ts
export type VisibilityTransition = {
  from: number;
  to: number;
  startedAt: number;
  duration: number;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function visibilityAt(
  transition: VisibilityTransition,
  now: number,
  reduceMotion: boolean,
) {
  if (reduceMotion || transition.duration <= 0) return clamp(transition.to);
  const progress = clamp((now - transition.startedAt) / transition.duration);
  const eased = 1 - Math.pow(1 - progress, 3);
  return clamp(transition.from + (transition.to - transition.from) * eased);
}
```

In `skillGraphLinkColor`, multiply both resting and dimmed alpha by the clamped `opacity` argument before calling `graphCanvasSkillLinkColor`.

- [ ] **Step 4: Run both tests and verify GREEN**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-visibility-transition.test.ts src/lib/skill-graph-canvas-style.test.ts`

Expected: all transition and Canvas style tests pass.

- [ ] **Step 5: Commit the transition model**

```bash
git add apps/web/src/lib/skill-graph-visibility-transition.ts apps/web/src/lib/skill-graph-visibility-transition.test.ts apps/web/src/lib/skill-graph-canvas-style.ts apps/web/src/lib/skill-graph-canvas-style.test.ts
git commit -m "feat(skill-map): add bounded canvas visibility transitions"
```

---

### Task 3: Renderer Visibility Contract and Stable Canvas Updates

**Files:**
- Modify: `apps/web/src/lib/graph-renderer.ts`
- Modify: `apps/web/src/components/skill-graph-force-canvas.tsx`
- Modify: `apps/web/src/lib/skill-graph-canvas-data.test.ts`

**Interfaces:**
- Consumes: `visibilityAt` from Task 2
- Adds: `visibleNodeIds?: ReadonlySet<string>` to `GraphRendererProps`
- Preserves: `visibleLinkIds?: ReadonlySet<string>`
- Produces: Canvas node, link, and label opacity maps updated inside one requestAnimationFrame loop

- [ ] **Step 1: Write a failing renderer-contract test**

Extend `skill-graph-canvas-data.test.ts` with two display masks over the same view data and assert that `skillGraphTopologySignature(view)` remains unchanged while the masks differ. Add a type fixture that passes both `visibleNodeIds` and `visibleLinkIds` through `GraphRendererProps`.

```ts
const firstMask = new Set([view.nodes[0]!.id]);
const secondMask = new Set(view.nodes.map(({ id }) => id));
expect(firstMask).not.toEqual(secondMask);
expect(skillGraphTopologySignature(view)).toBe(skillGraphTopologySignature(view));
```

- [ ] **Step 2: Run the renderer-focused tests and verify RED**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-canvas-data.test.ts src/lib/skill-graph-canvas-style.test.ts src/lib/skill-graph-visibility-transition.test.ts`

Expected: the type fixture fails because `visibleNodeIds` is not part of `GraphRendererProps`.

- [ ] **Step 3: Add the visibility prop and one animation loop**

In `graph-renderer.ts`:

```ts
visibleNodeIds?: ReadonlySet<string>;
```

In `skill-graph-force-canvas.tsx`:

- Keep `visibleNodeIdsRef`, node/link/label opacity maps, and one animation-frame ref.
- On mask or label-limit change, snapshot current opacity, create 220ms transitions, and redraw until all reach the target.
- In reduced motion, assign final opacity and redraw once.
- Multiply node `ctx.globalAlpha` and radius scale by node opacity.
- Return before pointer-area painting when node opacity is below `0.5`.
- Multiply link width and `skillGraphLinkColor` alpha by link opacity; highlighted links may render at full opacity.
- Keep selected and hovered labels at opacity `1`; fade only density-controlled labels.

- [ ] **Step 4: Stop ready-state resets for display-only changes**

Keep the topology effect dependent only on the stable topology object, not on `visibleNodeIds`, `visibleLinkIds`, `display.labelLimit`, or domain selection. Remove `setReady(false)` and `onReadyChange(false)` after the first successful mount. For genuine topology updates, merge coordinates from current nodes before `graph.graphData(nextData)`, then reheat and animate `zoomToFit` only for the explicit scope change.

- [ ] **Step 5: Run renderer-focused tests and verify GREEN**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-canvas-data.test.ts src/lib/skill-graph-canvas-style.test.ts src/lib/skill-graph-visibility-transition.test.ts src/lib/skill-graph-touch.test.ts`

Expected: renderer utility and touch tests pass.

- [ ] **Step 6: Commit the renderer boundary**

```bash
git add apps/web/src/lib/graph-renderer.ts apps/web/src/components/skill-graph-force-canvas.tsx apps/web/src/lib/skill-graph-canvas-data.test.ts
git commit -m "perf(skill-map): keep canvas stable across display filters"
```

---

### Task 4: Focused Toolbar Menus and Direct Filter UX

**Files:**
- Create: `apps/web/src/components/skill-graph-toolbar-menus.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.test.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.tsx`

**Interfaces:**
- Consumes: Task 1 domain functions
- Produces: `SkillGraphToolbarMenus` with grouped `owned`, `domains`, and `display` props
- Keeps: existing `SkillPicker`, legend copy, density labels, and callbacks

- [ ] **Step 1: Write failing component behavior tests**

Add a third `backend` node to a local graph fixture, render it with `initialSelectedSkill="C++"`, then:

```ts
fireEvent.click(screen.getByRole("button", { name: /백엔드/ }));
expect(screen.getByText("1개 기술 · 0개 관계")).toBeInTheDocument();
expect(screen.getByText("분야 1개", { selector: "button" })).toBeInTheDocument();
expect(screen.getByText("기술 하나를 선택하세요")).toBeInTheDocument();
expect(fetchMock.mock.calls.filter(([input]) =>
  String(input).startsWith("/skills/graph/data"),
)).toHaveLength(0);
```

Also test that selecting `데이터` adds a second comparison domain, selecting `전체` restores all nodes, Escape closes the open menu, and the display buttons remain `aria-pressed` controls.

- [ ] **Step 2: Run the component test and verify RED**

Run: `cd apps/web && npm test -- --run src/components/skill-graph-experience.test.tsx`

Expected: FAIL because the first domain click currently excludes only that domain and the menus are `<details>` without light-dismiss state.

- [ ] **Step 3: Replace exclusion state with explicit selection state**

In `skill-graph-experience.tsx`:

```ts
const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
const availableDomainIds = allDomains.map(({ domain }) => domain);
const enabledDomains = resolveSkillGraphEnabledDomains(
  selectedDomains,
  availableDomainIds,
);
```

Build filtered `viewData` with `enabledDomains`. Build separate unfiltered `layoutData` with the bounded layout budgets. Derive `visibleNodeIds` from `viewData.nodes` and pass both data sets to the renderer. When a filter excludes the selected node, clear selection, replace the URL, and announce the reason.

- [ ] **Step 4: Extract the toolbar menus**

Move the four toolbar menu bodies into `SkillGraphToolbarMenus`. Keep exactly one `openMenu` state in that component. Buttons expose `aria-expanded` and panels expose `role="dialog"` with an accessible label. Close on outside pointer down and Escape; return focus to the trigger on Escape.

- [ ] **Step 5: Run the component test and verify GREEN**

Run: `cd apps/web && npm test -- --run src/components/skill-graph-experience.test.tsx src/lib/skill-graph-filters.test.ts`

Expected: all experience and filter tests pass with no topology request on display filtering.

- [ ] **Step 6: Commit the toolbar and filter integration**

```bash
git add apps/web/src/components/skill-graph-toolbar-menus.tsx apps/web/src/components/skill-graph-experience.tsx apps/web/src/components/skill-graph-experience.test.tsx
git commit -m "feat(skill-map): make domain filtering direct and legible"
```

---

### Task 5: Purposeful Motion, Responsive States, and CSS Cleanup

**Files:**
- Modify: `apps/web/src/components/skill-graph-atlas.module.css`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/styles/skill-graph-layout.test.ts`
- Modify: `design.md`

**Interfaces:**
- Consumes: existing `--ease-out`, `--ease-in`, `--dur-short`, and reduced-motion system
- Produces: menu reveal, HUD result swap, pressed controls, and initial-only Canvas reveal styles

- [ ] **Step 1: Write failing CSS contract assertions**

Add assertions that:

```ts
expect(css).not.toContain("transition: opacity 520ms ease;");
expect(css).toContain("transition: opacity var(--dur-short) var(--ease-out);");
expect(graphCss).toContain("@keyframes skillGraphMenuReveal");
expect(graphCss).toContain("@keyframes skillGraphMetricSwap");
expect(graphCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform: none;/);
expect(graphCss).toContain(".toolbarMenuTrigger:active");
```

- [ ] **Step 2: Run the CSS test and verify RED**

Run: `cd apps/web && npm test -- --run src/styles/skill-graph-layout.test.ts`

Expected: FAIL on the old 520ms default easing and missing menu/metric states.

- [ ] **Step 3: Implement the three motion primitives**

- Change `.force-canvas` to an initial-only 220ms opacity transition using `var(--ease-out)`.
- Add a 180ms popover enter using opacity and `translateY(-4px)` only.
- Add a 120ms HUD metric enter using opacity and `translateY(2px)` only.
- Add 100ms pressed feedback to toolbar triggers and segmented buttons while leaving focus rings instant.
- Add reduced-motion rules that remove spatial transform and cap opacity transition at 120ms.
- Keep every control at least 44px on coarse pointers and every label on one line at 320px.

- [ ] **Step 4: Update the locked design contract**

Append to the skill-map allowance in `design.md`: direct first-click domain filtering, stable visibility-only transitions, and the three allowed motion primitives. Do not change palette, typography, navigation, or page macrostructure.

- [ ] **Step 5: Run CSS and component tests and verify GREEN**

Run: `cd apps/web && npm test -- --run src/styles/skill-graph-layout.test.ts src/components/skill-graph-experience.test.tsx`

Expected: CSS contract and experience tests pass.

- [ ] **Step 6: Commit visual states**

```bash
git add apps/web/src/components/skill-graph-atlas.module.css apps/web/src/app/globals.css apps/web/src/styles/skill-graph-layout.test.ts design.md
git commit -m "style(skill-map): clarify filter motion and control states"
```

---

### Task 6: Focused Browser Verification and Hallmark Audit

**Files:**
- Modify: `.hallmark/log.json`
- Modify only if a verified defect is found: files from Tasks 1–5

**Interfaces:**
- Verifies the complete behavior; introduces no new product interface

- [ ] **Step 1: Run focused unit and component tests**

Run:

```bash
cd apps/web
npm test -- --run \
  src/lib/skill-graph-filters.test.ts \
  src/lib/skill-graph-visibility-transition.test.ts \
  src/lib/skill-graph-canvas-style.test.ts \
  src/lib/skill-graph-canvas-data.test.ts \
  src/lib/skill-graph-touch.test.ts \
  src/components/skill-graph-experience.test.tsx \
  src/styles/skill-graph-layout.test.ts
```

Expected: all selected files pass with zero failures.

- [ ] **Step 2: Run type checking and production build**

Run: `cd apps/web && npm run lint && npm run build`

Expected: both commands exit 0.

- [ ] **Step 3: Run only the skill-map browser suite**

Run: `cd apps/web && npx playwright test e2e/skill-map.e2e.ts --project=chromium`

Expected: all skill-map flows pass. Do not run unrelated browser suites locally.

- [ ] **Step 4: Verify the original production symptom locally**

At 1440px and 390px:

- Open the domain menu and click `백엔드`; verify the summary becomes `분야 1개` and HUD count changes.
- Observe `.force-canvas--ready` remains present during the click.
- Confirm no `/skills/graph/data` request occurs.
- Switch `핵심 → 균형 → 자세히` and `주요만 → 더 많이`; confirm Canvas stays ready and the pixel output changes.
- Open a toolbar menu and press Escape; confirm it closes and focus returns to its trigger.
- Emulate reduced motion; confirm no scale or positional motion occurs.

- [ ] **Step 5: Run Hallmark end audit**

Load `hallmark/references/slop-test.md` and `contract.md`, run the 58 gates, record the six pre-emit scores, verified widths, and performance observations in `.hallmark/log.json`. Fix only verified failures and rerun their focused checks.

- [ ] **Step 6: Commit audit evidence**

```bash
git add .hallmark/log.json
git commit -m "docs: record skill map interaction audit"
```

---

### Task 7: Publish, Merge, and Verify Production

**Files:**
- No source changes unless CI or production verification identifies a reproducible defect

**Interfaces:**
- Produces: merged PR and verified Vercel production deployment

- [ ] **Step 1: Verify clean branch and intentional diff**

Run: `git status --short --branch && git diff origin/main...HEAD --check && git log --oneline origin/main..HEAD`

Expected: clean worktree, no whitespace errors, only the planned commits.

- [ ] **Step 2: Push and open a ready PR**

Run: `git push -u origin fix/skill-map-filter-motion`

Create a PR titled `fix: make skill map filters responsive` with root cause, UX contract, performance changes, and verification evidence.

- [ ] **Step 3: Monitor PR checks and address only reproducible failures**

Expected required checks: web, backend, Vercel web preview, Vercel API preview all successful.

- [ ] **Step 4: Merge with the verified head SHA**

Use squash merge after all checks pass. Record the resulting `main` commit SHA.

- [ ] **Step 5: Monitor main CI and production deployment**

Expected: main web/backend CI success and Vercel web/API deployment status success for the merge SHA.

- [ ] **Step 6: Verify the public route**

Open `https://ejik-fit-web.vercel.app/skills/graph?seed=C%2B%2B`, repeat the desktop and mobile domain/density/menu checks, verify HTTP 200, no console error, and the new `분야 전체` semantics.
