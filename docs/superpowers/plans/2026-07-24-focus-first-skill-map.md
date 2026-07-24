# Focus-First Skill Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 321-node/3,286-link default skill graph with a deterministic sparse overview, a focused next-skill view, and lazily loaded job evidence.

**Architecture:** The backend keeps the full graph as factual source data but omits evidence from the initial response and exposes one bounded evidence endpoint. `skill-graph-view.ts` becomes the deterministic level-of-detail boundary, selecting overview/focus/all nodes and a maximum-spanning-tree backbone before the Canvas renderer receives data. The React experience owns viewport limits and evidence request state; the renderer only paints the already-bounded graph.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, React 19, Next.js 16, TypeScript, force-graph Canvas 2D, Vitest, Playwright

## Global Constraints

- Desktop default render: at most 12 skill nodes and 18 links.
- Mobile default render: at most 8 skill nodes and 10 links.
- Focus render: selected skill plus at most 8 direct neighbors and 12 links.
- Full render: at most 30 skill nodes and 45 sparse-backbone links.
- No posting/evidence node is rendered in the graph.
- Node size encodes current posting demand in a compressed range.
- Link opacity encodes relationship score; resting width is 0.6–1px and focused width is at most 1.6px.
- Pretendard is the Canvas label font; renderer colors come only from `design-tokens.ts`.
- Evidence is fetched only after a skill is selected and is capped at 6 items.
- Existing `SkillGraphResponse.evidence` remains for backward compatibility.
- No new frontend dependency and no WebGL renderer migration.

---

### Task 1: Make graph evidence opt-in and expose bounded selected-skill evidence

**Files:**
- Modify: `packages/backend/src/ejikfit/skill_graph.py`
- Modify: `packages/backend/src/ejikfit/api/graph.py`
- Modify: `packages/backend/src/ejikfit/api/schemas.py`
- Modify: `packages/backend/tests/test_skill_graph.py`
- Modify: `packages/backend/tests/test_graph_api.py`

**Interfaces:**
- Consumes: `JobPosting`, `PostingSkill`, `CONFIRMED_CONFIDENCE`, canonical skill input.
- Produces: `GET /api/graph/skills?limit=30&include_evidence=false` and `GET /api/graph/skills/evidence?skill=<name>&limit=6`.
- Produces: `SkillGraphEvidenceResponse { items: SkillGraphEvidence[]; total: int }`.

- [ ] **Step 1: Write failing domain and API tests**

Add a domain test proving `build_skill_graph(session, seed="Python", owned_skills=(), career_type=None, limit=30, include_evidence=False)` preserves nodes/edges but emits no evidence. Extend the fake reader with call recording and add API assertions:

```python
response = client.get("/api/graph/skills?limit=10")
assert response.status_code == 200
assert response.json()["evidence"] == []
assert reader.include_evidence is False

response = client.get(
    "/api/graph/skills/evidence?skill=python&career_type=experienced&limit=6"
)
assert response.status_code == 200
assert response.json() == {
    "items": [
        {
            "posting_id": "job-1",
            "title": "Python Backend Engineer",
            "company_name": "검증 기업",
            "skills": ["Python"],
            "required": ["Python"],
            "preferred": [],
            "unspecified": [],
        }
    ],
    "total": 1,
}
assert reader.evidence_call == ("Python", "experienced", 6)
```

- [ ] **Step 2: Run the focused backend tests and verify failure**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_skill_graph.py tests/test_graph_api.py -q
```

Expected: FAIL because `include_evidence`, the evidence reader method, route, and schema do not exist.

- [ ] **Step 3: Add the opt-in domain argument and bounded evidence query**

Change the graph builder signature and guard evidence materialization:

```python
def build_skill_graph(
    session: Session,
    *,
    seed: str | None = None,
    owned_skills: Sequence[str] = (),
    career_type: str | None = None,
    limit: int = 30,
    include_evidence: bool = True,
) -> SkillGraph:
    bounded_limit = max(5, min(limit, 60))
    evidence = (
        tuple(
            evidence_by_posting[posting_id]
            for posting_id in sorted(visible_posting_ids)
            if posting_id in evidence_by_posting
        )
        if include_evidence
        else ()
    )
