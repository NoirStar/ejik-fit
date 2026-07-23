# Task 7 Final Review Fix Report

## Status

DONE

## Scope

Resolved the final-review findings on top of base
`f259df96d9cada4781824b5aae4af2e14cd7d4de`. The changes make account storage
states truthful, keep failed alert/profile edits recoverable, use one public
alert vocabulary, fix Korean particles, and extend the required responsive
contracts to 320px. Existing account reconciliation, local/account merge
semantics, request ordering, persistence keys, schemas, API queries, fixtures,
user/community originals, and employer-authored posting content are unchanged.

## Changes

- Passed the existing `useAccountStateSync(viewer)` result from `AppShell`
  through `AuthViewerProvider`, so career, saved items, followed companies, and
  account pages distinguish `local`, `syncing`, `synced`, and `error` instead
  of treating every signed-in viewer as already saved.
- Kept the sync failure honest: the UI reports `이 기기에 저장됨` and
  `계정에 저장하지 못했습니다.` while retaining the local data.
- Replaced implementation-oriented account and alert terms with the public
  language `계정`, `이 기기`, `공고 알림`, and `알림 조건`.
- Preserved the nickname or alert name and restored input focus after failed
  profile saves, alert creation, and alert renames. Provider exception details
  never reach the UI.
- Kept loaded alert conditions and prior evaluation groups visible when reload
  or refresh fails, with explicit durability copy. Failed deletion also states
  that the existing alert remains.
- Removed particle guessing from saved-item and authored-post deletion copy by
  using the shared `withObjectParticle` helper. Application-stage feedback now
  uses a quoted label followed by the fixed particle `로`.
- Updated both generated and persisted notification reasons to the same
  `공고 알림` vocabulary.
- Added 320px coverage to saved-library and company-profile viewport matrices,
  and retained the existing 390px authored-question journey before shrinking
  it to 320px. The contracts verify no horizontal overflow, single-line core
  actions, and touch targets of at least 44px by 44px.
- Addressed the narrow final-review follow-up: authenticated `local` storage
  now has an explicit AppShell message, the account's alert summary no longer
  borrows the independent career-sync state, and its accessible list label uses
  `알림 조건` consistently.

## TDD Evidence

### Baseline

The prescribed personal-workspace unit selection passed before review-fix
tests or production changes were added.

### Unit RED

Tests were changed first and production remained untouched for both RED runs:

```text
Core storage/account slice:
Test Files  5 failed (5)
Tests       24 failed | 55 passed (79)

Alert/error/particle slice:
Test Files  6 failed (6)
Tests       25 failed | 47 passed (72)
```

The failures covered false `계정에 저장됨` labels, missing shared sync state,
old alert/account terminology, exposed durability gaps, cleared evaluation
groups, hard-coded particles, and application-stage suffix guessing.

### Focused GREEN

```text
Test Files  11 passed (11)
Tests       151 passed (151)
```

### Responsive RED and GREEN

The new 320px checks first failed on all three surfaces because the primary
actions still computed to `white-space: normal`:

```text
Tests  3 failed (3)
```

After the narrow style changes, the same selection passed:

```text
Tests  3 passed (3)
```

### Final-review RED and GREEN

The three reviewer findings were captured with focused expectations before the
production corrections:

```text
Test Files  3 failed (3)
Tests       3 failed | 37 passed (40)
```

After the explicit local-state copy, independent account-alert summary, and
accessible-label correction, the same selection passed:

```text
Test Files  3 passed (3)
Tests       40 passed (40)
```

The repository-wide run then exposed an assertion race in the new composer
focus test: the alert rendered before its React focus effect completed. The
test now awaits that effect, and the complete composer file passes 13 of 13.

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
Tests       183 passed (183)
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
Tests       982 passed (982)
Duration    146.09s
```

```bash
cd apps/web
npm run lint
```

`next typegen` completed successfully and
`tsc --noEmit --project tsconfig.lint.json` exited 0. `git diff --check` also
exited 0.

## Account Sync Audit

- `rg` confirms the only production caller of `useAccountStateSync(viewer)`
  remains `AppShell`.
- `use-account-state-sync.ts` and `account-state.ts` have no diff.
- The existing request sequence remains `readRemote` → merge local and remote
  state → `writeRemote` → write the latest local state → conditional `flush`.
- The full run includes the 18 passing `AppShell` tests and 3 passing
  `account-state` tests. The AppShell integration still verifies one auth
  subscription while exposing the returned sync state through context.

## Self-review

- Confirmed signed-in state alone never produces a false saved-to-account
  success label.
- Confirmed sync errors retain local data and show a fixed safe message.
- Confirmed failed nickname and alert mutations retain values, restore focus,
  and hide raw provider details.
- Confirmed failed alert refreshes retain prior conditions or result groups.
- Confirmed product-owned account and alert copy does not reintroduce the
  prohibited implementation terms.
- Confirmed all required 320px flows preserve their existing behavior while
  adding overflow, no-wrap, and touch-target assertions.
- Confirmed the sync hook, request/reconciliation implementation, schemas, and
  API behavior are unchanged.
- A narrow reviewer follow-up confirmed all three reported findings are
  resolved and found no new blocker.

## Remaining Concerns

None.
