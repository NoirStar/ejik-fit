# Task 5 Second Review Fix Report

## Status

DONE

## Scope

Removed the remaining implementation-oriented `서버` wording from the global
search start, merge-loading, community disclosure, and public-account empty
states. Data-source selection, result merging, pagination, query parameters,
filters, search scopes, and result content are unchanged. No fixture, user or
community original, employer-authored posting content, or main worktree file
was modified.

## Changes

- Described the initial search sources as public recruitment data, public
  account posts, previous browser-saved posts, and the usage guide.
- Described the pending merge as adding public community results while keeping
  job, company, and technology results visible.
- Described community provenance and the public-account empty state entirely
  from the user's perspective.
- Updated the existing unit and `global-search` E2E expectations without
  removing or weakening the core search-scope, result, destination,
  accessibility, responsive, and recovery assertions.
- Added scoped `API|서버|응답` assertions for the start, merge-loading,
  disclosure, and public-account empty UI copy. The assertions deliberately do
  not inspect user posts, fixtures, or employer-authored result content.

## TDD Evidence

### RED

After changing only the relevant unit and E2E expectations, the focused search
unit command failed on the old production copy as expected:

```bash
cd apps/web
npm test -- --run src/features/search/search-results.test.tsx
```

```text
Test Files  1 failed (1)
Tests       6 failed | 7 passed (13)
```

The six failures covered the four intended copy states, including repeated
disclosure expectations. No production code had been changed before this run.

### Focused GREEN

After changing only the four production text nodes, the same command passed:

```text
Test Files  1 passed (1)
Tests       13 passed (13)
```

## Global Search E2E

```bash
cd apps/web
npm run test:e2e -- global-search.e2e.ts --reporter=line
```

```text
Tests  6 passed (6)
```

This run retained the existing verified company, job, technology, scope
navigation, destination, overflow, touch-target, keyboard, guidance, and
browser-post recovery checks.

## Full Verification

```bash
cd apps/web
npm test -- --run
```

```text
Test Files  126 passed (126)
Tests       933 passed (933)
Duration    159.86s
```

```bash
cd apps/web
npm run lint
```

`next typegen` completed successfully and
`tsc --noEmit --project tsconfig.lint.json` exited 0.

`git diff --check` also exited 0.

## Self-review

- Confirmed the legacy user-facing phrases `서버의 공개 계정 글`,
  `서버 검색 결과`, and `서버 전체 글` no longer occur in the related
  production, unit, or E2E files.
- Confirmed the production diff changes only the four requested text nodes.
- Confirmed the unit and E2E jargon checks are scoped to product-owned UI copy
  and do not reject legitimate words in user or posting originals.
- Confirmed no request, store, merge, cursor, loading-state selection, or
  pagination logic changed.
- Confirmed the commit will contain only the component, its focused unit test,
  the global-search E2E, and this report.

## Remaining Concerns

None.
