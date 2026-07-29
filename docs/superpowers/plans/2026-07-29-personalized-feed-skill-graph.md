# Personalized Feed and Local Skill Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a user's saved skills materially change the home job recommendations, and turn the skill map into a fast, legible local graph that explains what to learn and where it connects to the market.

**Architecture:** Rank personalized jobs in the backend so SSR and every infinite-scroll page consume one stable 4:1 recommendation/exploration sequence. Keep community and market-card interleaving in the web layer unchanged. Stop using the full graph as a home-ranking data source. On the skill-map page, request one shared market topology and overlay owned/recommended state locally; expose deterministic one-hop and two-hop views without changing the existing Canvas renderer or force-layout dependency.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL/SQLite test database, Next.js 16 App Router, React 19, TypeScript, Canvas force graph, CSS Modules, Pytest, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve the mixed feed, automatic infinite scroll, community/market insertion cadence, URL filters, and existing generic-postings order for users with no saved skills.
- Use a stable 4 personalized : 1 exploration job-slot sequence. Exhausted streams must backfill from the other stream without duplicates or pagination gaps.
- Rank by confirmed posting-skill evidence: required count, required coverage, preferred count, unspecified count, total count, freshness, then stable posting ID. Do not infer semantic skill similarity in this change.
- Limit `owned_skills` to 20 normalized values and keep personalized responses private/no-store; generic responses retain their current public cache behavior.
- Remove the home page's graph request. A graph failure must never affect home recommendations.
- Preserve dynamic Canvas loading, reduced-motion behavior, hidden-tab pausing, label collision control, and bounded node/edge counts.
- Keep all touch targets at least 44×44 CSS px. Mobile graph gestures remain disabled until the user explicitly enters graph-interaction mode.
- Use the existing modern-minimal visual system and purple accent. Domain color is semantic, not decorative; top-three learning recommendations use one restrained amber marker.
- Add only focused tests for changed behavior, as requested. Do not run the entire browser suite unless a focused failure indicates a wider regression.

---

### Task 1: Build the stable personalized posting sequence in the backend

**Files:**
- Create: `packages/backend/src/ejikfit/posting_recommendations.py`
- Create: `packages/backend/tests/test_posting_recommendations.py`
- Modify: `packages/backend/src/ejikfit/api/postings.py`
- Modify: `packages/backend/tests/test_posting_list_evidence.py`
- Modify: `packages/backend/tests/test_postings_api.py`

**Interfaces:**
- Add a pure `recommendation_window(matched_total, exploration_total, offset, limit)` planner that returns the requested stream pattern and per-stream source offsets.
- Extend `PostingReader.list(..., owned_skills: Sequence[str] = ())` and `GET /api/postings?owned_skills=C%2B%2B` without changing the response schema.
- Reuse `canonicalize_skill_inputs` and reject more than 20 skill query values.

- [ ] **Step 1: Add failing planner contracts**

Cover the exact `matched, matched, matched, matched, explore` cadence, a window starting mid-cycle, matched-stream exhaustion, exploration-stream exhaustion, zero limit, and continuity across adjacent pages. Concatenating windows must equal one larger window.

- [ ] **Step 2: Run the planner test and confirm RED**

Run: `env -u PYTHONPATH .venv/bin/pytest packages/backend/tests/test_posting_recommendations.py -q`

Expected: FAIL because the planner module does not exist.

- [ ] **Step 3: Implement the pure planner**

Use a frozen result dataclass containing `pattern`, `matched_offset`, and `exploration_offset`. Simulate only the prefix through `offset + limit`, consume a stream when it is available, and immediately backfill from the other stream when it is exhausted. Validate non-negative totals/offset/limit.

- [ ] **Step 4: Add failing database/API ranking contracts**

Create fixtures containing required, preferred, unspecified, and unrelated skills. Assert:

```python
response = client.get("/api/postings", params=[("owned_skills", "C++")])
assert [item["title"] for item in response.json()["items"][:5]] == [
    "required-strongest",
    "required-second",
    "preferred-match",
    "unspecified-match",
    "exploration",
]
```

Also assert deterministic pagination with no duplicate IDs, company diversity of at most two consecutive personalized results when alternatives exist, generic ordering unchanged, canonicalized aliases, and `Cache-Control: private, no-store` only for personalized requests.

