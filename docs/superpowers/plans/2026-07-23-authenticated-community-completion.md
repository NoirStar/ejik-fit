# Authenticated Community Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every real community write account-backed and durable, preserve legacy local drafts without data loss, separate starter examples from real activity, and complete editing, pagination, search, and production-release verification.

**Architecture:** Supabase remains the single source of truth for authenticated community data. The browser keeps only an explicit pre-login draft and legacy recovery records; an app-shell migration moves legacy records to Supabase after authentication. Community reads use cursor pages and an invoker-rights PostgreSQL search RPC. Starter content is rendered as a clearly labelled, read-only guide outside real feed metrics and social actions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase JS/SSR, PostgreSQL/Alembic, Vitest/Testing Library, Pytest, Playwright.

## Global Constraints

- Preserve unrelated dirty files and user-owned worktrees. Stage only files named by the active task.
- Follow test-driven development: add one focused failing assertion, run it and observe the expected failure, implement the smallest production change, then rerun the focused suite.
- Do not add a second community persistence path. Authenticated writes go through `CommunityStore`; unauthenticated composition only stores a resumable session draft.
- Never auto-publish a restored draft. The authenticated user must review and press publish.
- Keep legacy local records until every corresponding server write succeeds. Partial or failed migrations remain locally recoverable.
- Starter/mock records must never contribute to real counts, following, saved items, authored posts, or editable post state.
- PostgreSQL search must be parameter-bound, `SECURITY INVOKER`, RLS-respecting, and return only explicit public columns.
- Cursor ordering is deterministic: `(created_at DESC, id DESC)`. A cursor always contains both values.
- Do not expose production secrets in test fixtures, logs, client bundles, or documentation.
- Do not claim production completion until local verification, pushed CI, and an unauthenticated public smoke request all pass. If Vercel protection cannot be changed with available authority, report it as an external release blocker.

---

### Task 1: Create an isolated implementation worktree and establish the baseline

**Files:**

- No product files changed.
- Worktree: `.worktrees/authenticated-community-completion`
- Branch: `feature/authenticated-community-completion`

- [ ] Verify the repository-local worktree directory is ignored.

Run:

```bash
git check-ignore -q .worktrees && echo ignored
```

Expected: `ignored`.

- [ ] Create the worktree from the current local `main`, which includes the approved design and this plan.

```bash
git worktree add .worktrees/authenticated-community-completion -b feature/authenticated-community-completion
```

- [ ] Install or validate dependencies without modifying the root user's untracked `package-lock.json`.

```bash
cd .worktrees/authenticated-community-completion/apps/web
npm ci
```

- [ ] Run the focused existing baselines before changing code.

```bash
cd .worktrees/authenticated-community-completion/apps/web
npm test -- --run \
  src/features/community/community-store.test.ts \
  src/features/community/community-migration.test.ts \
  src/features/community/use-community-feed.test.tsx \
  src/features/home-feed/home-feed.test.tsx \
  src/features/search/search-results.test.tsx

cd ../../..
/root/work/ejik-fit/.venv/bin/pytest \
  packages/backend/tests/test_server_community_security.py \
  packages/backend/tests/test_migration_offline.py -q
```

Expected: all selected tests pass. Stop and diagnose any baseline failure before implementation.

---

### Task 2: Replace guest local publishing with a resumable session draft

**Files:**

- Create: `apps/web/src/features/community/community-draft.ts`
- Create: `apps/web/src/features/community/community-draft.test.ts`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/e2e/post-detail.e2e.ts`

- [ ] Write failing unit tests for the draft contract: valid round-trip, malformed JSON removal, stale draft removal, and explicit consume/remove behavior.

Use this public API:

```ts
export const COMMUNITY_DRAFT_STORAGE_KEY = "ejik-fit:community-draft";

export interface CommunityDraft {
  readonly version: 1;
  readonly category: CommunityCategory;
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly savedAt: string;
}

