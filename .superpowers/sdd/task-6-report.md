# Task 6 Report: Streamline Home and Community Copy

## Status

DONE

## Changes

- Applied the approved home hierarchy: `커리어 이야기`, `채용 시장`, and
  `내 기술과 맞는 공고`.
- Rendered market titles without a hard-coded Korean object particle
  (`Java 요구 공고`, `Go 요구 공고`).
- Used `PRODUCT_TERMS` for `내 기술`, `저장 목록`, `미표기`, and the
  sentence-form `필수·우대 미표기` instead of duplicating canonical labels.
- Replaced interface-oriented local-post wording with `이 기기에 남은 글`
  while retaining local recovery, migration, deletion, and delete-cascade
  behavior.
- Standardized local author and comment provenance on `이 기기에서 작성`.
- Centralized the six approved community failure messages and prevented raw
  database/provider details from reaching store, feed, editor, comment, and
  migration feedback.
- Preserved failed post, edit, and comment input in place and made destructive
  failures explicitly say that the content remains.
- Replaced visible three-period pending copy with Unicode ellipses, including
  post, edit, comment, delete, report, detail-loading, and pagination states.
- Removed redundant visible success paragraphs for reactions, saves, follows,
  comments, and edits where the changed button, count, or content already
  communicates the result. Existing accessible state (`aria-pressed`, counts,
  rendered comments) remains intact.
- Changed the destructive confirmation action from `정말 삭제` to `글 삭제`
  without changing the confirmation step or cascade operation.
- Kept the starter guide clearly read-only and preserved every starter item,
  user-authored post/comment, and employer-authored posting body unchanged.

## TDD Evidence

### Baseline

The six prescribed focused files passed before Task 6 changes:

```text
Test Files  6 passed (6)
Tests       63 passed (63)
```

### RED

After changing only the focused expectations, the prescribed focused command
failed on the old headings, `미분류`, visible success paragraphs, old delete
confirmation, failure wording, and three-period pending labels:

```text
Test Files  6 failed (6)
Tests       19 failed | 46 passed (65)
```

### Focused GREEN

After implementation, the same six-file command passed:

```text
Test Files  6 passed (6)
Tests       65 passed (65)
```

### Broad GREEN

```bash
cd apps/web
npm test -- --run \
  src/app/page.test.tsx \
  src/app/posts \
  src/features/home-feed \
  src/features/community \
  --reporter=dot
```

```text
Test Files  24 passed (24)
Tests       360 passed (360)
```

After final review fixes, the expanded integration slice also included the
dependent SearchResults contract:

```text
Test Files  25 passed (25)
Tests       376 passed (376)
```

### Review-fix RED/GREEN

Final review found that reaction/save failures could remain visible after a
successful retry, and that a hard-coded `을` produced `Java을`/`Go을`. It also
requested consistent `이 기기에서 작성` labels. The new reaction, save,
vowel-ending skill, model, and dependent search expectations failed before the
fixes:

```text
Test Files  3 failed (3)
Tests       5 failed | 47 passed (52)
```

After the fixes, the same focused integration command passed:

```text
Test Files  3 passed (3)
Tests       53 passed (53)
```

## Community E2E

```bash
cd apps/web
npm run test:e2e -- \
  authenticated-community.e2e.ts \
  post-detail.e2e.ts \
  home-market-context.e2e.ts \
  home-career-insight.e2e.ts \
  --reporter=line
```

The first run found only assertion drift: repeated section text needed scoped
locators, while the owned-skills sheet and login page already used canonical
labels from earlier tasks. No persistence or interaction assertion failed.
After correcting those selectors, the complete requested run passed:

```text
Tests  12 passed (12)
```

This retains cross-context authenticated post persistence, draft recovery,
editing, comments, search visibility, deletion, local recovery-only behavior,
market filtering, and personalized career insight coverage.

## Full Verification

```bash
cd apps/web
npm test -- --run --reporter=dot
```

An earlier full run exposed the SearchResults dependency on the shared local
author label. Final review explicitly required consistent `이 기기` wording,
so the dependent test assertion was updated without changing search production
logic. The clean final full rerun passed:

```text
Test Files  126 passed (126)
Tests       942 passed (942)
Duration    147.50s
```

```bash
cd apps/web
npm run lint
```

`next typegen` completed successfully and
`tsc --noEmit --project tsconfig.lint.json` exited 0.

`git diff --check` also exited 0.

## Self-review

- Confirmed scoped production strings contain no `미분류`, `정말 삭제`,
  `브라우저 원본`, old home hierarchy, three-period pending label, or compact
  `다시 시도해주세요` form.
- Confirmed the exact approved failure messages are asserted for invalid input,
  authentication, provider connection, post creation, post update, and comment
  creation; tests also assert that raw provider text is absent.
- Confirmed failed post, edit, comment, migration, and local-delete paths keep
  their draft or content and say so explicitly.
- Confirmed reaction, save, follow, comment, report, edit, delete, pagination,
  feed-order, draft-recovery, migration, and persistence logic was not changed.
- Confirmed no fixture, starter item body, user/community original, employer
  posting original, API query, database mutation, or migration schema file has
  a diff.
- Confirmed every production change is within the Task 6 paths. The only
  additional test change is the dependent SearchResults assertion explicitly
  requested by final review; no search production file changed.

## Code Review

The read-only reviewer initially reported two Important findings and one Minor:
stale reaction/save failure copy after a successful retry, incorrect Korean
particles in market titles, and inconsistent local-device author wording. All
three were fixed with regression coverage. Follow-up review found no regression
and returned `Ready to merge? Yes`.

## Remaining Concerns

None.