- [ ] **Step 5: Run the focused backend tests and confirm RED**

Run:

```bash
env -u PYTHONPATH .venv/bin/pytest \
  packages/backend/tests/test_posting_recommendations.py \
  packages/backend/tests/test_posting_list_evidence.py \
  packages/backend/tests/test_postings_api.py -q
```

Expected: planner tests pass; personalized reader/API assertions fail.

- [ ] **Step 6: Implement database-side ranking and stream merging**

Build one match aggregate per posting with required, preferred, unspecified, total matches, and total confirmed required skills. Query the matched stream in the approved lexicographic order, apply a window rank to soften company repetition, and query exploration with `NOT EXISTS` against the owned-skill set. Fetch only the source windows requested by the pure planner, merge by its pattern, and serialize through the existing summary builder so evidence fields stay authoritative.

- [ ] **Step 7: Implement query validation and cache policy**

Accept repeated `owned_skills`, normalize aliases/case, discard blanks and duplicates, cap the normalized list at 20, and pass it to the reader. Preserve current count semantics because personalized ordering does not remove postings. Emit `private, no-store` for personalized output and keep existing public caching for generic output.

- [ ] **Step 8: Run the focused backend tests and confirm GREEN**

Run the command from Step 5. Expected: PASS.

- [ ] **Step 9: Commit the backend slice**

Run: `git add packages/backend && git commit -m "feat: personalize posting recommendations by saved skills"`

### Task 2: Carry personalization through SSR, infinite scroll, and job-card reasons

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/page.test.tsx`
- Modify: `apps/web/src/app/api/home-feed/postings/route.ts`
- Modify: `apps/web/src/app/api/home-feed/postings/route.test.ts`
- Modify: `apps/web/src/features/home-feed/model.ts`
- Modify: `apps/web/src/features/home-feed/model.test.ts`
- Modify: `apps/web/src/features/home-feed/use-home-feed-pagination.ts`
- Modify: `apps/web/src/features/home-feed/use-home-feed-pagination.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`

**Interfaces:**
- Extend `getPostings` with repeated `owned_skills` query parameters.
- Preserve the current home-feed posting response, adding only a local fallback flag if needed by the proxy/controller.
- Build recommendation reasons from posting evidence already returned by the API; do not fetch the graph.

- [ ] **Step 1: Add failing transport and home-model contracts**

Assert SSR passes saved skills to `getPostings`, the proxy validates and forwards repeated skills, pagination appends the same repeated values, and the page no longer calls `getSkillGraph`. Assert server ordering is preserved and reasons render as `C++ 필수 요건 일치`, `C++ 우대 요건 일치`, `C++ 기술 포함`, or `내 기술 3개 일치` from confirmed evidence.

- [ ] **Step 2: Run the focused web tests and confirm RED**

Run:

```bash
npm test -- --run \
  src/app/page.test.tsx \
  src/app/api/home-feed/postings/route.test.ts \
  src/features/home-feed/model.test.ts \
  src/features/home-feed/use-home-feed-pagination.test.tsx \
  src/features/home-feed/home-feed.test.tsx