export function saveCommunityDraft(
  input: CreateCommunityPostInput,
  storage: Storage,
): CommunityDraft;
export function readCommunityDraft(storage: Storage, now?: Date): CommunityDraft | null;
export function removeCommunityDraft(storage: Storage): void;
```

Drafts older than seven days are invalid. Reuse contract validation/normalization rather than accepting arbitrary stored objects.

- [ ] Run the draft test and confirm it fails because the module does not exist.

```bash
cd apps/web
npm test -- --run src/features/community/community-draft.test.ts
```

- [ ] Implement the versioned `sessionStorage` draft helper with guarded JSON parsing and no browser global access at module import time.

- [ ] Add failing home-feed tests for the unauthenticated submit path.

Required assertions:

```ts
expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toContain("도움이 필요합니다");
expect(localStorage.getItem(LOCAL_COMMUNITY_POSTS_STORAGE_KEY)).toBeNull();
expect(mockPush).toHaveBeenCalledWith("/login?next=%2F%3Fcompose%3Dresume");
```

Also assert that `?compose=resume` restores the fields but does not call `createPost` until the user clicks publish.

- [ ] Implement the auth gate in `home-feed.tsx`.

Behavior:

1. Let a guest type so work is not lost.
2. On submit, validate the same title/body/tags constraints used by the server path.
3. Save the normalized draft to `window.sessionStorage`.
4. Navigate to `/login?next=%2F%3Fcompose%3Dresume`.
5. After login, restore the draft, show a concise “임시 저장된 글” notice, and require an explicit publish click.
6. Remove the draft only after `store.createPost` resolves successfully.

- [ ] Change `app/page.tsx` to distinguish `compose=1` from `compose=resume` and pass the mode to `HomeFeed`.

```ts
type ComposeMode = "new" | "resume" | null;
```

- [ ] Update the guest Playwright scenario to verify redirect + session draft + absence of a newly created local post.

- [ ] Run the focused tests.

```bash
cd apps/web
npm test -- --run \
  src/features/community/community-draft.test.ts \
  src/features/home-feed/home-feed.test.tsx
npx playwright test e2e/post-detail.e2e.ts --grep "draft"
```

- [ ] Commit only Task 2 files.

```bash
git add apps/web/src/features/community/community-draft.ts \
  apps/web/src/features/community/community-draft.test.ts \
  apps/web/src/app/page.tsx \
  apps/web/src/features/home-feed/home-feed.tsx \
  apps/web/src/features/home-feed/home-feed.test.tsx \
  apps/web/e2e/post-detail.e2e.ts
git commit -m "feat: require an account for community publishing"
```

---

### Task 3: Move legacy local migration to authenticated app startup

**Files:**

- Create: `apps/web/src/features/community/use-community-legacy-migration.ts`
- Create: `apps/web/src/features/community/use-community-legacy-migration.test.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.test.tsx`
- Modify: `apps/web/src/features/community/use-community-feed.ts`
- Modify: `apps/web/src/features/community/use-community-feed.test.tsx`
- Modify: `apps/web/src/features/community/community-migration.ts`
- Modify: `apps/web/src/features/community/community-migration.test.ts`

- [ ] Add failing migration tests for all-or-nothing local deletion and idempotent retries.

Cases:

- post + comments all succeed -> remove that legacy post;
- post succeeds but one comment fails -> preserve the legacy post and comments;
- deterministic IDs already exist -> treat duplicate/upsert-safe writes as success;
- one record fails -> continue migrating other independent records and return structured failures.

- [ ] Make `migrateLocalCommunityContent` return a stable result shape.

```ts
export interface CommunityMigrationResult {
  readonly migratedPostIds: readonly string[];
  readonly failures: readonly {
    readonly localPostId: string;
    readonly message: string;
  }[];
}
```

- [ ] Write a failing hook test proving migration runs once after `viewer.status` becomes `authenticated`, never for guests, and is not rerun on ordinary feed refreshes.

- [ ] Implement `useCommunityLegacyMigration(viewer)` with a per-user in-memory guard and a retry method when failures remain. Keep migration status small and UI-safe:

```ts
type LegacyMigrationStatus =
  | { phase: "idle" | "running" | "complete"; failureCount: 0 }
  | { phase: "failed"; failureCount: number; retry: () => void };