```

Add `DatabaseSkillGraphReader.evidence(skill, career_type, limit)` using a `PostingSkill` join. Count distinct matching open postings, order required evidence first and then `JobPosting.last_verified_at.desc(), JobPosting.id`, load company and all confirmed posting skills, and return the existing evidence shape. Canonicalize `skill` before querying and clamp `limit` to `1..20`.

Add the schema:

```python
class SkillGraphEvidenceResponse(BaseModel):
    items: list[SkillGraphEvidence]
    total: int
```

Add `include_evidence: bool = Query(default=False)` to `/skills`, pass it to the reader, and register `/skills/evidence` before `/skills`. Set cache headers to:

```python
"public, s-maxage=300, stale-while-revalidate=900"
```

Use `"private, no-store"` for graph requests with non-empty `owned_skills`.

- [ ] **Step 4: Run backend tests**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_skill_graph.py tests/test_graph_api.py -q
```

Expected: PASS; the default graph response has empty evidence and the evidence route returns at most six selected-skill items.

- [ ] **Step 5: Commit the API boundary**

```bash
git add packages/backend/src/ejikfit/skill_graph.py packages/backend/src/ejikfit/api/graph.py packages/backend/src/ejikfit/api/schemas.py packages/backend/tests/test_skill_graph.py packages/backend/tests/test_graph_api.py
git commit -m "feat: load skill graph evidence on demand"
```

### Task 2: Select a deterministic sparse graph in pure TypeScript

**Files:**
- Modify: `apps/web/src/lib/skill-graph-view.ts`
- Modify: `apps/web/src/lib/skill-graph-view.test.ts`
- Modify: `apps/web/src/lib/large-graph-fixture.ts`
- Modify: `apps/web/src/lib/large-graph.bench.ts`

**Interfaces:**
- Consumes: the full `SkillGraphResponse` and domain/query filters.
- Produces: `SkillGraphViewMode = "overview" | "focus" | "all"`.
- Produces: bounded `SkillGraphViewData` with only skill nodes/links.

- [ ] **Step 1: Write failing sparse-selection tests**

Create a dense 30-node fixture and assert:

```ts
const overview = buildSkillGraphView(denseGraph, { mode: "overview" });
expect(overview.nodes.length).toBeLessThanOrEqual(12);
expect(overview.links.length).toBeLessThanOrEqual(18);
expect(overview.nodes.every((node) => node.kind === "skill")).toBe(true);

const mobile = buildSkillGraphView(denseGraph, {
  mode: "overview",
  nodeLimit: 8,
  linkLimit: 10,
});
expect(mobile.nodes).toHaveLength(8);
expect(mobile.links.length).toBeLessThanOrEqual(10);

const focus = buildSkillGraphView(denseGraph, {
  mode: "focus",
  selectedId: "Python",
});
expect(focus.nodes[0].id).toBe("Python");
expect(focus.nodes.length).toBeLessThanOrEqual(9);
expect(focus.links.length).toBeLessThanOrEqual(12);

const all = buildSkillGraphView(denseGraph, { mode: "all" });
expect(all.nodes.length).toBeLessThanOrEqual(30);
expect(all.links.length).toBeLessThanOrEqual(45);
```

Add a shuffled-input test proving node/link IDs are identical after input order changes, and a disconnected fixture proving the maximum-spanning forest retains every selected component that has an edge.

- [ ] **Step 2: Run the view tests and verify failure**

Run:

```bash
cd apps/web
npm test -- --run src/lib/skill-graph-view.test.ts
```

Expected: FAIL because the current global/local view emits every eligible edge and evidence node.

- [ ] **Step 3: Implement ranking and maximum-spanning-forest helpers**

Use stable edge ordering:

```ts
function compareEdges(left: SkillGraphEdge, right: SkillGraphEdge) {
  return (
    right.score - left.score ||
    right.cooccurrence_count - left.cooccurrence_count ||
    left.id.localeCompare(right.id, "en")
  );
}
```

Implement a local union-find map and `sparseBackbone(edges, visibleIds, limit)`. First add sorted edges that join different components, then add the highest-ranked unused edges until `limit`. Never emit an edge whose endpoint is absent.

Implement node selection:

```ts
const DEFAULT_LIMITS = {
  overview: { nodes: 12, links: 18 },
  focus: { nodes: 9, links: 12 },
  all: { nodes: 30, links: 45 },
} as const;
```

