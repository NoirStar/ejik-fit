# Obsidian-like Skill Market Map V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unstable local-first skill graph with a spatial-first market atlas that preserves the big picture, highlights selection without moving the viewport, and exposes evidence-backed next actions.

**Architecture:** Server-render a public 60-node atlas and merge a rare URL seed neighborhood only when necessary. Prune the Canvas payload to fixed desktop/mobile budgets, preserve topology on selection, and request a 30-node local graph only from the explicit nearby-view action. Place search, scope, saved skills, domain filters, and legend in one compact toolbar above a large Canvas with a single evidence rail.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, force-graph Canvas 2D, d3-force, CSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Keep the existing purple brand, Pretendard typography, 4px spacing scale, and modern-minimal product shell.
- Desktop Canvas budget is at most 48 nodes and 84 links; mobile is at most 30 nodes and 48 links; nearby view is at most 18 nodes and 30 links.
- A normal node selection must not request topology, reheat the force simulation, recenter, or zoom.
- Only explicit nearby/depth actions may request seeded topology with an API limit of 30.
- Default mobile interaction remains document scroll plus node tap; pan and pinch require explicit graph-control mode.
- Do not add a WebGL renderer or change backend extraction and relationship scoring.
- Run focused tests only, then lint/build and a small browser verification matrix.

---

### Task 1: Public atlas data and deterministic view budgets

**Files:**
- Create: `apps/web/src/lib/skill-graph-data.ts`
- Create: `apps/web/src/lib/skill-graph-data.test.ts`
- Modify: `apps/web/src/app/skills/graph/page.tsx`
- Modify: `apps/web/src/app/skills/graph/page.test.tsx`
- Modify: `apps/web/src/lib/skill-graph-view.ts`
- Modify: `apps/web/src/lib/skill-graph-view.test.ts`

**Interfaces:**
- Produces: `mergeSkillGraphResponses(atlas, neighborhood): SkillGraphResponse`
- Produces: atlas view defaults of 48 nodes/84 links and focus defaults of 18 nodes/30 links.
- Produces: `initialSelectedSkill?: string` for `SkillGraphExperience`.

- [ ] **Step 1: Write failing view-budget and merge tests**

```ts
it("renders a readable desktop atlas", () => {
  const view = buildSkillGraphView(denseGraph(60), { mode: "all" });
  expect(view.nodes).toHaveLength(48);
  expect(view.links.length).toBeLessThanOrEqual(84);
});

it("keeps an off-rank selected skill in the atlas", () => {
  const view = buildSkillGraphView(denseGraph(60), {
    mode: "all",
    selectedId: "skill-59",
  });
  expect(view.nodes.some(({ id }) => id === "skill-59")).toBe(true);
});

it("merges a rare neighborhood without duplicate nodes or edges", () => {
  const merged = mergeSkillGraphResponses(atlas, neighborhood);
  expect(new Set(merged.nodes.map(({ id }) => id)).size).toBe(merged.nodes.length);
  expect(new Set(merged.edges.map(({ id }) => id)).size).toBe(merged.edges.length);
});
```

- [ ] **Step 2: Run the focused tests and confirm the old limits fail**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-view.test.ts src/lib/skill-graph-data.test.ts src/app/skills/graph/page.test.tsx`

Expected: failures showing the old 12/18 and 30/45 budgets, and the missing merge helper.

- [ ] **Step 3: Implement atlas selection and graph merging**

```ts
const DEFAULT_LIMITS = {
  overview: { nodes: 36, links: 60 },
  focus: { nodes: 18, links: 30 },
  all: { nodes: 48, links: 84 },
} satisfies Record<SkillGraphViewMode, { nodes: number; links: number }>;

function ensureSelectedNode(
  ranked: SkillGraphNode[],
  selectedId: string | null | undefined,
  limit: number,
) {
  const visible = ranked.slice(0, limit);
  const selected = selectedId
    ? ranked.find(({ id }) => id === selectedId)
    : undefined;
  if (selected && !visible.some(({ id }) => id === selected.id)) {
    visible[visible.length - 1] = selected;
    visible.sort(compareNodes);
  }
  return visible;
}
```

`page.tsx` must request `getSkillGraph({ career_type, depth: 1, limit: 60, include_evidence: false })` without a seed, pass the URL seed as `initialSelectedSkill`, and only make a second seeded request when the atlas does not contain that skill.

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-view.test.ts src/lib/skill-graph-data.test.ts src/app/skills/graph/page.test.tsx`

Expected: all selected files pass.

- [ ] **Step 5: Commit the atlas data contract**

