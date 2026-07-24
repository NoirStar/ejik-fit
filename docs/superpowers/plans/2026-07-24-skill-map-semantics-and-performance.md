# Skill Map Semantics and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make graph color, size, and line weight self-explanatory while stopping force work after a finite layout on every device.

**Architecture:** `skill-graph-view` remains the data-to-view boundary for demand and co-occurrence encodings. A new pure relation module precomputes adjacency and highlight ratios. The Canvas renderer reads that index, requests redraws without reheating on hover/select, and uses finite animation profiles; the React experience owns visible legend and inspector copy.

**Tech Stack:** React 19, TypeScript, force-graph Canvas 2D, d3-force, Vitest, Playwright

## Global Constraints

- Color means primary job domain, node size means public posting demand, and skill-edge width means raw co-occurrence count.
- Edge opacity continues to reflect normalized `score`.
- Seed and selected skills use the same demand-based base size as every other skill.
- Related-node focus scale is `1 + sqrt(count / maxFocusedCount) * 0.22`.
- No multiple rings, persistent glow, pulse, or infinite force cooldown.
- Hover and selection must not call `d3ReheatSimulation()`.
- Canvas 2D remains the renderer; no Sigma/WebGL migration or new dependency.
- Mobile tap and desktop hover expose the same direct relationships.

---

### Task 1: Encode demand and raw co-occurrence in view data

**Files:**
- Modify: `apps/web/src/lib/skill-graph-view.ts`
- Modify: `apps/web/src/lib/skill-graph-view.test.ts`
- Modify: `apps/web/src/lib/large-graph-fixture.ts`

**Interfaces:**
- Consumes: `SkillGraphNode.demand_count`, `SkillGraphEdge.cooccurrence_count`, and `SkillGraphEdge.score`.
- Produces: `SkillGraphViewLink.cooccurrenceCount: number`; `val` and `value` are finite, clamped display values.

- [ ] **Step 1: Write failing view-model tests**

Add assertions that a low-demand seed is smaller than a high-demand non-seed, and a seven-count edge is wider than a three-count edge:

```ts
expect(seedNode.val).toBeCloseTo(3.2 + Math.sqrt(seedNode.demandCount) * 1.15);
expect(highDemandNode.val).toBeGreaterThan(seedNode.val);
expect(strongLink.cooccurrenceCount).toBe(7);
expect(strongLink.value).toBeGreaterThan(weakLink.value);
```

- [ ] **Step 2: Run the view test and verify the seed assertion fails**

Run: `npm test -- --run src/lib/skill-graph-view.test.ts`

Expected: FAIL because the seed has fixed `val: 12` and links use `score` only.

- [ ] **Step 3: Implement the two single-purpose transforms**

Use:

```ts
function skillNodeValue(node: SkillGraphNode) {
  return clamp(3.2 + Math.sqrt(safeCount(node.demand_count)) * 1.15, 3.2, 10);
}

function linkValue(cooccurrenceCount: number) {
  return clamp(0.55 + Math.sqrt(safeCount(cooccurrenceCount)) * 0.72, 0.55, 4.5);
}
```

Set `cooccurrenceCount: edge.cooccurrence_count` on skill links and `0` on evidence links. Update large fixtures to populate the new field.

- [ ] **Step 4: Run all view and fixture tests**

Run: `npm test -- --run src/lib/skill-graph-view.test.ts src/lib/large-graph-fixture.test.ts src/lib/graph-renderer.test.ts`

Expected: PASS with no non-finite display values.

- [ ] **Step 5: Commit the semantic data boundary**

```bash
git add apps/web/src/lib/skill-graph-view.ts apps/web/src/lib/skill-graph-view.test.ts apps/web/src/lib/large-graph-fixture.ts
git commit -m "feat: encode skill demand and cooccurrence in graph data"
```

### Task 2: Build a reusable adjacency and highlight model

**Files:**
- Create: `apps/web/src/lib/skill-graph-relations.ts`
- Create: `apps/web/src/lib/skill-graph-relations.test.ts`

**Interfaces:**
- Consumes: `SkillGraphViewLink[]`.
- Produces: `buildSkillGraphAdjacency(links): SkillGraphAdjacency` and `buildSkillGraphHighlight(nodeId, adjacency): SkillGraphHighlight`.

- [ ] **Step 1: Write failing pure tests**

For links `A-B:9`, `A-C:4`, and evidence `posting-A`, assert:

