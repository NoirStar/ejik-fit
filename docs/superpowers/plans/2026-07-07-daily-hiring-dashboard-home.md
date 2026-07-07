# Daily Hiring Dashboard Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the graph-first home page with a daily hiring dashboard focused on recent fit jobs, while keeping the Obsidian-style graph in `/skills/graph`.

**Architecture:** The home route fetches postings, skill stats, and skill graph evidence on the server, then passes a compact dashboard model to a client component for row selection and inspector state. The graph experience remains a separate page and component. Legacy landing code and unused visual code are removed.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, Phosphor Icons, CSS in `globals.css`.

## Global Constraints

- Home priority is recent matched jobs, not graph exploration.
- Default home ranking is recent jobs with high Fit first.
- Missing skills are hidden from the home row and shown only in the right inspector after selecting a job.
- Graph and calendar are separate tabs, not dominant home content.
- Use semantic buttons, links, labels, and accessible selection state.
- Keep components focused and avoid files over 200 lines where practical.
- Delete unused landing motion code and remove obsolete styles that are no longer referenced.

---

### Task 1: Dashboard model builder

**Files:**
- Create: `apps/web/src/components/dashboard/types.ts`
- Create: `apps/web/src/components/dashboard/dashboard-model.ts`
- Test: `apps/web/src/components/dashboard/dashboard-model.test.ts`

**Interfaces:**
- Consumes: `PostingListResponse`, `SkillGraphResponse`, `SkillStatsResponse`
- Produces: `buildDailyDashboardModel(input): DailyDashboardModel`

- [x] **Step 1: Write tests**

Create tests covering:

```ts
expect(model.jobs[0].matchedSkills).toEqual(["Java", "Spring"]);
expect(model.jobs[0].missingSkills).toContain("Kafka");
expect(model.jobs[0].isSupplemental).toBe(false);
expect(emptyMatchedModel.mode).toBe("supplemented");
```

- [x] **Step 2: Implement types and builder**

Create `DailyDashboardModel`, `DashboardJob`, `DashboardSummary`, and `MarketSignal` types. Implement ranking from graph evidence first, then supplement from posting summaries.

- [x] **Step 3: Verify**

Run: `npm test -- --run src/components/dashboard/dashboard-model.test.ts`
Expected: tests pass.

### Task 2: Daily dashboard UI components

**Files:**
- Create: `apps/web/src/components/dashboard/daily-dashboard-home.tsx`

**Interfaces:**
- Consumes: `DailyDashboardModel`
- Produces: `DailyDashboardHome`

- [x] **Step 1: Implement client component**

Build a dashboard shell with:

```txt
left nav
topbar
summary strip
recent fit job rows
right inspector
mini market signals
```

- [x] **Step 2: Accessibility**

Use real buttons for selectable rows, `aria-pressed`, `aria-label`, visible headings, and empty states.

- [x] **Step 3: Keep row minimal**

Rows show company, title, fit, date/status, and 2-3 matched skills only. Missing skills appear only in inspector.

### Task 3: Home route integration

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/page.test.tsx`

**Interfaces:**
- Consumes: `getPostings`, `getSkillStats`, `getSkillGraph`
- Produces: `/` rendering `DailyDashboardHome`

- [x] **Step 1: Update tests**

Mock all three API calls and assert:

```ts
screen.getByRole("heading", { name: "최근 맞춤 공고" });
expect(screen.queryByText("Kafka")).not.toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /토스 Backend Engineer/ }));
expect(screen.getByText("Kafka")).toBeInTheDocument();
```

- [x] **Step 2: Implement route**

Fetch data with `Promise.allSettled`, build the dashboard model, and render a warning when any source fails so partial data is not silently presented as complete.

### Task 4: CSS and responsive layout

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `.daily-dashboard-*` classes
- Produces: responsive layout at desktop, tablet, and mobile widths.

- [x] **Step 1: Add dashboard CSS**

Use app-level tokens, stable spacing, subtle surfaces, and no landing hero patterns.

- [x] **Step 2: Mobile behavior**

At narrow widths, collapse to single column and move inspector under the list.

### Task 5: Cleanup

**Files:**
- Delete: `apps/web/src/components/landing-motion.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: current class usage from TSX files
- Produces: no unused landing component, no referenced class deletion.

- [x] **Step 1: Delete unused landing motion**

Confirm no imports remain with `rg "LandingMotion|landing-motion" apps/web/src`.

- [x] **Step 2: Remove obsolete CSS selectors**

Remove unused landing and old market dashboard selectors when not referenced by TSX.

### Task 6: Verification and commit

**Files:**
- All modified files

- [x] **Step 1: Typecheck**

Run: `npm run lint`
Expected: exit code 0.

- [x] **Step 2: Tests**

Run: `npm test -- --run`
Expected: all tests pass.

- [x] **Step 3: Build**

Run: `npm run build`
Expected: exit code 0.

- [x] **Step 4: Runtime smoke**

Run production server and confirm `/` renders `최근 맞춤 공고` and `/skills/graph` renders graph shell.

- [ ] **Step 5: Commit and push**

Commit implementation and push `main`.