```

- [ ] Mount the hook under `AuthViewerProvider` in `app-shell.tsx`. Surface only actionable failures in the existing announcement/toast pattern; do not block navigation.

- [ ] Remove migration work and migration failure state from `use-community-feed.ts`. The feed hook must only read feed data.

- [ ] Run focused tests.

```bash
cd apps/web
npm test -- --run \
  src/features/community/community-migration.test.ts \
  src/features/community/use-community-legacy-migration.test.tsx \
  src/features/community/use-community-feed.test.tsx \
  src/components/app-shell/app-shell.test.tsx
```

- [ ] Commit Task 3.

```bash
git add apps/web/src/features/community/use-community-legacy-migration.ts \
  apps/web/src/features/community/use-community-legacy-migration.test.tsx \
  apps/web/src/components/app-shell/app-shell.tsx \
  apps/web/src/components/app-shell/app-shell.test.tsx \
  apps/web/src/features/community/use-community-feed.ts \
  apps/web/src/features/community/use-community-feed.test.tsx \
  apps/web/src/features/community/community-migration.ts \
  apps/web/src/features/community/community-migration.test.ts
git commit -m "feat: migrate legacy community data after sign in"
```

---

### Task 4: Add deterministic cursor pages and edit operations to the community store

**Files:**

- Modify: `apps/web/src/lib/community-contract.ts`
- Modify: `apps/web/src/features/community/community-mapper.ts`
- Modify: `apps/web/src/features/community/community-mapper.test.ts`
- Modify: `apps/web/src/features/community/community-store.ts`
- Modify: `apps/web/src/features/community/community-store.test.ts`
- Modify: `apps/web/src/features/community/use-community-feed.ts`
- Modify: `apps/web/src/features/community/use-community-feed.test.tsx`

- [ ] Add failing contract/store tests for cursor encoding, `limit + 1` lookahead, stable tie-breaking by ID, owner-scoped post update, and owner-scoped comment update.

Add these contracts:

```ts
export interface CommunityCursor {
  readonly createdAt: string;
  readonly id: string;
}

export interface CommunityPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: CommunityCursor | null;
}

export interface UpdateCommunityPostInput {
  readonly category: CommunityCategory;
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
}
```

Extend `CommunityStore`:

```ts
listPostPage(input: {
  readonly authorId?: string;
  readonly before?: CommunityCursor;
  readonly limit?: number;
}): Promise<CommunityPage<CommunityPost>>;
listCommentPage(input: {
  readonly postId: string;
  readonly before?: CommunityCursor;
  readonly limit?: number;
}): Promise<CommunityPage<CommunityComment>>;
updatePost(
  authorId: string,
  postId: string,
  input: UpdateCommunityPostInput,
): Promise<CommunityPost>;
updateComment(
  authorId: string,
  commentId: string,
  body: string,
): Promise<CommunityComment>;
```

Keep `listPosts` and `listComments` as first-page compatibility wrappers until all consumers are migrated.

- [ ] Implement cursor filters with the Supabase query builder.

The logical predicate is:

```sql
created_at < :created_at
OR (created_at = :created_at AND id < :id)
```

Use `.or(...)` only with cursor values validated by the contract layer. Always order by `created_at DESC` and then `id DESC`, request at most 51 rows, return at most 50.

- [ ] Implement updates as `update(...).eq("id", id).eq("author_id", authorId).select(POST_COLUMNS).single()`. Map no-row/RLS responses to the existing safe store error contract.

- [ ] Extend `useCommunityFeed` with `nextCursor`, `loadingMore`, and `loadMore()`. Deduplicate by post ID when pages overlap and leave the current list visible if a later page fails.

- [ ] Run focused store/hook tests.

```bash
cd apps/web
npm test -- --run \
  src/features/community/community-mapper.test.ts \
  src/features/community/community-store.test.ts \
  src/features/community/use-community-feed.test.tsx
