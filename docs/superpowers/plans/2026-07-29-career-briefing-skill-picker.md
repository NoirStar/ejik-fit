# Career Briefing and Skill Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the home career briefing lead to one concrete learning action and replace the long browser-native skill list with one fast, accessible picker shared by `/career` and the header sheet.

**Architecture:** Keep the existing home snapshot, career analysis requests, owned-skill storage, URL synchronization, and infinite-scroll pipeline unchanged. Reshape only `CareerBriefing` presentation, and centralize catalog filtering, alias resolution, keyboard navigation, and result rendering in a client-side `SkillPicker` component used by both skill-entry surfaces.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve feed ordering, automatic infinite scroll, pagination cursors, storage keys, account sync, and API payloads.
- Preserve the locked `design.md` modern-minimal system, Pretendard, purple accent, and existing tokens.
- Never open the full 155-item catalog on an empty query; render at most six catalog matches plus one direct-entry row.
- Keep form controls and touch actions at least 44×44 CSS px and maintain visible keyboard focus.
- Do not add a catalog request, server endpoint, dependency, or database migration.
- Run only the changed unit tests and one focused browser spec unless a failure requires a wider check.

---

### Task 1: Lock the shared skill picker behavior with failing tests

**Files:**
- Create: `apps/web/src/features/owned-skills/skill-picker.test.tsx`

**Interfaces:**
- Consumes: `SkillCatalogItem[]`, selected skill names, controlled input text, catalog status.
- Produces test contracts for `SkillPicker`, `filterSkillSuggestions`, and `resolveSkillInput`.

- [ ] **Step 1: Add ranking and normalization contracts**

Cover exact name, exact alias (`k8s` → `Kubernetes`), prefix before contains, exclusion of selected skills, six-result limit, and direct input resolution.

- [ ] **Step 2: Add interaction contracts**

Render a controlled harness and assert:

```ts
expect(screen.queryByRole("listbox", { name: "기술 검색 결과" }))
  .not.toBeInTheDocument();
fireEvent.change(screen.getByRole("combobox", { name: "추가할 기술" }), {
  target: { value: "rea" },
});
expect(screen.getAllByRole("option")).toHaveLength(/* <= 7 */);
```

Then cover ArrowDown/ArrowUp/Enter/Escape, mouse selection, `“입력값” 직접 추가`, input clearing through the controlled parent, and focus retention.

- [ ] **Step 3: Run the new test and confirm RED**

Run: `npm test -- --run src/features/owned-skills/skill-picker.test.tsx`

Expected: FAIL because the shared component does not exist.

### Task 2: Implement the shared search-first skill picker

**Files:**
- Create: `apps/web/src/features/owned-skills/skill-picker.tsx`
- Create: `apps/web/src/features/owned-skills/skill-picker.module.css`

**Interfaces:**
- Produces:
  - `type CatalogStatus = "idle" | "loading" | "ready" | "error"`
  - `filterSkillSuggestions(catalog, query, excludedSkills, limit?)`
  - `resolveSkillInput(value, catalog)`
  - `SkillPicker(props)`

- [ ] **Step 1: Implement pure ranking and alias helpers**

Normalize with `skillNameKey`, rank exact/prefix/token-prefix/contains across the canonical name and the approved alias table, sort deterministically, and slice to six.

- [ ] **Step 2: Implement the controlled accessible combobox**

Use a visible label, `role="combobox"`, an absolutely positioned listbox, unique IDs from `useId`, active descendant management, and mouse-down selection that prevents blur. Keep the result DOM bounded and render a direct-add row only when no canonical or alias exact match exists.

- [ ] **Step 3: Implement input and result states**

Match input and compact `추가` button heights, reserve one-line helper/error space, cap list height to the viewport, add explicit hover/focus/active styles, and honor reduced motion without animating focus.

- [ ] **Step 4: Run the new unit test and confirm GREEN**

Run: `npm test -- --run src/features/owned-skills/skill-picker.test.tsx`

Expected: PASS.

### Task 3: Replace both legacy skill-entry implementations

**Files:**
- Modify: `apps/web/src/features/career/career-overview.tsx`
- Modify: `apps/web/src/features/career/career-overview.module.css`
- Modify: `apps/web/src/features/career/career-overview.test.tsx`
- Modify: `apps/web/src/features/owned-skills/owned-skills-sheet.tsx`
- Modify: `apps/web/src/features/owned-skills/owned-skills-sheet.module.css`
- Modify: `apps/web/src/features/owned-skills/owned-skills-sheet.test.tsx`

