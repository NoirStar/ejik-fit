# Obsidian Force Skill Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mostly-static Sigma graph with an Obsidian-like live force graph for ejik's skill-career map.

**Architecture:** Keep the `/skills/graph` product shell, fit panel, owned skill storage, and accessible fallback. Move graph data shaping into a pure helper that can be tested independently, then render the live graph in a client-only canvas leaf using `force-graph` and `d3-force`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, `force-graph`, `d3-force`, native CSS variables.

## Global Constraints

- Domain work remains on hold.
- Personal project: no PR required, commit and push directly to `main` after verification.
- Do not touch untracked `.agents/`.
- The graph must follow Obsidian Graph View's model: Filters, Groups, Display, Forces, local graph depth, animate/reheat, zoom/pan, node drag, hover focus, and click selection.
- Reduced-motion users must not be forced into infinite motion.
- The feature must remain useful without canvas support by preserving an accessible fallback.

---

### Task 1: Test the Obsidian graph data model

**Files:**
- Create: `apps/web/src/lib/skill-graph-view.ts`
- Create: `apps/web/src/lib/skill-graph-view.test.ts`

**Interfaces:**
- Produces: `buildSkillGraphView(graph, options): SkillGraphViewData`
- Produces: `SkillGraphViewOptions`, `SkillGraphViewData`, `SkillGraphViewNode`, `SkillGraphViewLink`
- Consumes: `SkillGraphResponse` from `apps/web/src/lib/types.ts`

- [x] **Step 1: Write the failing tests**

The tests assert that the model can add job evidence nodes, hide evidence nodes, apply local depth from a selected skill, and filter by domain.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/skill-graph-view.test.ts`

Expected: FAIL because `./skill-graph-view` does not exist.

- [x] **Step 3: Write minimal implementation**

Create the helper with deterministic node/link shaping and breadth-first local-depth filtering.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/skill-graph-view.test.ts`

Expected: PASS.

### Task 2: Replace Sigma with a live force canvas

**Files:**
- Create: `apps/web/src/components/skill-graph-force-canvas.tsx`
- Delete: `apps/web/src/components/skill-graph-sigma-canvas.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`

**Interfaces:**
- Consumes: `SkillGraphViewData` from `apps/web/src/lib/skill-graph-view.ts`
- Produces: `SkillGraphForceCanvas({ data, display, forces, selectedId, onNodeSelect, onReadyChange })`

- [x] **Step 1: Install live-force dependencies**

Run: `npm install force-graph d3-force @types/d3-force`

- [x] **Step 2: Remove Sigma dependencies**

Run: `npm uninstall @react-sigma/core @react-sigma/layout-forceatlas2 graphology graphology-layout-forceatlas2 sigma`

- [x] **Step 3: Implement the canvas leaf**

The component must lazy-import `force-graph`, mount into a `div`, call `.graphData(data)`, configure d3 forces, reheat on data/control changes, support node drag, hover focus, click selection, camera focus, zoom/pan, and cleanup with `_destructor`.

- [x] **Step 4: Preserve fallback readiness**

If the canvas cannot mount in SSR/JSDOM/no-canvas contexts, call `onReadyChange(false)` so the existing fallback graph remains visible.

### Task 3: Add Obsidian-style graph controls

**Files:**
- Modify: `apps/web/src/components/skill-graph-experience.tsx`
- Modify: `apps/web/src/app/skills/graph/page.test.tsx`

**Interfaces:**
- Consumes: `buildSkillGraphView`
- Produces UI states: graph mode, depth, text filter, evidence visibility, isolated-node visibility, group toggles, label threshold, node size, link thickness, arrows, animation toggle, center force, repel force, link force, link distance.

- [x] **Step 1: Write a failing render test**

Assert that the page renders the Graph View control labels: `Filters`, `Groups`, `Display`, `Forces`, and `Local depth`.

- [x] **Step 2: Run the test and verify it fails**

Run: `npm test -- --run src/app/skills/graph/page.test.tsx`

Expected: FAIL because the controls are not rendered yet.

- [x] **Step 3: Wire controls to the view model and canvas**

Add a left floating panel over the graph canvas. Use real form controls, labels, and buttons. Avoid decorative-only controls.

- [x] **Step 4: Run the test and verify it passes**

Run: `npm test -- --run src/app/skills/graph/page.test.tsx`

Expected: PASS.

### Task 4: CSS polish and responsive behavior

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes class names from `SkillGraphExperience` and `SkillGraphForceCanvas`

- [x] **Step 1: Replace Sigma CSS with force-canvas CSS**

Use a single dark graph plane, an Obsidian-like floating control panel, readable ranges, compact status chips, and mobile-safe stacked controls.

- [x] **Step 2: Add reduced-motion CSS**

Disable decorative pulse animations and avoid forced motion when `prefers-reduced-motion: reduce`.

### Task 5: Verify, commit, and push

**Files:**
- All changed files

**Interfaces:**
- Produces a pushed `main` commit.

- [x] **Step 1: Static verification**

Run:
- `npm run lint`
- `npm test -- --run`
- `npm run build`
- `git diff --check`

- [x] **Step 2: Browser verification**

Start the Next app, open `/skills/graph`, check for console/runtime errors, horizontal overflow, hidden controls, and actual animated force behavior.

- [ ] **Step 3: Commit**

Run: `git add ... && git commit -m "feat: add obsidian force skill graph"`

- [ ] **Step 4: Push**

Run: `git push origin main`