```

- [ ] Commit Task 4.

```bash
git add apps/web/src/lib/community-contract.ts \
  apps/web/src/features/community/community-mapper.ts \
  apps/web/src/features/community/community-mapper.test.ts \
  apps/web/src/features/community/community-store.ts \
  apps/web/src/features/community/community-store.test.ts \
  apps/web/src/features/community/use-community-feed.ts \
  apps/web/src/features/community/use-community-feed.test.tsx
git commit -m "feat: paginate and edit server community records"
```

---

### Task 5: Add an RLS-safe PostgreSQL community search function

**Files:**

- Create: `packages/backend/alembic/versions/20260723_0023_community_search.py`
- Create: `packages/backend/tests/test_community_search_security.py`
- Modify: `packages/backend/tests/test_migration_offline.py`

- [ ] Write a failing migration security test that imports the new revision, captures emitted PostgreSQL SQL, and asserts all of the following:

- the function is `SECURITY INVOKER`, not definer;
- `search_path` is empty or explicitly hardened;
- results expose public post/profile fields only;
- no email, provider metadata, or private auth columns are selected;
- query text is a function parameter, not interpolated SQL;
- anonymous and authenticated roles may execute, while `PUBLIC` is revoked;
- the cursor compares `(p.created_at, p.id)` and ordering matches it;
- the requested limit is clamped;
- downgrade drops the function and any migration-owned indexes.

- [ ] Implement revision `0023` with a PostgreSQL-only upgrade branch and a no-op-safe SQLite branch.

Function signature:

```sql
public.search_community_posts(
  search_query text,
  before_created_at timestamptz DEFAULT NULL,
  before_id uuid DEFAULT NULL,
  result_limit integer DEFAULT 20
)
```

The return table must mirror the explicit public post columns consumed by `CommunityPost`, plus `author_nickname`. Normalize with `btrim`, reject queries outside 2..80 characters by returning no rows, search title/body/category/tags, and fetch no more than 51 rows. Use `ILIKE '%' || normalized_query || '%'` and `jsonb_array_elements_text` with bound function variables.

- [ ] Add optional `pg_trgm` GIN indexes only when the extension is available. Do not make deployment fail on a provider where extension creation is unavailable; the function remains correct without the optimization.

- [ ] Verify offline SQL and focused backend tests.

```bash
/root/work/ejik-fit/.venv/bin/pytest \
  packages/backend/tests/test_community_search_security.py \
  packages/backend/tests/test_migration_offline.py \
  packages/backend/tests/test_server_community_security.py -v
```

- [ ] Commit Task 5.

```bash
git add packages/backend/alembic/versions/20260723_0023_community_search.py \
  packages/backend/tests/test_community_search_security.py \
  packages/backend/tests/test_migration_offline.py