- `overview`: demand descending, required count descending, ID ascending.
- `focus`: selected node followed by incident neighbors ordered by edge comparator, neighbor demand, ID; cap at 8 neighbors.
- `all`: demand order up to 30.
- query: matched nodes first, then their strongest direct neighbors, still respecting the active node/link caps.

Remove evidence-node creation. Keep `cooccurrenceCount` for inspector/tooltip truth, but compute display width with:

```ts
function linkValue(score: number) {
  return clamp(0.6 + clamp(score, 0, 1) * 0.4, 0.6, 1);
}
```

Compress node radius to `4.5..9` with `Math.log1p(demand_count)` and use the named neutral skill-node token.

- [ ] **Step 4: Run tests and benchmark**

Run:

```bash
cd apps/web
npm test -- --run src/lib/skill-graph-view.test.ts src/lib/large-graph-fixture.test.ts
npm run bench:graph
```

Expected: tests PASS; the benchmark output reports bounded output for dense input and no non-finite values.

- [ ] **Step 5: Commit the sparse view model**

```bash
git add apps/web/src/lib/skill-graph-view.ts apps/web/src/lib/skill-graph-view.test.ts apps/web/src/lib/large-graph-fixture.ts apps/web/src/lib/large-graph.bench.ts
git commit -m "feat: bound skill graph detail by view mode"
```

### Task 3: Add the web evidence contract and safe proxy route

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/app/skills/graph/evidence/route.ts`
- Create: `apps/web/src/app/skills/graph/evidence/route.test.ts`
- Modify: `apps/web/src/app/skills/graph/page.tsx`
- Modify: `apps/web/src/app/skills/graph/page.test.tsx`

**Interfaces:**
- Produces: `getSkillGraphEvidence({ skill, career_type?, limit?, signal? })`.
- Produces: same-origin `GET /skills/graph/evidence?skill=<name>&limit=6`.

- [ ] **Step 1: Write failing API-helper and route tests**

Test that the page calls `getSkillGraph({ seed: undefined, owned_skills: [], career_type: undefined, limit: 30, include_evidence: false })`. For the route, assert missing skill returns 400, limit is clamped to `1..20`, `ApiError` status is preserved, and request abort signals are forwarded.

```ts
expect(getSkillGraphEvidence).toHaveBeenCalledWith(
  { skill: "C++", career_type: "experienced", limit: 6 },
  expect.any(AbortSignal),
);
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd apps/web
npm test -- --run src/app/skills/graph/page.test.tsx src/app/skills/graph/evidence/route.test.ts
```

Expected: FAIL because the evidence route/types/helper do not exist and the page does not opt out explicitly.

- [ ] **Step 3: Implement types, helper, and proxy**

Add:

```ts
export type SkillGraphEvidenceResponse = {
  items: SkillGraphEvidence[];
  total: number;
};
```

Extend `getSkillGraph` filters with `include_evidence?: boolean`, always serialize the boolean when supplied, and add an abortable public helper. The route validates a trimmed non-empty skill of at most 100 characters and returns Korean 400 copy for invalid input. It catches `ApiError` exactly like the existing fit route.

- [ ] **Step 4: Run route/page tests and lint**

Run:

```bash
cd apps/web
npm test -- --run src/app/skills/graph/page.test.tsx src/app/skills/graph/evidence/route.test.ts
npm run lint
```

Expected: PASS and TypeScript exit code 0.

- [ ] **Step 5: Commit the web data contract**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/app/skills/graph/evidence apps/web/src/app/skills/graph/page.tsx apps/web/src/app/skills/graph/page.test.tsx
git commit -m "feat: proxy selected skill evidence"
```

### Task 4: Convert the experience to overview/focus/all and lazy evidence

**Files:**
- Modify: `apps/web/src/components/skill-graph-experience.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.test.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.module.css`

**Interfaces:**
- Consumes: the bounded view builder and same-origin evidence route.
- Produces: no-selection overview, focused selection, all-skills mode, evidence states, responsive limits.

- [ ] **Step 1: Replace old assertions with failing behavior tests**

Add tests for:

```ts
expect(screen.queryByLabelText("주변 깊이")).not.toBeInTheDocument();
expect(screen.queryByRole("checkbox", { name: "관련 공고" })).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "시장 핵심" })).toHaveAttribute("aria-pressed", "true");
expect(screen.getByText("기술을 선택하면 관련 공고를 확인할 수 있습니다.")).toBeInTheDocument();
```