```ts
expect(highlight.nodeIds).toEqual(new Set(["A", "B", "C", "posting:1"]));
expect(highlight.linkIds).toEqual(new Set(["A:B", "A:C", "posting:1:A"]));
expect(highlight.relationRatios.get("B")).toBe(1);
expect(highlight.relationRatios.get("C")).toBeCloseTo(2 / 3);
expect(highlight.relationRatios.get("posting:1")).toBe(0);
```

- [ ] **Step 2: Run the test and verify the module does not exist**

Run: `npm test -- --run src/lib/skill-graph-relations.test.ts`

Expected: FAIL with a module resolution error.

- [ ] **Step 3: Implement adjacency in one pass**

The module must create one mutable entry per endpoint while building, add every direct node/link, store raw counts only for `kind === "skill"`, and freeze the result behind readonly exported types. `buildSkillGraphHighlight` returns empty sets for `null` or unknown IDs and calculates each ratio with:

```ts
const ratio = maxCooccurrenceCount > 0
  ? Math.sqrt(cooccurrenceCount / maxCooccurrenceCount)
  : 0;
```

- [ ] **Step 4: Run the relation tests**

Run: `npm test -- --run src/lib/skill-graph-relations.test.ts`

Expected: PASS for direct neighbors, evidence links, unknown IDs, and zero counts.

- [ ] **Step 5: Commit the pure relation model**

```bash
git add apps/web/src/lib/skill-graph-relations.ts apps/web/src/lib/skill-graph-relations.test.ts
git commit -m "feat: index direct skill graph relationships"
```

### Task 3: Add the legend and complete selected-skill facts

**Files:**
- Modify: `apps/web/src/components/skill-graph-experience.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.module.css`
- Modify: `apps/web/src/components/skill-graph-experience.test.tsx`

**Interfaces:**
- Consumes: selected graph node and `strongestConnections`.
- Produces: visible legend `색: 분야 · 크기: 언급 공고 · 선: 함께 등장` and inspector metric `직접 연결`.

- [ ] **Step 1: Write failing accessibility tests**

Assert:

```ts
const legend = screen.getByRole("note", { name: "스킬맵 범례" });
expect(legend).toHaveTextContent("색: 분야");
expect(legend).toHaveTextContent("크기: 언급 공고");
expect(legend).toHaveTextContent("선: 함께 등장");
expect(screen.getByText("직접 연결").nextElementSibling).toHaveTextContent("1개");
```

- [ ] **Step 2: Run the experience test and verify the legend is absent**

Run: `npm test -- --run src/components/skill-graph-experience.test.tsx`

Expected: FAIL because the legend and metric are missing.

- [ ] **Step 3: Add restrained responsive markup and styles**

Place this inside `graphFrame` without covering controls:

```tsx
<p aria-label="스킬맵 범례" className={styles.graphLegend} role="note">
  <span><b>색</b>: 분야</span>
  <i aria-hidden="true" />
  <span><b>크기</b>: 언급 공고</span>
  <i aria-hidden="true" />
  <span><b>선</b>: 함께 등장</span>
</p>
```

Add a fifth inspector metric with `{selected ? `${strongestConnections.length}개` : "—"}`. On desktop pin the legend at the top left; at `max-width: 640px`, make it a compact top row with a translucent surface and allow wrapping. Keep it clear of the bottom mobile controls.

- [ ] **Step 4: Run component and layout tests**

Run: `npm test -- --run src/components/skill-graph-experience.test.tsx src/styles/skill-graph-layout.test.ts`

Expected: PASS with the legend readable at the DOM level.

- [ ] **Step 5: Commit the visible meaning**

```bash
git add apps/web/src/components/skill-graph-experience.tsx apps/web/src/components/skill-graph-experience.module.css apps/web/src/components/skill-graph-experience.test.tsx
git commit -m "feat: explain skill graph visual encodings"
```

### Task 4: Make force layout finite and highlights calculation-only

**Files:**
- Modify: `apps/web/src/components/skill-graph-force-canvas.tsx`
- Create: `apps/web/src/lib/skill-graph-animation.ts`
- Create: `apps/web/src/lib/skill-graph-animation.test.ts`

**Interfaces:**
- Consumes: `buildSkillGraphAdjacency`, `buildSkillGraphHighlight`, display and force settings.
- Produces: finite `{ warmupTicks, cooldownTicks, cooldownTime }`, Korean tooltip copy, one-redraw hover/select, visibility pause/resume.