git commit -m "feat: add secure community search RPC"
```

---

### Task 6: Connect server-wide search to the web store and search page

**Files:**

- Modify: `apps/web/src/features/community/community-mapper.ts`
- Modify: `apps/web/src/features/community/community-mapper.test.ts`
- Modify: `apps/web/src/features/community/community-store.ts`
- Modify: `apps/web/src/features/community/community-store.test.ts`
- Create: `apps/web/src/features/community/use-community-search.ts`
- Create: `apps/web/src/features/community/use-community-search.test.tsx`
- Modify: `apps/web/src/app/search/page.tsx`
- Modify: `apps/web/src/features/search/search-results.tsx`
- Modify: `apps/web/src/features/search/search-results.test.tsx`

- [ ] Add a failing mapper/store test for the flat RPC row (`author_nickname`) and exact RPC arguments.

Extend the store:

```ts
searchPosts(input: {
  readonly query: string;
  readonly before?: CommunityCursor;
  readonly limit?: number;
}): Promise<CommunityPage<CommunityPost>>;
```

Expected RPC call:

```ts
client.rpc("search_community_posts", {
  search_query: normalizedQuery,
  before_created_at: before?.createdAt ?? null,
  before_id: before?.id ?? null,
  result_limit: limit + 1,
});
```

- [ ] Implement `useCommunitySearch(query)` with stale-request suppression, empty/one-character query short-circuiting, first-page loading, retry, and load-more behavior.

- [ ] Add failing UI tests proving:

- server results come from the RPC hook rather than filtering the latest 50 posts;
- a later page appends and deduplicates;
- starter guide matches appear in a separate “커뮤니티 활용 가이드” section;
- legacy local matches appear in a separate “이전 기기 저장 글” recovery section;
- neither guide nor legacy rows are labelled as current server-wide community results.

- [ ] Update the search page and result component. Preserve job/company/skill search behavior.

- [ ] Run focused tests.

```bash
cd apps/web
npm test -- --run \
  src/features/community/community-mapper.test.ts \
  src/features/community/community-store.test.ts \
  src/features/community/use-community-search.test.tsx \
  src/features/search/search-results.test.tsx
```

- [ ] Commit Task 6.

```bash
git add apps/web/src/features/community/community-mapper.ts \
  apps/web/src/features/community/community-mapper.test.ts \
  apps/web/src/features/community/community-store.ts \
  apps/web/src/features/community/community-store.test.ts \
  apps/web/src/features/community/use-community-search.ts \
  apps/web/src/features/community/use-community-search.test.tsx \
  apps/web/src/app/search/page.tsx \
  apps/web/src/features/search/search-results.tsx \
  apps/web/src/features/search/search-results.test.tsx
git commit -m "feat: search the full server community"
```

---

### Task 7: Separate starter guidance and legacy recovery from the real feed

**Files:**

- Create: `apps/web/src/features/home-feed/starter-community-guide.tsx`
- Create: `apps/web/src/features/home-feed/starter-community-guide.test.tsx`
- Modify: `apps/web/src/features/home-feed/mock-community.ts`
- Modify: `apps/web/src/features/home-feed/model.ts`
- Modify: `apps/web/src/features/home-feed/model.test.ts`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/features/home-feed/post-detail-view.tsx`
- Modify: `apps/web/src/features/home-feed/mock-post-details.ts`
- Modify: `apps/web/src/features/home-feed/mock-post-details.test.ts`
- Modify: `apps/web/e2e/post-detail.e2e.ts`

- [ ] Add failing model tests asserting `buildHomeFeedSnapshot(...).feedItems` never contains starter/mock community posts or interview reviews.

- [ ] Add a failing guide component test asserting every starter item is visibly labelled `이직핏 커뮤니티 가이드` and has no like, save, follow, comment, report, or edit control.

- [ ] Remove `MOCK_COMMUNITY_POSTS` and `MOCK_INTERVIEW_REVIEWS` from `mergeFeed`. Keep official jobs and market intelligence in the action feed.

- [ ] Render a compact, separate guide module below real community activity. It may link to starter detail pages, but the detail view must remain read-only and explain that the content is an example.

- [ ] Render unmatched legacy local posts in a separate recovery module labelled `이전 기기 저장 글`. Keep only recovery/delete actions; do not display server-like counts or mix them into real sort order.

- [ ] Add a visible `더 보기` control to real server activity when `useCommunityFeed.nextCursor` exists. Disable it during `loadingMore`, and keep loaded cards stable on failure.

- [ ] Update Playwright coverage for read-only starter detail and seeded legacy recovery detail.

- [ ] Run focused tests.