```bash
git add apps/web/src/lib/skill-graph-data.ts apps/web/src/lib/skill-graph-data.test.ts apps/web/src/lib/skill-graph-view.ts apps/web/src/lib/skill-graph-view.test.ts apps/web/src/app/skills/graph/page.tsx apps/web/src/app/skills/graph/page.test.tsx
git commit -m "feat(skill-map): load a stable market atlas"
```

### Task 2: Stable Canvas selection and semantic domain clusters

**Files:**
- Modify: `apps/web/src/lib/graph-renderer.ts`
- Modify: `apps/web/src/components/skill-graph-force-canvas.tsx`
- Modify: `apps/web/src/lib/skill-graph-canvas-style.ts`
- Modify: `apps/web/src/lib/skill-graph-canvas-style.test.ts`
- Modify: `apps/web/src/lib/skill-graph-canvas-data.test.ts`

**Interfaces:**
- Extends: `GraphRendererForceSettings` with `cluster: number` and `clusterSpread: number`.
- Preserves: `onNodeSelect(nodeId)` as a state-only selection callback.

- [ ] **Step 1: Add failing tests for stronger demand hierarchy and topology-only signatures**

```ts
it("keeps visual selection outside the topology signature", () => {
  expect(skillGraphTopologySignature(selectedView))
    .toBe(skillGraphTopologySignature(unselectedView));
});

it("keeps resting links thin while allowing a selected relation to read", () => {
  expect(skillGraphLinkWidth(1, 1, true, 1)).toBeLessThanOrEqual(1.35);
});
```

- [ ] **Step 2: Run the Canvas helper tests**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-canvas-style.test.ts src/lib/skill-graph-canvas-data.test.ts`

Expected: the new topology/scale assertion fails before implementation.

- [ ] **Step 3: Implement stable selection and clustered forces**

Remove every `centerAt(...).zoom(...)` call from normal node selection and the selected-ID effect. Initial data and explicit topology changes use only `zoomToFit`.

```ts
graph
  .d3Force("center", null)
  .d3Force(
    "x",
    forceX<SkillForceNode>((node) => domainAnchor(node.domain, forces.clusterSpread).x)
      .strength(forces.cluster),
  )
  .d3Force(
    "y",
    forceY<SkillForceNode>((node) => domainAnchor(node.domain, forces.clusterSpread).y)
      .strength(forces.cluster),
  );
```

Raise label eligibility from 8 to 14, keep collision suppression, and widen the demand radius mapping to 4–12.5 without adding thick or glowing links.

- [ ] **Step 4: Re-run the Canvas helper tests**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-canvas-style.test.ts src/lib/skill-graph-canvas-data.test.ts`

Expected: pass.

- [ ] **Step 5: Commit the Canvas behavior**

```bash
git add apps/web/src/lib/graph-renderer.ts apps/web/src/components/skill-graph-force-canvas.tsx apps/web/src/lib/skill-graph-canvas-style.ts apps/web/src/lib/skill-graph-canvas-style.test.ts apps/web/src/lib/skill-graph-canvas-data.test.ts
git commit -m "feat(skill-map): preserve the graph viewport on selection"
```

### Task 3: Spatial-first page shell, search, and explicit nearby mode

**Files:**
- Create: `apps/web/src/components/skill-graph-search.tsx`
- Create: `apps/web/src/components/skill-graph-search.module.css`
- Create: `apps/web/src/components/skill-graph-search.test.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.test.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.module.css`
- Modify: `apps/web/src/styles/skill-graph-layout.test.ts`

**Interfaces:**
- Produces: `SkillGraphSearch({ catalog, onSelect, value, onValueChange })` with at most six suggestions.
- Changes: normal `selectSkill` updates selection/evidence/URL only.
- Produces: `showNearbyGraph()` as the only seeded topology entry point besides depth changes and rare search.

- [ ] **Step 1: Write failing interaction tests**

```tsx
fireEvent.click(screen.getByRole("button", { name: "C++" }));
expect(screen.getByRole("button", { name: "전체 지도" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/skills/graph/data")))
  .toBe(false);

fireEvent.click(screen.getByRole("button", { name: "선택 주변 보기" }));
await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
  "/skills/graph/data?limit=30&depth=1&seed=C%2B%2B",
  expect.objectContaining({ signal: expect.any(AbortSignal) }),
));
```

Add one search test proving an empty input does not show the entire catalog and ArrowDown/Enter selects a filtered result.

- [ ] **Step 2: Run the component and layout tests and confirm failure**

Run: `cd apps/web && npm test -- --run src/components/skill-graph-search.test.tsx src/components/skill-graph-experience.test.tsx src/styles/skill-graph-layout.test.ts`