**Interfaces:**
- Consumes: `SkillPicker`, unchanged `/api/skills/catalog` response, unchanged owned-skill helpers.
- Preserves: local storage, account sync, URL query synchronization, analysis refresh.

- [ ] **Step 1: Add failing integration assertions**

Require both surfaces to show no list on empty focus, resolve `k8s` to `Kubernetes`, select with keyboard, expose category labels, allow direct entry, and avoid `<datalist>`. Require the header sheet's saved skills to use the compact chip list contract.

- [ ] **Step 2: Run the two tests and confirm RED**

Run: `npm test -- --run src/features/career/career-overview.test.tsx src/features/owned-skills/owned-skills-sheet.test.tsx`

Expected: FAIL on `/career`'s native datalist and the old header-sheet markup.

- [ ] **Step 3: Wire `SkillPicker` into `/career`**

Replace the form/datalist block, reuse existing validation and `commitSkill` behavior, remove unused list IDs/imports/styles, and keep current catalog fetch and storage behavior.

- [ ] **Step 4: Wire `SkillPicker` into the header sheet**

Delete the duplicated ranking, listbox, and keyboard code. Use the shared picker and change added skills from full-width rows to wrapping chips with named remove buttons.

- [ ] **Step 5: Run the two integration tests and confirm GREEN**

Run: `npm test -- --run src/features/career/career-overview.test.tsx src/features/owned-skills/owned-skills-sheet.test.tsx`

Expected: PASS.

### Task 4: Redesign the home career briefing around the next action

**Files:**
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.styles.test.ts`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/e2e/home-career-insight.e2e.ts`
- Modify: `apps/web/e2e/home-market-context.e2e.ts`

**Interfaces:**
- Consumes: unchanged `CareerInsightSummary` and `CareerContextSummary`.
- Preserves: right market rail and in-feed market cards.

- [ ] **Step 1: Replace unit and style assertions with the approved hierarchy**

Require `다음에 준비할 기술`, `추천 근거 보기`, `준비도 높은 공고`, `기술이 겹치는 공고`, and the honest qualifier. Assert `현재 수요 상위` is absent from the briefing but remains in market content. Add CSS contracts for an asymmetric lead/facts layout and reduced mobile height.

- [ ] **Step 2: Run the focused home tests and confirm RED**

Run: `npm test -- --run src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts`

Expected: FAIL because the current briefing is a three-equal-column metric grid.

- [ ] **Step 3: Implement the approved briefing states**

Remove `topDemand` from `CareerBriefing`, render one lead recommendation plus two compact facts, use the compact setup and failure rows, and leave the market rail and feed data untouched.

- [ ] **Step 4: Implement responsive presentation**

Use one lead/facts row on desktop and a stacked lead with two side-by-side facts on mobile. Preserve 44px controls and ensure the recommendation link remains a clear, single-line action.

- [ ] **Step 5: Update browser expectations and confirm the home unit tests are GREEN**

Remove the duplicated-demand expectation, require the new labels, and tighten the briefing-height contract only after measuring the rendered result.

### Task 5: Document, visually verify, and run focused regression checks

**Files:**
- Modify: `design.md`
- Modify: `.hallmark/log.json`
- Modify only files above if verification reveals a defect.

**Interfaces:**
- Records the per-page design allowance without changing global tokens.

- [ ] **Step 1: Update the design contract**

Document that home briefing prioritizes one evidence-backed next skill and that skill entry is search-first, shared, and bounded.

- [ ] **Step 2: Run the focused unit suite**

Run:

```bash
npm test -- --run \
  src/features/owned-skills/skill-picker.test.tsx \
  src/features/owned-skills/owned-skills-sheet.test.tsx \
  src/features/career/career-overview.test.tsx \
  src/features/home-feed/home-feed.test.tsx \
  src/features/home-feed/home-feed.styles.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run one focused browser flow**

Run: `npx playwright test e2e/home-career-insight.e2e.ts`

Verify 1440px and 390px screenshots, no horizontal overflow, bounded picker results, keyboard selection, compact briefing, first feed visibility, and no browser errors. Confirm automatic infinite scroll code and sentinel remain unchanged by diff.

- [ ] **Step 4: Run static checks**

Run: `npm run lint && git diff --check`

Expected: PASS.

- [ ] **Step 5: Perform the final Hallmark audit**

Re-run the Slop Test against the changed surfaces, update `.hallmark/log.json`, and fix any critical findings before committing.

- [ ] **Step 6: Commit, push, open a PR, merge after checks, and verify production**

Push only `feat/career-briefing-skill-picker`, use the repository's normal pull-request path, wait for required checks, merge without touching the dirty root checkout, then capture the deployed home and both skill-entry surfaces.