```bash
cd apps/web
npm test -- --run \
  src/features/home-feed/model.test.ts \
  src/features/home-feed/starter-community-guide.test.tsx \
  src/features/home-feed/mock-post-details.test.ts \
  src/features/home-feed/home-feed.test.tsx
npx playwright test e2e/post-detail.e2e.ts
```

- [ ] Commit Task 7.

```bash
git add apps/web/src/features/home-feed/starter-community-guide.tsx \
  apps/web/src/features/home-feed/starter-community-guide.test.tsx \
  apps/web/src/features/home-feed/mock-community.ts \
  apps/web/src/features/home-feed/model.ts \
  apps/web/src/features/home-feed/model.test.ts \
  apps/web/src/features/home-feed/home-feed.tsx \
  apps/web/src/features/home-feed/home-feed.test.tsx \
  apps/web/src/features/home-feed/home-feed.module.css \
  apps/web/src/features/home-feed/post-detail-view.tsx \
  apps/web/src/features/home-feed/mock-post-details.ts \
  apps/web/src/features/home-feed/mock-post-details.test.ts \
  apps/web/e2e/post-detail.e2e.ts
git commit -m "refactor: separate community guidance from real activity"
```

---

### Task 8: Complete real post and comment editing with paged comments

**Files:**

- Create: `apps/web/src/features/community/server-post-editor.tsx`
- Create: `apps/web/src/features/community/server-post-editor.test.tsx`
- Create: `apps/web/src/features/community/server-comment-list.tsx`
- Create: `apps/web/src/features/community/server-comment-list.test.tsx`
- Modify: `apps/web/src/features/community/server-post-detail.tsx`
- Modify: `apps/web/src/features/community/server-post-detail.test.tsx`
- Modify: `apps/web/src/app/posts/[id]/post-detail.module.css`

- [ ] Write failing post editor tests for author-only visibility, validation, cancel without mutation, successful save, and server error recovery without losing typed content.

- [ ] Implement `ServerPostEditor` using the existing community composer fields and `store.updatePost`. Do not duplicate category/title/body/tag limits; import the contract constants/normalizers.

- [ ] Write failing comment-list tests for first-page load, load more, deduplication, author-only edit/delete, whitespace/length validation, cancel, and a failed update that leaves the editor open.

- [ ] Implement `ServerCommentList` using `listCommentPage`, `updateComment`, and `deleteComment`. Update local state from the returned server record. Preserve deterministic ordering after edits.

- [ ] Reduce `server-post-detail.tsx` to orchestration: post fetch/viewer state, post-level actions, editor toggle, report dialog, and the paged comment component.

- [ ] Ensure successful post edits update the rendered title/body/category/tags immediately. Ensure successful deletion still returns to the correct feed route.

- [ ] Run focused tests.

```bash
cd apps/web
npm test -- --run \
  src/features/community/server-post-editor.test.tsx \
  src/features/community/server-comment-list.test.tsx \
  src/features/community/server-post-detail.test.tsx
```

- [ ] Commit Task 8.

```bash
git add apps/web/src/features/community/server-post-editor.tsx \
  apps/web/src/features/community/server-post-editor.test.tsx \
  apps/web/src/features/community/server-comment-list.tsx \
  apps/web/src/features/community/server-comment-list.test.tsx \
  apps/web/src/features/community/server-post-detail.tsx \
  apps/web/src/features/community/server-post-detail.test.tsx \
  apps/web/src/app/posts/[id]/post-detail.module.css
git commit -m "feat: edit community posts and comments"
```

---

### Task 9: Align authored, saved, and following views with server truth

**Files:**

