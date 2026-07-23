# Task 7 Recovery Fix Report

## Status

DONE

## Scope

Resolved the two remaining Important findings on top of
`584a8f5b79e0515f460c2e2ccfa582cd2f9ac3fb`:

- A previously successful saved-search evaluation now remains visible while
  the same authoritative saved-search rows move from `ready` to `loading` or
  `error`.
- A failed saved-search insert now leaves the loaded controller state ready,
  so the composer can preserve its safe alert, input, focus, and enabled retry
  action and then succeed on a later insert.

The alert data schema/store API, evaluation request payload, account ownership
token and generation, create serialization, merge/export/delete behavior, and
approved Korean copy are unchanged.

## Root Cause and Changes

### Evaluation identity and reset

`useSavedSearchEvaluation` previously assigned `IDLE_STATE` for every
`loadStatus !== "ready"`. A reload already retained the authoritative search
rows, but the evaluation hook discarded their groups. It also carried every
old group into a new ready evaluation's loading state without first checking
whether those groups belonged to the current searches.

The hook now compares the set of current evaluation search IDs with the set of
group `searchId` values:

- Equal, non-empty sets preserve the previous groups during a non-ready list
  transition.
- Empty searches, a different ID set, duplicate IDs, or incomplete groups
  reset to `idle` with no groups.
- A new ready identity starts loading with no stale groups, then stores only
  the newly validated response.
- The comparison follows the existing `includePaused` policy, so the identity
  is exactly the set that would be sent for evaluation.

`SavedSearchManager` now keeps rows and their evaluated totals rendered when a
reload has retained items. It also keeps the approved visible pending message
`공고 알림을 불러오는 중…`. Initial loads with no items still use the full
loading state, and empty error states still expose the existing `다시 시도`
action.

### Create recovery

`useSavedJobSearches.create` previously converted an insert exception into a
controller-wide `error` state. The composer only permits submission while the
authoritative list is `ready`, so its otherwise recoverable error UI became
permanently disabled.

Only the insert-exception branch now commits `ready(current.items)` and returns
`{ status: "error" }`. The composer continues to own the approved safe error
message and focus restoration. The loaded items remain authoritative, the
create queue is released as before, and a second submission reaches
`store.insert`. Initial list failures remain controller `error` states and can
still recover through `reload`.

## TDD Evidence

### Baseline

Before adding the recovery tests:

```text
Test Files  4 passed (4)
Tests       55 passed (55)
```

### RED

Tests were added before the production changes. The failures matched the two
root causes and the manager integration symptom:

```text
Test Files  4 failed (4)
Tests       4 failed | 56 passed (60)
```

- Same search IDs changed to `idle` with empty groups on `loading`.
- The manager replaced retained rows and totals with the full loading panel.
- The first rejected insert left `useSavedJobSearches` in `error`.
- The composer's retry submit button remained disabled.

The retained-row pending message was then captured in its own test-first
cycle:

```text
Test Files  1 failed (1)
Tests       1 failed | 11 skipped (12)
```

### Focused GREEN

```bash
cd apps/web
npm test -- --run src/features/saved-searches
```

```text
Test Files  4 passed (4)
Tests       62 passed (62)
```

The focused tests cover:

- ready groups surviving same-ID `loading` and `error` rerenders without an
  extra fetch;
- different-account-style IDs and empty searches clearing stale groups, then
  one new evaluation request using only the replacement ID;
- an in-flight evaluation being aborted when list loading stops being ready,
  without a replacement request or checkpoint write;
- manager totals and new counts remaining visible through retained-item reload
  and failure states;
- initial list failure remaining an error and succeeding on `reload`;
- first fake-store insert rejection preserving loaded items in `ready`, and a
  second insert succeeding;
- composer input, focus, approved safe alert, enabled retry button, second
  insert, and final success, with no raw provider text rendered.

## Personal Workspace Verification

```bash
cd apps/web
npm test -- --run src/app/career src/features/career src/features/account \
  src/features/authored-questions src/features/saved-library \
  src/features/saved-searches src/features/hiring-calendar \
  src/features/companies src/features/notifications
```

```text
Test Files  25 passed (25)
Tests       190 passed (190)
```

## Required E2E Verification

```bash
cd apps/web
npm run test:e2e -- \
  career-overview.e2e.ts \
  saved-library.e2e.ts \
  authored-questions.e2e.ts \
  company-profile.e2e.ts \
  --reporter=line
```

```text
Tests  14 passed (14)
Duration  1.1m
```

## Full Verification

```bash
cd apps/web
npm test -- --run
```

```text
Test Files  127 passed (127)
Tests       989 passed (989)
Duration    144.99s
```

```bash
cd apps/web
npm run lint
```

`next typegen` completed successfully and
`tsc --noEmit --project tsconfig.lint.json` exited 0. `git diff --check` also
exited 0 before the report was written and is rerun before commit.

## Behavior and Constraint Audit

- The evaluation request URL, method, headers, body fields, checkpoint IDs,
  and normalized response contract have no diff.
- Request sequence invalidation, effect cleanup, `AbortController.abort()`,
  StrictMode one-request behavior, and refresh-only retry behavior remain in
  place. Focused tests verify request counts and the non-ready abort path.
- Search identity is derived only from the current saved rows and response
  groups; no account identity, schema, or store API was changed.
- `useSavedJobSearches` account token/generation checks and serialized create
  queue are unchanged. A stale account still cannot commit a create result.
- Only the insert exception recovers to ready. Initial list failures keep the
  existing error state and `reload` recovery contract; rename, enable, remove,
  checkpoint, merge, export, and delete semantics are unchanged.
- Provider exception text is still caught and replaced by the existing public
  copy.
- No fixtures, E2E data, user/community content, or main-worktree files were
  changed.

## Remaining Concerns

None.