Expected: old selection fetch/mode behavior and missing toolbar/search fail.

- [ ] **Step 3: Build the compact toolbar and explicit scope model**

Use this visible order:

```tsx
<header>스킬맵 · 공개 채용 공고에서 함께 요구되는 기술 관계</header>
<div className={styles.toolbar}>
  <SkillGraphSearch />
  <div role="group" aria-label="지도 범위">
    <button>전체 지도</button>
    <button disabled={!selectedId}>선택 주변 보기</button>
  </div>
  <details><summary>내 기술 {ownedSkills.length}</summary></details>
  <details><summary>분야</summary></details>
  <details><summary>읽는 법</summary></details>
</div>
<div className={styles.workspace}>
  <section className={styles.graphColumn}>…</section>
  <aside className={styles.inspector}>…</aside>
</div>
```

Reuse the shared `SkillPicker` inside the saved-skill popover. Remove the quick-chip row, three large control cards, graph-bottom recommendation/domain cards, and duplicate actions. Keep one primary related-jobs action and one secondary saved-skill action.

- [ ] **Step 4: Make the graph the first and largest mobile work surface**

The graph must use `height: clamp(38rem, calc(100dvh - 13rem), 52rem)` on wide screens and `height: clamp(29rem, 62dvh, 36rem)` on phones. Below 64rem, stack graph before inspector. Preserve safe-area offsets for Canvas controls and add a selected-skill `분석 보기` bar on mobile.

- [ ] **Step 5: Re-run focused component tests**

Run: `cd apps/web && npm test -- --run src/components/skill-graph-search.test.tsx src/components/skill-graph-experience.test.tsx src/styles/skill-graph-layout.test.ts`

Expected: pass.

- [ ] **Step 6: Commit the spatial-first UI**

```bash
git add apps/web/src/components/skill-graph-search.tsx apps/web/src/components/skill-graph-search.module.css apps/web/src/components/skill-graph-search.test.tsx apps/web/src/components/skill-graph-experience.tsx apps/web/src/components/skill-graph-experience.test.tsx apps/web/src/components/skill-graph-experience.module.css apps/web/src/styles/skill-graph-layout.test.ts
git commit -m "feat(skill-map): make the market atlas the primary workspace"
```

### Task 4: Focused verification, Hallmark audit, and production delivery

**Files:**
- Modify: `.hallmark/log.json`
- Modify: `apps/web/e2e/skill-map.e2e.ts` only if an existing selector no longer matches the intentional UI

**Interfaces:**
- Produces: current screenshot evidence and an updated Hallmark audit entry.

- [ ] **Step 1: Run focused unit verification**

Run: `cd apps/web && npm test -- --run src/lib/skill-graph-data.test.ts src/lib/skill-graph-view.test.ts src/lib/skill-graph-canvas-style.test.ts src/lib/skill-graph-canvas-data.test.ts src/components/skill-graph-search.test.tsx src/components/skill-graph-experience.test.tsx src/app/skills/graph/page.test.tsx src/styles/skill-graph-layout.test.ts`

Expected: all selected files pass.

- [ ] **Step 2: Run type and production checks**

Run: `cd apps/web && npm run lint && npm run build`

Expected: both exit 0.

- [ ] **Step 3: Verify the real browser experience**

Run the skill-map Playwright file, then inspect screenshots at 320, 390, 768, 1024, and 1440 CSS px. Confirm no horizontal overflow, no mobile-nav overlap, Canvas paint, document scroll before opt-in, node tap, pan/pinch after opt-in, stable viewport after a normal selection, and a topology request only after `선택 주변 보기`.

- [ ] **Step 4: Run the Hallmark slop test and update the audit log**

Load `hallmark/references/slop-test.md` only after the build. Record any fixed findings, exact verification widths, test counts, visual grammar, and any intentional exception in `.hallmark/log.json`.

- [ ] **Step 5: Review the diff and commit verification metadata**

```bash
git diff --check
git status --short
git add .hallmark/log.json apps/web/e2e/skill-map.e2e.ts
git commit -m "test(skill-map): verify the spatial atlas experience"
```

Skip the last file in `git add` when the Playwright source did not require a selector change.

- [ ] **Step 6: Push, open a pull request, wait for CI, merge, and verify production**

Push `feat/obsidian-skill-map-v2`, open a focused PR against `main`, wait for required GitHub Actions and Vercel checks, merge only when green, then run the public deployment smoke check and open `/skills/graph` on the production URL.

Expected: CI and deployment checks are green; the merged production route renders the atlas-first design.
