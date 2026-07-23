# Task 7 Aborted Evaluation Settlement Report

## Status

DONE

## Scope

Resolved the remaining Important review finding on top of
`f4d3d82c4e2c314f53208e51b895b7029389562f`.

When a saved-search evaluation refresh was already `loading`, a same-search
list reload could abort the request but leave the evaluation permanently
`loading`. The manager then kept showing `공고 알림을 확인하는 중…` even
though no evaluation request remained active.

The evaluation request payload, refresh trigger, request sequencing, abort
cleanup, checkpoint behavior, saved-search storage, fixtures, and approved UI
copy are unchanged.

## Root Cause

The non-ready list branch preserved the current evaluation state whenever its
groups matched the current search IDs. That was correct for a settled
`ready`/`partial`/`error` state, but it also preserved the transient `loading`
state created by a refresh. Effect cleanup aborted that refresh, and no later
request was allowed to settle the state.

The prior abort test covered only an initial evaluation with no settled
result, so it verified the signal cleanup but not this retained-groups state
transition.

## Implementation

`useSavedSearchEvaluation` now retains the last settled evaluation snapshot:

- The snapshot contains the complete `ready`, `partial`, or `error` state,
  including groups and the public error field.
- It is keyed by a canonical, order-insensitive identity built from the
  current unique evaluation search IDs after the existing `includePaused`
  policy is applied.
- A same-identity non-ready list transition restores that snapshot only when
  the current evaluation is `loading`.
- An already-settled current state is returned unchanged.
- A different, empty, or duplicate identity clears the snapshot and resets to
  `idle`, preventing prior groups from being exposed for replacement rows.
- A ready transition with a different identity clears the snapshot before its
  request begins, so its loading state cannot display old groups.
- Checkpoint-storage degradation updates the retained snapshot to the same
  `partial` state exposed by the hook.

No manager production copy or rendering logic changed. Its integration test
now drives the real evaluation hook through a settled response, a deferred
refresh, and list `loading` then `error` transitions.

## TDD Evidence

### Baseline

Before adding the regression tests:

```text
Test Files  2 passed (2)
Tests       33 passed (33)
```

### RED

The tests were added before the production change:

```text
Test Files  2 failed (2)
Tests       4 failed | 35 passed (39)
```

The failures proved:

- a same-ID aborted refresh stayed `loading` instead of returning to `ready`;
- settled `partial` also stayed `loading`;
- settled `error` with its valid empty groups reset to `idle`;
- the manager kept rendering `공고 알림을 확인하는 중…` after abort.

The different, empty, and duplicate non-ready identity table passed during
RED, confirming that the regression was isolated from the existing stale
identity reset policy.

### Focused GREEN

```bash
cd apps/web
npm test -- --run \
  src/features/saved-searches/use-saved-search-evaluation.test.tsx \
  src/features/saved-searches/saved-search-manager.test.tsx
```

```text
Test Files  2 passed (2)
Tests       39 passed (39)
```

The regression tests verify the second request signal is aborted, the fetch
count remains two through both list transitions, groups and job counts remain
visible, the hook is no longer `loading`, and the evaluation pending message
disappears.

## Saved-search Suite

```bash
cd apps/web
npm test -- --run src/features/saved-searches
```

```text
Test Files  4 passed (4)
Tests       68 passed (68)
```

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
Tests       196 passed (196)
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
Tests     14 passed (14)
Duration  1.1m
```

## Full Verification

```bash
cd apps/web
npm test -- --run
```

```text
Test Files  127 passed (127)
Tests       995 passed (995)
Duration    167.76s
```

```bash
cd apps/web
npm run lint
```

`next typegen` completed and `tsc --noEmit --project tsconfig.lint.json`
exited 0. `git diff --check` is run again immediately before commit.

## Constraint Audit

- The evaluation URL, method, headers, body fields, and `cache` mode have no
  diff.
- `AbortController`, cleanup, request sequence invalidation, microtask start,
  request count, and refresh-only retry policy are unchanged.
- The retained identity is derived after the existing `includePaused` filter,
  matching exactly which saved rows are eligible for the request.
- Different IDs, empty rows, and duplicate IDs clear both rendered groups and
  the retained snapshot before any stale state can be reused.
- `ready`, `partial`, and `error` snapshots preserve their existing union
  fields; the implementation does not synthesize a new status or public copy.
- No saved-search schema/store API, account controller generation, fixture,
  E2E data, community/content file, or main-worktree file changed.

## Remaining Concerns

An independent read-only review found no Critical or Important issues and
judged the change ready to merge. It noted two non-blocking follow-ups:

- The error and checkpoint paths update the snapshot ref inside functional
  state updaters. Those writes are idempotent and request-guarded, but a reducer
  would make concurrent-render reasoning simpler if this hook grows.
- The invalid-identity table proves the visible `idle` reset but does not
  directly reintroduce a prior identity to observe the private ref. Production
  account isolation still relies on globally unique saved-search primary keys
  and the controller's empty state during viewer replacement; a dedicated
  viewer-transition regression could document that invariant further.