```

Expected: FAIL because the current home uses graph evidence for client-side ranking and does not forward owned skills during pagination.

- [ ] **Step 3: Remove the home graph dependency**

Delete the home `getSkillGraph` request and graph snapshot input. Request initial postings with the exact saved-skill list, retain the backend order, and derive card evidence directly from required/preferred/unspecified skill arrays. This removes the large graph payload from home without changing briefing or mixed-feed insertion logic.

- [ ] **Step 4: Forward skills through infinite scroll**

Validate at most 20 values of at most 100 characters in the home proxy, append each value with `URLSearchParams.append`, and expose private/no-store headers whenever skills are present. Pass the same immutable skill list to the pagination controller so every page follows the initial sequence.

- [ ] **Step 5: Add graceful personalization fallback**

If a personalized postings request fails, retry the same filters without `owned_skills`, keep the feed usable, and surface one quiet status line: `맞춤 추천을 불러오지 못해 최신 공고를 보여드려요.` Do not retry generic failures or display repeated notices per page.

- [ ] **Step 6: Simplify job-card explanation**

Place one concise reason adjacent to the matching meter. Use the strongest single-skill reason when there is one match, the count reason when there are multiple, and `새로운 분야 탐색` only for the deliberate exploration slot. Do not add another large button or duplicate existing detail/save actions.

- [ ] **Step 7: Run the focused web tests and confirm GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 8: Commit the web personalization slice**

Run: `git add apps/web && git commit -m "feat: keep home recommendations personalized across pages"`

### Task 3: Add deterministic local-graph depth without fragmenting cache

**Files:**
- Modify: `packages/backend/src/ejikfit/skill_graph.py`
- Modify: `packages/backend/src/ejikfit/api/graph.py`
- Modify: `packages/backend/tests/test_skill_graph.py`
- Modify: `packages/backend/tests/test_graph_api.py`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Add `depth: Literal[1, 2] = 1` to graph construction and `GET /api/graph`.
- Keep legacy `owned_skills` accepted by the backend, but stop sending it from the skill-map client; ownership is a local presentation overlay.
- Cache topology by market inputs (`seed`, `depth`, career filters), not the user's owned-skill list.

- [ ] **Step 1: Add failing graph-depth and request contracts**

For depth 1, assert every returned non-seed node directly touches the seed. For depth 2, assert a deterministic bounded mix where approximately 60% of expansion capacity is direct neighbors and 40% is neighbors-of-neighbors, with duplicate nodes/edges removed. Assert the web request includes `depth` but omits `owned_skills`.

- [ ] **Step 2: Run focused graph tests and confirm RED**

Run:

```bash
env -u PYTHONPATH .venv/bin/pytest \
  packages/backend/tests/test_skill_graph.py \
  packages/backend/tests/test_graph_api.py -q
cd apps/web && npm test -- --run src/lib/api.test.ts
```

Expected: FAIL on the new depth and URL contracts.

- [ ] **Step 3: Implement deterministic one-hop/two-hop selection**

Preserve existing relation-strength ordering. Select direct neighbors first, then traverse their strongest edges for second-hop candidates when `depth=2`; allocate 60/40 capacity, backfill unused capacity from either group, keep the seed, and apply the existing hard node/edge limits.

- [ ] **Step 4: Make topology requests shareable**

Forward validated depth in the API. Update the web client/cache key to use seed, depth, and career context only. Keep backend compatibility for callers still sending owned skills, but ensure the new skill-map request uses the public shared topology path and overlays saved IDs after response normalization.

- [ ] **Step 5: Run focused graph tests and confirm GREEN**

Run the commands from Step 2 from their correct working directories. Expected: PASS.

- [ ] **Step 6: Commit the topology slice**

Run: `git add packages/backend apps/web/src/lib && git commit -m "feat: add cached local depth to skill graph"`

### Task 4: Recompose the skill map as an Obsidian-like local exploration surface

**Files:**
- Modify: `apps/web/src/lib/skill-graph-view.ts`
- Modify: `apps/web/src/lib/skill-graph-view.test.ts`
- Modify: `apps/web/src/features/skill-map/skill-graph-canvas-style.ts`
- Modify: `apps/web/src/features/skill-map/skill-graph-canvas-style.test.ts`
- Modify: `apps/web/src/components/skill-graph-force-canvas.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.test.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.module.css`
- Modify: `apps/web/e2e/skill-map.e2e.ts`

**Interfaces:**
- Add graph modes `market`, `local`, and `all`, with depth 1/2 in local mode.
- Node size represents market demand, fill represents domain, a solid purple ring represents a saved skill, and a small amber dot marks only the top three recommended next skills.
- Add explicit mobile graph-interaction mode; page scrolling remains the default.

- [ ] **Step 1: Add failing view-model and paint contracts**

Assert domain colors are deterministic and contrast-safe, owned state does not change fill, only recommendation ranks 1–3 receive the amber marker, line width remains thin at rest, and hover/selection raises opacity without globally thickening the graph. Assert selected details include demand, posting count, top six connected skills, and related-job query data.

- [ ] **Step 2: Add failing experience contracts**

Require accessible mode/depth controls, `그래프 조작 시작` and `그래프 조작 종료` on mobile, a selected-skill panel with `관련 공고 보기` and `내 기술에 추가`, 44px controls, and no dashed recommendation rings. Require graph pan/zoom props to be disabled before interaction mode is entered.

- [ ] **Step 3: Run focused skill-map tests and confirm RED**

Run:

```bash
npm test -- --run \
  src/lib/skill-graph-view.test.ts \
  src/features/skill-map/skill-graph-canvas-style.test.ts \
  src/components/skill-graph-experience.test.tsx