- [ ] **Step 1: Write failing finite-profile tests**

```ts
expect(skillGraphAnimationProfile(false)).toEqual({
  warmupTicks: 24,
  cooldownTicks: 72,
  cooldownTime: 2400,
});
expect(skillGraphAnimationProfile(true)).toEqual({
  warmupTicks: 72,
  cooldownTicks: 0,
  cooldownTime: 0,
});
for (const value of Object.values(skillGraphAnimationProfile(false))) {
  expect(Number.isFinite(value)).toBe(true);
}
```

- [ ] **Step 2: Run the animation test and verify the module is missing**

Run: `npm test -- --run src/lib/skill-graph-animation.test.ts`

Expected: FAIL with a module resolution error.

- [ ] **Step 3: Implement the profile and apply it in the Canvas renderer**

Create the pure profile exactly as tested. In the renderer:

- build adjacency in `useMemo(() => buildSkillGraphAdjacency(data.links), [data.links])` and keep it in a ref used by registered callbacks;
- on hover, derive the highlight in O(degree) and request a redraw with `graph.zoom(graph.zoom())`;
- on hover exit, restore the selected-node highlight;
- set neighbor radius multiplier to `1 + ratio * 0.22`;
- set focused edge width multiplier to `1 + ratio * 0.35`;
- remove every hover, click, drag, selection, and display-effect `d3ReheatSimulation()` call;
- set `autoPauseRedraw(true)` in all profiles;
- only data/force changes and the explicit `reheatKey` path call `d3ReheatSimulation()` once;
- replace the 18-frame nudge pulse with one `nudgeGraph` call;
- pause on `visibilitychange` when hidden and resume without reheating when visible;
- use no resting skill-node shadow and a small selected/hover shadow only.

Format skill tooltips as:

```ts
`${node.label} · ${formatDomainLabel(node.domain)} · 언급 공고 ${node.demandCount}건 · 직접 연결 ${relation?.neighborSkillCount ?? 0}개`
```

Append ` · 선택 기술과 함께 ${count}건` only when a different selected skill has a raw direct count.

- [ ] **Step 4: Run relation, profile, view, and type tests**

Run: `npm test -- --run src/lib/skill-graph-animation.test.ts src/lib/skill-graph-relations.test.ts src/lib/skill-graph-view.test.ts src/components/skill-graph-experience.test.tsx`

Run: `npm run lint`

Expected: all tests PASS, no `Infinity` force configuration remains, and TypeScript exits with code 0.

- [ ] **Step 5: Commit the renderer lifecycle change**

```bash
git add apps/web/src/components/skill-graph-force-canvas.tsx apps/web/src/lib/skill-graph-animation.ts apps/web/src/lib/skill-graph-animation.test.ts
git commit -m "perf: stop skill graph work after layout settles"
```

### Task 5: Verify desktop, mobile, reduced-motion, and performance behavior

**Files:**
- Modify: `apps/web/e2e/skill-map.e2e.ts`

**Interfaces:**
- Consumes: built production standalone fixture.
- Produces: regression evidence for legend placement, Korean tooltip, stable Canvas, touch selection, and bounded post-layout work.

- [ ] **Step 1: Add browser assertions before running**

At 1440px, 820px, and 390px assert `getByRole("note", { name: "스킬맵 범례" })` is visible and does not overlap `.force-canvas__controls`. Update tooltip matching from `${skill} /` to `${skill} ·`. Add a CDP-throttled test that waits for two stable Canvas fingerprints, then observes four seconds and asserts no task duration spike above the documented 800ms budget.

- [ ] **Step 2: Build the production application**

Run: `npm run build`

Expected: Next.js build exits with code 0.

- [ ] **Step 3: Run the skill-map browser suite**

Run: `npx playwright test e2e/skill-map.e2e.ts`

Expected: PASS for 1440px, 820px, 390px, 320px, touch pan/pinch/select, and reduced motion.

- [ ] **Step 4: Run the performance budget**

Run: `npm run test:performance`

Expected: PASS with post-layout TaskDuration at or below 800ms under 6x CPU throttling and no 200ms long task during interaction.

- [ ] **Step 5: Commit browser coverage**

```bash
git add apps/web/e2e/skill-map.e2e.ts
git commit -m "test: cover stable skill graph interactions"
```