- Modify: `apps/web/src/features/authored-questions/authored-questions.tsx`
- Modify: `apps/web/src/features/authored-questions/authored-questions.test.tsx`
- Modify: `apps/web/src/features/saved-library/model.ts`
- Modify: `apps/web/src/features/saved-library/model.test.ts`
- Modify: `apps/web/src/features/saved-library/saved-library.tsx`
- Modify: `apps/web/src/features/saved-library/saved-library.test.tsx`
- Modify: `apps/web/src/features/home-feed/feed-order.ts`
- Modify: `apps/web/src/features/home-feed/feed-order.test.ts`
- Modify: `apps/web/src/features/home-feed/following-post-list.tsx`
- Modify: `apps/web/src/features/home-feed/following-post-list.test.tsx`
- Modify: `apps/web/e2e/following-rail.e2e.ts`

- [ ] Add failing tests that starter/mock posts never appear in authored, saved, or following results even if old interaction state contains their IDs.

- [ ] Make authored posts use paged `listPostPage({ authorId: viewer.id })`. Guests see an account CTA and a separate legacy recovery list only.

- [ ] Make saved community posts come only from `listSavedPosts(viewer.id)`. Preserve saved jobs independently. Display legacy local records only under the recovery heading, never as server-saved activity.

- [ ] Remove the `MOCK_SOCIAL_ITEMS` default from `FollowingPostList`. Following membership applies only to server posts whose author ID is actually followed.

- [ ] Update following feed ordering tests and the Playwright rail scenario to use real component fixture data rather than mock social defaults.

- [ ] Run focused tests.

```bash
cd apps/web
npm test -- --run \
  src/features/authored-questions/authored-questions.test.tsx \
  src/features/saved-library/model.test.ts \
  src/features/saved-library/saved-library.test.tsx \
  src/features/home-feed/feed-order.test.ts \
  src/features/home-feed/following-post-list.test.tsx
npx playwright test e2e/following-rail.e2e.ts
```

- [ ] Commit Task 9.

```bash
git add apps/web/src/features/authored-questions/authored-questions.tsx \
  apps/web/src/features/authored-questions/authored-questions.test.tsx \
  apps/web/src/features/saved-library/model.ts \
  apps/web/src/features/saved-library/model.test.ts \
  apps/web/src/features/saved-library/saved-library.tsx \
  apps/web/src/features/saved-library/saved-library.test.tsx \
  apps/web/src/features/home-feed/feed-order.ts \
  apps/web/src/features/home-feed/feed-order.test.ts \
  apps/web/src/features/home-feed/following-post-list.tsx \
  apps/web/src/features/home-feed/following-post-list.test.tsx \
  apps/web/e2e/following-rail.e2e.ts
git commit -m "fix: keep account community views server backed"
```

---

### Task 10: Add a hermetic authenticated community browser journey

**Files:**

- Modify: `apps/web/e2e/fixtures/test-api.mjs`
- Modify: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/authenticated-community.e2e.ts`

- [ ] Extend the existing local fixture with only the minimal Supabase-compatible auth and REST endpoints used by this journey. Store fixture rows in process memory and reset them through a test-only fixture endpoint. Do not add a production test bypass.

Configure the test Next process with local public values:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8011
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-publishable-key
```

The fixture must validate the test bearer token and enforce ownership on mutation so the journey detects accidental anonymous or cross-user writes.

- [ ] Write the failing browser journey:

1. Seed an authenticated browser session through the local Supabase-compatible fixture.
2. Publish a post and verify it appears after page reload.
3. Open a second browser context with the same account and verify the post is present.
4. Edit the post and verify the change in the first context after refresh.
5. Add, edit, and delete a comment.
6. Search a word that is only present in this post and verify the RPC result.
7. Delete the post and verify it disappears in both contexts.

- [ ] Implement the fixture endpoints incrementally until the journey passes. Keep fixture response fields aligned with the explicit store column lists.

- [ ] Run all community browser tests.

```bash
cd apps/web
npx playwright test \
  e2e/authenticated-community.e2e.ts \
  e2e/post-detail.e2e.ts \
  e2e/following-rail.e2e.ts
```

- [ ] Commit Task 10.

