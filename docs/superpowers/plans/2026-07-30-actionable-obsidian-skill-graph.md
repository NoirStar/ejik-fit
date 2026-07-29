# Actionable Obsidian Skill Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the stable market atlas while adding Obsidian-style display-density controls and an honest, actionable market-connection path from a user's owned skills to the selected skill.

**Architecture:** Keep the existing `SkillGraphViewData` topology fixed and derive paint-only visibility and emphasis sets in pure helpers. Compute a bounded weighted path from the already-rendered graph, pass optional visibility/emphasis contracts through the renderer adapter, and expose both features through the existing compact toolbar and inspector without new network requests.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.8, force-graph Canvas 2D, CSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve the existing purple brand, Pretendard typography, `Map / Diagram` macrostructure, and 44×44px touch target.
- Keep desktop at no more than 48 nodes/84 links and mobile at no more than 30 nodes/48 links.
- Selecting a node, changing display density, and toggling a path must not fetch topology, reheat the simulation, recenter, or zoom.
- Treat relationships as undirected co-occurrence in public job postings; never describe the path as a prerequisite or learning order.
- Relationship and label settings change paint only; all links remain in force calculations so the mental map is stable.
- Keep the existing page-scroll-first mobile interaction and explicit graph-manipulation mode.
- Add only tests that directly cover path selection, visibility, controls, and topology-request regression.

---

### Task 1: Weighted Market-Connection Path

**Files:**
- Create: `apps/web/src/lib/skill-graph-path.ts`
- Create: `apps/web/src/lib/skill-graph-path.test.ts`

**Interfaces:**
- Consumes: `SkillGraphViewNode[]`, `SkillGraphViewLink[]`, owned node IDs, selected node ID.
- Produces: `findStrongestSkillGraphPath(options): SkillGraphMarketPath | null`.

- [ ] **Step 1: Write failing path tests**

Cover a strong direct relationship, a two-hop strong bridge beating a weak direct edge, the best of multiple owned sources, a four-hop ceiling, target-already-owned, and no path.

```ts
const path = findStrongestSkillGraphPath({
  nodes: [node("C++"), node("Linux"), node("Docker")],
  links: [
    link("cpp-linux", "C++", "Linux", 0.95, 40),
    link("linux-docker", "Linux", "Docker", 0.92, 31),
    link("cpp-docker", "C++", "Docker", 0.08, 1),
  ],
  sourceIds: ["C++"],
  targetId: "Docker",
  maxHops: 4,
});
expect(path?.nodeIds).toEqual(["C++", "Linux", "Docker"]);
expect(path?.linkIds).toEqual(["cpp-linux", "linux-docker"]);
```

- [ ] **Step 2: Verify the tests fail for the missing module**

Run: `npm test -- --run src/lib/skill-graph-path.test.ts`

Expected: FAIL because `skill-graph-path.ts` does not exist.

- [ ] **Step 3: Implement the bounded deterministic path helper**

Use a positive edge cost so Dijkstra remains valid:

```ts
function edgeCost(link: SkillGraphViewLink) {
  const score = clamp(link.score, 0, 1);
  const count = Math.max(0, link.cooccurrenceCount);
  return 1 + (1 - score) * 4 + 1 / Math.sqrt(count + 1);
}
```

Store node and link sequences in each queue state, reject repeated nodes, stop expansion at `maxHops`, sort adjacency and queue ties by stable signatures, and return:

```ts
export type SkillGraphMarketPath = {
  nodeIds: string[];
  linkIds: string[];
  sourceId: string;
  targetId: string;
  hopCount: number;
  weakestCooccurrenceCount: number;
  averageScore: number;
};
```

- [ ] **Step 4: Run the path tests**

Run: `npm test -- --run src/lib/skill-graph-path.test.ts`

Expected: PASS with all path cases green.

- [ ] **Step 5: Commit the path helper**

```bash
git add apps/web/src/lib/skill-graph-path.ts apps/web/src/lib/skill-graph-path.test.ts
git commit -m "feat(skill-map): derive market connection paths"
```

### Task 2: Paint-Only Relationship and Label Density

**Files:**
- Create: `apps/web/src/lib/skill-graph-visibility.ts`
- Create: `apps/web/src/lib/skill-graph-visibility.test.ts`
- Modify: `apps/web/src/lib/graph-renderer.ts`
- Modify: `apps/web/src/components/skill-graph-force-canvas.tsx`
- Modify: `apps/web/src/lib/graph-renderer.test.ts`

**Interfaces:**
- Produces: `SkillGraphRelationshipDensity`, `SkillGraphLabelDensity`, `buildVisibleSkillGraphLinkIds`, and `skillGraphLabelLimit`.
- Extends: `GraphRendererProps` with optional `visibleLinkIds` and `emphasis`.

- [ ] **Step 1: Write failing visibility tests**