```

Expected: FAIL on the new visual semantics, controls, and selected-skill detail panel.

- [ ] **Step 4: Implement semantic graph styling**

Map existing domain IDs to a restrained accessible palette. Scale radius from normalized market demand with a narrow range so hubs are noticeable but do not swallow nearby nodes. Draw an owned ring, then the top-three amber marker. Keep resting edges one device pixel where possible and emphasize only incident edges during hover/selection.

- [ ] **Step 5: Implement local exploration controls and layout**

Make the graph the wide primary surface, put the selected-skill explanation in a stable side panel, and collapse secondary filters behind one control. Mode and depth changes update the topology request without remounting unrelated page content. Keep all labels in natural Korean and explain the encoding once in a compact legend.

- [ ] **Step 6: Implement mobile interaction boundaries**

Default the Canvas to non-interactive page-scroll behavior below the mobile breakpoint. The explicit 44px interaction toggle enables pan, pinch zoom, and node taps; exit restores document scrolling. Selection and CTA actions remain usable without precision gestures, and the control announces its pressed state.

- [ ] **Step 7: Run focused skill-map tests and confirm GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 8: Commit the skill-map slice**

Run: `git add apps/web && git commit -m "feat: focus skill map on local market connections"`

### Task 5: Verify the full user flow, performance, and Hallmark quality

**Files:**
- Modify: `design.md`
- Modify: `.hallmark/log.json`
- Modify only files above if focused verification reveals a defect.

**Interfaces:**
- Document the personalized/exploration cadence and graph visual grammar as page-level design rules.
- Preserve the existing deployment and pull-request workflow.

- [ ] **Step 1: Update the design contract and Hallmark audit record**

Record that job order follows saved skills, exploration is intentionally quiet, graph size/fill/ring/dot each have exactly one meaning, and mobile graph gestures require explicit opt-in. Run the Hallmark Slop Test against both changed surfaces and fix critical findings before recording the result.

- [ ] **Step 2: Run focused regression suites**

Run:

```bash
env -u PYTHONPATH .venv/bin/pytest \
  packages/backend/tests/test_posting_recommendations.py \
  packages/backend/tests/test_posting_list_evidence.py \
  packages/backend/tests/test_postings_api.py \
  packages/backend/tests/test_skill_graph.py \
  packages/backend/tests/test_graph_api.py -q
cd apps/web && npm test -- --run \
  src/app/page.test.tsx \
  src/app/api/home-feed/postings/route.test.ts \
  src/lib/api.test.ts \
  src/features/home-feed/model.test.ts \
  src/features/home-feed/use-home-feed-pagination.test.tsx \
  src/features/home-feed/home-feed.test.tsx \
  src/lib/skill-graph-view.test.ts \
  src/features/skill-map/skill-graph-canvas-style.test.ts \
  src/components/skill-graph-experience.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Measure the changed request paths**

Use production-shaped local data to compare generic versus `owned_skills=C++` posting latency, verify no graph request occurs on home, verify repeated personalized pages contain no duplicate IDs, and confirm the shared graph response is reused when only owned-skill state changes. Record observed before/after values in `.hallmark/log.json` or the PR description; do not claim an improvement without measurements.

- [ ] **Step 4: Run two focused browser flows**

Run:

```bash
npx playwright test e2e/home-career-insight.e2e.ts e2e/skill-map.e2e.ts
```

At 1440px and 390px, verify: C++ changes visible job recommendations, community/market cards still interleave, the sentinel automatically loads another page, graph labels remain legible, selection shows actionable details, mobile page scrolling works before graph mode, gestures work after opt-in, and there is no horizontal overflow or browser error.

- [ ] **Step 5: Run static and production-build checks**

Run:

```bash
npm run lint
npm run build
git diff --check
```

Expected: PASS.

- [ ] **Step 6: Review, publish, merge, and verify production**

Request a final code review, fix only evidence-backed issues, push `feat/personalized-feed-skill-graph`, open the repository's normal pull request, wait for required checks, merge without modifying the dirty root checkout, and verify the deployed home and skill-map paths with C++ selected.