Select a skill, resolve a six-item evidence response, and assert official job links render. Add an aborted-request race test where Python is selected after Go and the late Go response never replaces Python evidence. Add loading, empty, failure, and retry tests.

- [ ] **Step 2: Run the component test and verify failure**

Run:

```bash
cd apps/web
npm test -- --run src/components/skill-graph-experience.test.tsx
```

Expected: FAIL because the current component auto-selects the first node, exposes depth/evidence controls, and reads eager evidence.

- [ ] **Step 3: Implement mode and viewport state**

Use these initial rules:

```ts
const initialSelection = initialGraph.seed ?? null;
const initialMode: SkillGraphViewMode = initialSelection ? "focus" : "overview";
```

Track `(max-width: 640px)` with `matchMedia`, pass `{ nodeLimit: 8, linkLimit: 10 }` on compact screens, and reset to `{ selectedId: null, mode: "overview" }` when no seed exists. Replace the old segmented control with `시장 핵심`, `선택 주변`, `전체 기술`. Disable `선택 주변` until a skill exists. Remove depth, evidence, isolated-node, and reheat controls.

Pass `recommendedIds` from `fit.recommended_next_skills` so the view can mark next-skill candidates without changing their base radius.

- [ ] **Step 4: Implement abortable cached evidence state**

Use state `{ status: "idle" | "loading" | "ready" | "empty" | "error"; items: SkillGraphEvidence[]; total: number }`, an in-memory `Map<string, SkillGraphEvidenceResponse>`, and an effect keyed by selected ID. Abort on cleanup, clear stale items before loading, ignore `AbortError`, and provide a numeric retry key.

Render exact states:

```text
idle: 기술을 선택하면 관련 공고를 확인할 수 있습니다.
loading: 관련 공고를 불러오는 중입니다.
empty: 현재 공개된 근거 공고가 없습니다.
error: 근거 공고를 불러오지 못했습니다.
```

The error state includes a `다시 시도` button. The success header shows `전체 N건 중 최대 6건` when total exceeds six.

- [ ] **Step 5: Update legend, copy, and CSS hierarchy**

Use:

```tsx
<p aria-label="스킬맵 범례" className={styles.graphLegend} role="note">
  <span><b>크기</b>: 시장 수요</span>
  <i aria-hidden="true" />
  <span><b>테두리</b>: 내 기술</span>
  <i aria-hidden="true" />
  <span><b>선 농도</b>: 함께 요구</span>
</p>
```

Change graph metrics to `표시 기술`, `표시 관계`, `전체 근거`. Keep the exact relationship counts in the inspector and the graph sparse. Ensure mobile controls are 44px and the evidence list is outside the canvas.

- [ ] **Step 6: Run component and layout tests**

Run:

```bash
cd apps/web
npm test -- --run src/components/skill-graph-experience.test.tsx src/styles/skill-graph-layout.test.ts
npm run lint
```

Expected: PASS with no stale evidence race and no old depth/evidence controls.

- [ ] **Step 7: Commit the focus-first experience**

```bash
git add apps/web/src/components/skill-graph-experience.tsx apps/web/src/components/skill-graph-experience.test.tsx apps/web/src/components/skill-graph-experience.module.css
git commit -m "feat: make skill map focus first"
```

### Task 5: Restrain Canvas rendering and preserve mobile controls

**Files:**
- Modify: `apps/web/src/styles/design-tokens.ts`
- Modify: `apps/web/src/components/skill-graph-force-canvas.tsx`
- Modify: `apps/web/src/lib/skill-graph-animation.ts`
- Modify: `apps/web/src/lib/skill-graph-animation.test.ts`
- Modify: `apps/web/e2e/skill-map.e2e.ts`
- Modify: `apps/web/e2e/performance-budget.e2e.ts`

**Interfaces:**
- Consumes: bounded view nodes with `owned`, `recommended`, `selected` state.
- Produces: neutral nodes, restrained links, Pretendard labels, finite layout, touch-safe interaction.

- [ ] **Step 1: Add failing renderer-contract and E2E assertions**

Add source-level token tests or exported pure-style tests asserting every skill link width is within `0.6..1.6`, all renderer colors equal named `GRAPH_CANVAS_COLORS` values, and label font contains `Pretendard`. Update E2E fixture contract to expect default API evidence `[]` and call the new evidence endpoint separately.