```ts
expect(buildVisibleSkillGraphLinkIds(links, 48, "core").size).toBe(58);
expect(buildVisibleSkillGraphLinkIds(links, 48, "balanced").size).toBe(71);
expect(buildVisibleSkillGraphLinkIds(links, 48, "detailed").size).toBe(84);
expect(skillGraphLabelLimit("key", 48)).toBe(14);
expect(skillGraphLabelLimit("more", 48)).toBe(28);
```

Also verify the first `nodeCount - 1` backbone links remain visible when available and a highlighted hidden link is considered renderable.

- [ ] **Step 2: Verify the visibility tests fail**

Run: `npm test -- --run src/lib/skill-graph-visibility.test.ts`

Expected: FAIL because the helper module is missing.

- [ ] **Step 3: Implement deterministic visibility budgets**

```ts
export type SkillGraphRelationshipDensity = "core" | "balanced" | "detailed";
export type SkillGraphLabelDensity = "key" | "more";

const DENSITY_RATIO = { core: 0.68, balanced: 0.84, detailed: 1 } as const;

export function buildVisibleSkillGraphLinkIds(
  links: readonly SkillGraphViewLink[],
  nodeCount: number,
  density: SkillGraphRelationshipDensity,
) {
  const backbone = Math.min(links.length, Math.max(0, nodeCount - 1));
  const limit = Math.min(
    links.length,
    Math.max(backbone, Math.ceil(links.length * DENSITY_RATIO[density])),
  );
  return new Set(links.slice(0, limit).map(({ id }) => id));
}
```

- [ ] **Step 4: Add renderer contracts and Canvas paint rules**

Extend the adapter without changing existing callers:

```ts
export type GraphRendererEmphasis = {
  nodeIds: readonly string[];
  linkIds: readonly string[];
};

export type GraphRendererProps = {
  // existing fields
  visibleLinkIds?: ReadonlySet<string>;
  emphasis?: GraphRendererEmphasis | null;
};
```

In the Canvas renderer, keep visibility and emphasis in refs. At rest, return width `0` and transparent color for a hidden link. If hover, selection, or path emphasis contains that link, paint it normally. Build a path highlight set when no node is hovered; hover temporarily overrides it and pointer exit restores it. Recalculate label candidates from `display.labelLimit` and only request a redraw when visibility/emphasis changes.

- [ ] **Step 5: Run the visibility and renderer tests**

Run: `npm test -- --run src/lib/skill-graph-visibility.test.ts src/lib/graph-renderer.test.ts src/lib/skill-graph-relations.test.ts`

Expected: PASS with no existing renderer-selection regression.

- [ ] **Step 6: Commit paint-only display behavior**

```bash
git add apps/web/src/lib/skill-graph-visibility.ts apps/web/src/lib/skill-graph-visibility.test.ts apps/web/src/lib/graph-renderer.ts apps/web/src/components/skill-graph-force-canvas.tsx apps/web/src/lib/graph-renderer.test.ts
git commit -m "feat(skill-map): add stable graph display density"
```

### Task 3: Actionable Toolbar and Inspector Experience

**Files:**
- Modify: `apps/web/src/components/skill-graph-experience.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.test.tsx`
- Modify: `apps/web/src/components/skill-graph-atlas.module.css`
- Modify: `design.md`

**Interfaces:**
- Consumes: path and visibility helpers from Tasks 1–2.
- Passes: `visibleLinkIds`, `emphasis`, and `display.labelLimit` to `SkillGraphForceCanvas`.

- [ ] **Step 1: Write failing component tests**

Add focused tests for:

```ts
expect(screen.getByText("보기 설정", { selector: "summary" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "핵심" })).toHaveAttribute("aria-pressed", "true");
fireEvent.click(screen.getByRole("button", { name: "자세히" }));
expect(screen.getByRole("button", { name: "자세히" })).toHaveAttribute("aria-pressed", "true");
```

With `C++` owned and `ROS2` selected, assert the inspector shows `내 기술과의 시장 연결`, the `C++ → ROS2` accessible path label, and a `그래프에서 경로 보기` button. Clicking it must not add a `/skills/graph/data` request and must change the button to `경로 강조 끄기`.

- [ ] **Step 2: Verify the component tests fail for missing controls**

Run: `npm test -- --run src/components/skill-graph-experience.test.tsx`

Expected: FAIL on `보기 설정` and market-connection assertions.

- [ ] **Step 3: Add state and memoized derivations**

```ts
const [relationshipDensity, setRelationshipDensity] =
  useState<SkillGraphRelationshipDensity>("core");
const [labelDensity, setLabelDensity] =
  useState<SkillGraphLabelDensity>("key");
const [pathEmphasisEnabled, setPathEmphasisEnabled] = useState(false);

const visibleLinkIds = useMemo(
  () => buildVisibleSkillGraphLinkIds(
    viewData.links,
    viewData.stats.skillCount,
    relationshipDensity,
  ),
  [relationshipDensity, viewData.links, viewData.stats.skillCount],
);
```