```bash
git add apps/web/e2e/fixtures/test-api.mjs \
  apps/web/playwright.config.ts \
  apps/web/e2e/authenticated-community.e2e.ts
git commit -m "test: cover durable authenticated community flows"
```

---

### Task 11: Add release smoke checks and complete documentation

**Files:**

- Create: `apps/web/scripts/smoke-public-deployment.mjs`
- Modify: `apps/web/package.json`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-23-authenticated-community-completion-design.md`

- [ ] Add a small smoke script accepting `PUBLIC_SITE_URL` and checking, without cookies:

- `/` returns 200 and HTML;
- `/privacy` returns 200;
- `/search?q=react` returns 200;
- a missing post route returns the expected safe 404 rather than a server error;
- responses are not a Vercel `DEPLOYMENT_NOT_FOUND` or authentication-protection page.

Expose it as:

```json
"smoke:public": "node scripts/smoke-public-deployment.mjs"
```

- [ ] Add script tests by factoring response classification into exported pure helpers if needed. Run against the local Playwright server during verification and the public URL after deployment.

- [ ] Update README persistence wording: real community records require an account and are Supabase-backed; only a resumable session draft and unreconciled legacy recovery data remain browser-local.

- [ ] Add an implementation-status appendix to the approved design, recording completed scope and explicitly deferred work: moderation console/blocking, attachments, realtime, direct messages, and profile matching.

- [ ] Run focused smoke/lint checks.

```bash
cd apps/web
npm run lint
PUBLIC_SITE_URL=http://127.0.0.1:3102 npm run smoke:public
```

- [ ] Commit Task 11.

```bash
git add apps/web/scripts/smoke-public-deployment.mjs \
  apps/web/package.json \
  README.md \
  docs/superpowers/specs/2026-07-23-authenticated-community-completion-design.md
git commit -m "docs: define community persistence and release checks"
```

---

### Task 12: Full verification, review, integration, and production release audit

**Files:**

- Modify only files required by verified defects found during this task.

- [ ] Run formatting/type/lint/build verification.

```bash
cd apps/web
npm run lint
npm run build
```

- [ ] Run all web unit and browser suites.

```bash
cd apps/web
npm test -- --run
npm run test:e2e
npm run test:performance
```

- [ ] Run all backend tests and migration offline generation.

```bash
cd ../../..
/root/work/ejik-fit/.venv/bin/pytest packages/backend/tests -q
```

- [ ] Run dependency security checks without applying automated breaking changes.

```bash
cd apps/web
npm audit --audit-level=high
```

- [ ] Inspect the complete branch diff and verify there are no placeholders, debug logs, leaked secrets, widened RLS policies, or unrelated changes.

```bash
git status --short
git diff --check main...HEAD
git diff --stat main...HEAD
git log --oneline main..HEAD
```

- [ ] Request a code review using `superpowers:requesting-code-review`. Address only evidence-backed findings, rerunning the affected test first and the full relevant suite afterward.

- [ ] Rebase or fast-forward integrate the verified branch into local `main` without overwriting the user's dirty files. Re-run the smoke subset on integrated `main`.

- [ ] Push `main` to `origin` and monitor the resulting GitHub Actions run until completion.

- [ ] Resolve the canonical public deployment URL from repository/deployment configuration. Run:

```bash
cd apps/web
PUBLIC_SITE_URL=https://<canonical-host> npm run smoke:public
```

Expected: all public requests pass without authentication or `DEPLOYMENT_NOT_FOUND`.

- [ ] If deployment protection or alias configuration still blocks anonymous access and no authorized Vercel credential is available, do not bypass it. Report the exact URL/status and the one external setting the owner must change. The implementation may be code-complete, but the production-release objective remains explicitly blocked.

- [ ] Final handoff must include:

- what is now stored in Supabase versus session/local storage;
- how legacy migration behaves on partial failure;
- completed user-visible functionality;
- exact verification commands and results;
- pushed commit and CI status;
- public smoke result or precise external blocker.