In the viewport loop assert the visible metrics never exceed the designed caps and no `관련 공고` checkbox exists. Keep existing pan, pinch, tap, reduced-motion, stability, and no-horizontal-overflow assertions.

- [ ] **Step 2: Run focused renderer/E2E tests and verify failure**

Run:

```bash
cd apps/web
npm test -- --run src/lib/skill-graph-animation.test.ts src/components/skill-graph-experience.test.tsx
npx playwright test e2e/skill-map.e2e.ts --project=chromium
```

Expected: unit tests or E2E assertions FAIL on thick/hardcoded links, eager evidence, and old controls.

- [ ] **Step 3: Add named Canvas tokens and update painting**

Define named tokens for neutral, selected, owned, recommended, resting link, focused link, label, and label outline. Replace raw `rgba(86, 56, 198, 0.35)` construction with token-backed opacity helpers. Use:

```ts
ctx.font = `${weight} ${fontSize}px "Pretendard Variable", Pretendard, sans-serif`;
```

Paint one thin owned ring and one recommendation ring; selected state uses the selected token and no persistent glow. Limit resting link width to `0.6 + score * 0.4` and focused width to `Math.min(1.6, resting + 0.6)`.

- [ ] **Step 4: Shorten and stop the finite simulation**

For the now-small graph use:

```ts
{ warmupTicks: 12, cooldownTicks: 36, cooldownTime: 1200 }
```

Keep reduced motion at zero cooldown. Hover, selection, zoom, and tooltip redraws must not reheat. Preserve the existing `ResizeObserver` and visibility pause, and coalesce resize callbacks into one `requestAnimationFrame`.

- [ ] **Step 5: Run renderer, E2E, and CPU-budget tests**

Run:

```bash
cd apps/web
npm test -- --run src/lib/skill-graph-animation.test.ts src/lib/skill-graph-relations.test.ts src/lib/skill-graph-view.test.ts src/components/skill-graph-experience.test.tsx
npx playwright test e2e/skill-map.e2e.ts --project=chromium
npx playwright test --config=playwright.performance.config.ts e2e/performance-budget.e2e.ts --project=chromium
```

Expected: PASS; the post-layout 6x-throttled CPU assertion remains within budget and mobile pan/pinch/tap still works.

- [ ] **Step 6: Commit the renderer restraint**

```bash
git add apps/web/src/styles/design-tokens.ts apps/web/src/components/skill-graph-force-canvas.tsx apps/web/src/lib/skill-graph-animation.ts apps/web/src/lib/skill-graph-animation.test.ts apps/web/e2e/skill-map.e2e.ts apps/web/e2e/performance-budget.e2e.ts
git commit -m "perf: render a restrained finite skill graph"
```

### Task 6: Verify the complete skill-map slice

**Files:**
- Modify only files required by failures found in this task.

**Interfaces:**
- Produces: a deployable skill-map slice with measured bounded output.

- [ ] **Step 1: Run backend graph tests**

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_skill_graph.py tests/test_graph_api.py -q
```

Expected: PASS.

- [ ] **Step 2: Run all web unit tests, typecheck, and production build**

```bash
cd apps/web
npm test -- --run
npm run lint
npm run build
```

Expected: PASS with no TypeScript or Next.js build errors.

- [ ] **Step 3: Run skill-map and performance E2E**

```bash
cd apps/web
npx playwright test e2e/skill-map.e2e.ts --project=chromium
npx playwright test --config=playwright.performance.config.ts e2e/performance-budget.e2e.ts --project=chromium
```

Expected: PASS at 1440, 820, 390, and 320 widths.

- [ ] **Step 4: Measure output against the production-shaped fixture**

Log the view builder result for 30 nodes/344 edges and assert:

```text
desktop overview <= 12 nodes / 18 links
mobile overview <= 8 nodes / 10 links
focus <= 9 nodes / 12 links
all <= 30 nodes / 45 links
evidence nodes = 0
```

- [ ] **Step 5: Commit verification-only corrections**

```bash
git status --short
git commit -m "test: verify focus-first skill map"
```

Stage only the exact skill-map source or test paths printed by
`git status --short`, then run the commit command. Skip the commit when the
status output is empty.