Derive `marketPath` from visible owned nodes and `selectedId`. Reset path emphasis when selection or topology changes. Do not call `loadTopology` from any new control.

- [ ] **Step 4: Build the compact `보기 설정` disclosure**

Use two labelled `role="group"` button rows with `aria-pressed`. Copy is fixed:

- Relationship label: `관계선`
- Options: `핵심`, `균형`, `자세히`
- Label label: `기술명`
- Options: `주요만`, `더 많이`
- Helper: `배치는 유지하고 표시 정보만 바뀝니다.`

Show the visible link count in the graph HUD, for example `48개 기술 · 핵심 관계 58개`.

- [ ] **Step 5: Add the market-connection inspector section**

Place it after selected-skill facts and before recommendations. Use these exact messages:

- Path explanation: `공고에서 함께 요구된 강한 관계를 따라 표시합니다. 학습 순서를 뜻하지 않습니다.`
- No owned skills: `내 기술을 추가하면 선택 기술까지 이어지는 시장 관계를 볼 수 있습니다.`
- Selected already owned: `선택한 기술은 이미 내 기술에 포함되어 있습니다.`
- No visible route: `현재 지도에 보이는 내 기술과의 연결을 찾지 못했습니다.`

The path button toggles `aria-pressed`, updates the live announcement, and passes the path node/link IDs to the Canvas emphasis contract.

- [ ] **Step 6: Style without adding containment layers**

Reuse the existing popover surface and inspector separators. Add compact segmented rows, a single-line path sequence that wraps by whole node items on narrow widths, visible focus states, `font-variant-numeric: tabular-nums`, and 44px controls. Do not add gradients, shadows, nested bordered cards, physics sliders, or hover-only content.

- [ ] **Step 7: Update the locked design contract**

Add a short allowance to `design.md` stating that relationship/label density is paint-only and that market paths are explicit, bounded, undirected co-occurrence explanations rather than learning order.

- [ ] **Step 8: Run component and related unit tests**

Run: `npm test -- --run src/lib/skill-graph-path.test.ts src/lib/skill-graph-visibility.test.ts src/lib/skill-graph-view.test.ts src/lib/skill-graph-relations.test.ts src/components/skill-graph-experience.test.tsx src/lib/graph-renderer.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit the product experience**

```bash
git add design.md apps/web/src/components/skill-graph-experience.tsx apps/web/src/components/skill-graph-experience.test.tsx apps/web/src/components/skill-graph-atlas.module.css
git commit -m "feat(skill-map): connect market map to owned skills"
```

### Task 4: Browser Verification, Hallmark Audit, and Deployment

**Files:**
- Modify only if the existing contract needs one focused assertion: `apps/web/e2e/skill-map.e2e.ts`
- Modify audit log only if required by Hallmark: `.hallmark/log.json`

**Interfaces:**
- Verifies the public behavior and deployment; no new runtime interface.

- [ ] **Step 1: Run static verification**

Run:

```bash
npm run lint
npm run build
```

Expected: both exit 0.

- [ ] **Step 2: Run the focused browser contract**

Start the production server and run only the skill-map E2E project/test cases needed to verify desktop and mobile. Check:

- default core relationship setting;
- label setting toggle;
- path toggle after adding/selecting skills;
- no topology request from display/path toggles;
- graph node selection and mobile page scrolling remain functional;
- no horizontal overflow at 320, 375, 414, 768, 1024, and 1440px.

- [ ] **Step 3: Capture and inspect desktop/mobile screenshots**

Review at least 1440×1000 and 390×844. Confirm the graph remains the dominant surface, the toolbar does not wrap labels, the path section is readable, and core mode visibly reduces idle line clutter while selection reveals context.

- [ ] **Step 4: Run Hallmark final checks**

Read `slop-test.md` and `contract.md` at this point, then audit changed UI for prohibited tells, focus contrast, touch targets, Korean copy, responsive overflow, and reduced motion. Fix only findings in this scope.

- [ ] **Step 5: Review the final diff and verify again**

Run the focused Vitest command, `npm run lint`, `npm run build`, and `git diff --check` fresh after all fixes. Inspect `git diff --stat`, `git diff`, and `git status --short`.

- [ ] **Step 6: Publish and deploy**

Push `feat/actionable-obsidian-skill-graph`, open a PR against `main`, wait for required GitHub checks, merge without force-push, then wait for the production Vercel deployment tied to the merge commit.

- [ ] **Step 7: Production smoke test**

Open `https://ejik-fit-web.vercel.app/skills/graph`, verify the deployed commit and the same core controls/path behavior, and report the production URL plus exact verification evidence.
