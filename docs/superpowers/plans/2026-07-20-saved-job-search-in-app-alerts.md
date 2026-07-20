# Saved Job Search In-App Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users save job filters in a private RLS table and see newly confirmed matching jobs inside Ejik Fit.

**Architecture:** Store each saved search as an owner-scoped Supabase row rather than extending the existing account JSON blob. The browser uses the authenticated Supabase client for CRUD, while a bounded Next route reuses the existing public postings API to evaluate up to ten enabled searches with partial-success semantics. The current notification menu and a new `/career/alerts` manager consume the same saved-search and evaluation hooks.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/PostgREST/RLS, FastAPI read API, SQLAlchemy 2, Alembic, Vitest/Testing Library, Pytest.

## Global Constraints

- Keep the existing framework, API client, AppShell, typography, and light-mode design system.
- In-app alerts only; do not add email, browser push, OS push, or a background notification worker.
- Require Supabase login; do not add localStorage saved searches or guest-to-account merge logic.
- Store at most 10 searches per user and reject a search with no query, category, or career filter.
- Use only real `/api/postings` results and `first_seen_at`; never create fixture notifications in production.
- Say `이직핏이 새로 확인` rather than claiming the company posted at a time Ejik Fit cannot prove.
- Update `last_checked_at` only for enabled searches whose posting evaluation succeeded.
- Resuming a paused search sets its checkpoint to the resume time so paused-period jobs do not flood the menu.
- Keep CSS and static markup tests selective; focus tests on normalization, RLS, duplicate/limit rules, partial failure, and checkpoint preservation.
- Add no new runtime dependency.

---

### Task 1: Private Saved-Search Table and Production Migration Trigger

**Files:**
- Create: `packages/backend/alembic/versions/20260720_0017_user_saved_job_searches.py`
- Create: `packages/backend/tests/test_user_saved_job_search_security.py`
- Modify: `packages/backend/src/ejikfit/models.py`
- Modify: `.github/workflows/crawl.yml`

**Interfaces:**
- Consumes: Supabase `auth.users(id)`, the owner-policy pattern from `20260715_0013_user_career_states.py`.
- Produces: `user_saved_job_searches` with the exact columns consumed by `SavedJobSearchRow` in Task 2.

- [ ] **Step 1: Write the migration security test**

```python
from pathlib import Path


MIGRATION = (
    Path(__file__).parents[1]
    / "alembic"
    / "versions"
    / "20260720_0017_user_saved_job_searches.py"
)


def test_saved_job_search_migration_is_private_and_bounded() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert 'down_revision: str | None = "20260715_0016"' in sql
    assert '"user_saved_job_searches"' in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "REFERENCES auth.users(id)" in sql
    assert "ON DELETE CASCADE" in sql
    assert "TO authenticated" in sql
    assert "auth.uid() = user_id" in sql
    assert "WITH CHECK" in sql
    assert "uq_user_saved_job_search_filter" in sql
    assert "ck_user_saved_job_search_has_filter" in sql
    assert "ck_user_saved_job_search_category" in sql
    assert "ck_user_saved_job_search_career_type" in sql
```

- [ ] **Step 2: Run the focused test and confirm it fails because the migration does not exist**

Run:

```bash
.venv/bin/pytest packages/backend/tests/test_user_saved_job_search_security.py -q
```

Expected: `FileNotFoundError` for `20260720_0017_user_saved_job_searches.py`.

- [ ] **Step 3: Add the SQLAlchemy model**

Add `Boolean` to the SQLAlchemy imports and append:

```python
class UserSavedJobSearch(Base):
    __tablename__ = "user_saved_job_searches"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "query_key",
            "category",
            "career_type",
            name="uq_user_saved_job_search_filter",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(60))
    query_text: Mapped[str] = mapped_column(String(200), default="")
    query_key: Mapped[str] = mapped_column(String(200), default="")
    category: Mapped[str] = mapped_column(String(32), default="")
    career_type: Mapped[str] = mapped_column(String(32), default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
```

Do not add an ORM relationship to the cross-schema Supabase Auth table.

- [ ] **Step 4: Create the Alembic migration**

Create the table with:

```python
op.create_table(
    "user_saved_job_searches",
    sa.Column("id", sa.Uuid(), nullable=False),
    sa.Column("user_id", sa.Uuid(), nullable=False),
    sa.Column("name", sa.String(length=60), nullable=False),
    sa.Column(
        "query_text",
        sa.String(length=200),
        server_default=sa.text("''"),
        nullable=False,
    ),
    sa.Column(
        "query_key",
        sa.String(length=200),
        server_default=sa.text("''"),
        nullable=False,
    ),
    sa.Column(
        "category",
        sa.String(length=32),
        server_default=sa.text("''"),
        nullable=False,
    ),
    sa.Column(
        "career_type",
        sa.String(length=32),
        server_default=sa.text("''"),
        nullable=False,
    ),
    sa.Column("is_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
    sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    ),
    sa.Column(
        "updated_at",
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    ),
    sa.CheckConstraint(
        "query_key <> '' OR category <> '' OR career_type <> ''",
        name="ck_user_saved_job_search_has_filter",
    ),
    sa.CheckConstraint(
        "category IN ('', 'language', 'frontend', 'backend', 'infra', "
        "'data', 'ai', 'security', 'game', 'robotics', 'mobile', "
        "'design', 'embedded', 'qa')",
        name="ck_user_saved_job_search_category",
    ),
    sa.CheckConstraint(
        "career_type IN ('', 'new_comer', 'experienced', 'mixed')",
        name="ck_user_saved_job_search_career_type",
    ),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint(
        "user_id",
        "query_key",
        "category",
        "career_type",
        name="uq_user_saved_job_search_filter",
    ),
)
op.create_index(
    "ix_user_saved_job_searches_user_id",
    "user_saved_job_searches",
    ["user_id"],
)
```

For PostgreSQL, use the same conditional `DO $$` pattern as the account-state migration to:

```sql
ALTER TABLE user_saved_job_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_job_searches
  ADD CONSTRAINT fk_user_saved_job_searches_auth_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON user_saved_job_searches TO authenticated;
CREATE POLICY user_saved_job_searches_owner
  ON user_saved_job_searches
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Guard the foreign key, role, and `auth.uid()` exactly as in migration `0013` so offline SQL generation and local SQLite remain usable.

- [ ] **Step 5: Make migrations trigger the production schema-sync workflow**

Extend the existing push paths without changing scheduled crawling:

```yaml
on:
  push:
    branches:
      - main
    paths:
      - "packages/backend/src/ejikfit/seed_data.py"
      - "packages/backend/alembic/**"
```

The push path continues to run migration and seed only because `github.event_name == 'push'`.

- [ ] **Step 6: Run migration and model verification**

Run:

```bash
.venv/bin/pytest \
  packages/backend/tests/test_user_saved_job_search_security.py \
  packages/backend/tests/test_migration_offline.py -q
.venv/bin/alembic -c packages/backend/alembic.ini upgrade head --sql >/tmp/ejikfit-saved-search-migration.sql
```

Expected: both tests pass and offline SQL generation exits `0`.

- [ ] **Step 7: Commit the database boundary**

```bash
git add \
  .github/workflows/crawl.yml \
  packages/backend/alembic/versions/20260720_0017_user_saved_job_searches.py \
  packages/backend/src/ejikfit/models.py \
  packages/backend/tests/test_user_saved_job_search_security.py
git commit -m "feat(data): add private saved job searches"
```

---

### Task 2: Saved-Search Domain Model

**Files:**
- Create: `apps/web/src/lib/saved-job-searches.ts`
- Create: `apps/web/src/lib/saved-job-searches.test.ts`

**Interfaces:**
- Consumes: `SkillCategory`, `normalizeSkillCategory`, and `skillCategoryLabel` from `@/lib/skill-categories`.
- Produces:
  - `SavedJobSearchFilters`
  - `SavedJobSearch`
  - `SavedJobSearchRow`
  - `normalizeSavedJobSearchFilters(value)`
  - `hasSavedJobSearchFilter(filters)`
  - `savedJobSearchQueryKey(filters)`
  - `savedJobSearchFilterKey(filters)`
  - `defaultSavedJobSearchName(filters)`
  - `savedJobSearchFromRow(row)`

- [ ] **Step 1: Write focused normalization tests**

```typescript
import { describe, expect, it } from "vitest";

import {
  defaultSavedJobSearchName,
  hasSavedJobSearchFilter,
  normalizeSavedJobSearchFilters,
  savedJobSearchFilterKey,
  savedJobSearchQueryKey,
} from "./saved-job-searches";

describe("saved job search model", () => {
  it("normalizes supported filters into one stable duplicate key", () => {
    const filters = normalizeSavedJobSearchFilters({
      query: "  Python   Backend ",
      category: "backend",
      careerType: "experienced",
    });

    expect(filters).toEqual({
      query: "Python Backend",
      category: "backend",
      careerType: "experienced",
    });
    expect(savedJobSearchFilterKey(filters)).toBe(
      "python backend|backend|experienced",
    );
    expect(savedJobSearchQueryKey(filters)).toBe("python backend");
    expect(defaultSavedJobSearchName(filters)).toBe(
      "Python Backend · 백엔드 · 경력",
    );
  });

  it("drops unsupported enums and rejects a filterless search", () => {
    const filters = normalizeSavedJobSearchFilters({
      query: " ",
      category: "not-real",
      careerType: "senior-only",
    });

    expect(filters).toEqual({ query: "", category: "", careerType: "" });
    expect(hasSavedJobSearchFilter(filters)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm missing-module failure**

Run:

```bash
cd apps/web
npm test -- --run src/lib/saved-job-searches.test.ts
```

Expected: FAIL because `saved-job-searches.ts` does not exist.

- [ ] **Step 3: Implement the domain types and pure functions**

Use these exact public shapes:

```typescript
import {
  normalizeSkillCategory,
  skillCategoryLabel,
  type SkillCategory,
} from "./skill-categories";

export const MAX_SAVED_JOB_SEARCHES = 10;
export const MAX_SAVED_JOB_SEARCH_NAME_LENGTH = 60;
export const MAX_SAVED_JOB_SEARCH_QUERY_LENGTH = 200;

export type SavedJobSearchCareerType =
  | ""
  | "new_comer"
  | "experienced"
  | "mixed";

export type SavedJobSearchFilters = {
  query: string;
  category: SkillCategory;
  careerType: SavedJobSearchCareerType;
};

export type SavedJobSearch = SavedJobSearchFilters & {
  id: string;
  userId: string;
  name: string;
  filterKey: string;
  enabled: boolean;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedJobSearchRow = {
  id: unknown;
  user_id: unknown;
  name: unknown;
  query_text: unknown;
  query_key: unknown;
  category: unknown;
  career_type: unknown;
  is_enabled: unknown;
  last_checked_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};
```

Normalize query whitespace, cap it at 200 characters, and accept career values only from:

```typescript
const CAREER_TYPES = new Set<SavedJobSearchCareerType>([
  "",
  "new_comer",
  "experienced",
  "mixed",
]);
```

`savedJobSearchQueryKey` lowercases the normalized query without parsing the
composite key. `savedJobSearchFilterKey` joins that query key, category, and
career type with `|` only for duplicate comparison.

Generate names from non-empty parts using:

```typescript
const CAREER_LABELS: Record<Exclude<SavedJobSearchCareerType, "">, string> = {
  new_comer: "신입",
  experienced: "경력",
  mixed: "신입·경력",
};

export function defaultSavedJobSearchName(filters: SavedJobSearchFilters) {
  const parts = [
    filters.query,
    filters.category ? skillCategoryLabel(filters.category) : "",
    filters.careerType ? CAREER_LABELS[filters.careerType] : "",
  ].filter(Boolean);
  return parts.join(" · ").slice(0, MAX_SAVED_JOB_SEARCH_NAME_LENGTH);
}
```

`savedJobSearchFromRow` must validate all required scalar fields and return
`null` for malformed PostgREST rows rather than leaking `unknown` values into UI code.

- [ ] **Step 4: Run the focused model test**

Run:

```bash
cd apps/web
npm test -- --run src/lib/saved-job-searches.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the domain boundary**

```bash
git add apps/web/src/lib/saved-job-searches.ts apps/web/src/lib/saved-job-searches.test.ts
git commit -m "feat(web): model saved job searches"
```

---

### Task 3: Supabase CRUD Store and Hook

**Files:**
- Create: `apps/web/src/features/saved-searches/saved-job-search-store.ts`
- Create: `apps/web/src/features/saved-searches/use-saved-job-searches.ts`
- Create: `apps/web/src/features/saved-searches/use-saved-job-searches.test.tsx`

**Interfaces:**
- Consumes: `AuthViewer`, `createBrowserSupabaseClient`, and Task 2 domain functions.
- Produces:

```typescript
export type SavedJobSearchesState =
  | { status: "idle" | "loading"; items: SavedJobSearch[]; error: "" }
  | { status: "ready"; items: SavedJobSearch[]; error: "" }
  | { status: "error"; items: SavedJobSearch[]; error: string };

export type CreateSavedJobSearchResult =
  | { status: "created"; item: SavedJobSearch }
  | { status: "duplicate"; item: SavedJobSearch }
  | { status: "limit" }
  | { status: "error" };
```

The hook exposes `reload`, `create`, `rename`, `setEnabled`, `remove`, and
`markChecked`.

Use this public return shape:

```typescript
export type SavedJobSearchesController = {
  state: SavedJobSearchesState;
  reload(): Promise<void>;
  create(
    filters: SavedJobSearchFilters,
    name?: string,
  ): Promise<CreateSavedJobSearchResult>;
  rename(id: string, name: string): Promise<boolean>;
  setEnabled(id: string, enabled: boolean): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  markChecked(ids: string[], evaluatedAt: string): Promise<boolean>;
};
```

- [ ] **Step 1: Write hook tests with an injected fake store**

```typescript
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SavedJobSearch } from "@/lib/saved-job-searches";

import type { SavedJobSearchStore } from "./saved-job-search-store";
import { useSavedJobSearches } from "./use-saved-job-searches";

const viewer = { id: "user-1", email: "dev@example.com" };
const existing: SavedJobSearch = {
  id: "search-1",
  userId: viewer.id,
  name: "Python 백엔드",
  query: "Python",
  category: "backend",
  careerType: "",
  filterKey: "python|backend|",
  enabled: true,
  lastCheckedAt: "2026-07-20T00:00:00.000Z",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

describe("useSavedJobSearches", () => {
  it("returns the existing item instead of inserting a duplicate", async () => {
    const store: SavedJobSearchStore = {
      list: vi.fn().mockResolvedValue([existing]),
      insert: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      markChecked: vi.fn(),
    };
    const { result } = renderHook(() =>
      useSavedJobSearches(viewer, store),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let outcome;
    await act(async () => {
      outcome = await result.current.create(
        { query: " Python ", category: "backend", careerType: "" },
        "다른 이름",
      );
    });

    expect(outcome).toEqual({ status: "duplicate", item: existing });
    expect(store.insert).not.toHaveBeenCalled();
  });

  it("rolls an optimistic enable change back when the store fails", async () => {
    const store: SavedJobSearchStore = {
      list: vi.fn().mockResolvedValue([existing]),
      insert: vi.fn(),
      update: vi.fn().mockRejectedValue(new Error("offline")),
      remove: vi.fn(),
      markChecked: vi.fn(),
    };
    const { result } = renderHook(() =>
      useSavedJobSearches(viewer, store),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(() => result.current.setEnabled(existing.id, false));

    expect(result.current.state.items[0]?.enabled).toBe(true);
    expect(result.current.state.status).toBe("error");
  });
});
```

- [ ] **Step 2: Run the hook test and confirm missing-module failure**

Run:

```bash
cd apps/web
npm test -- --run src/features/saved-searches/use-saved-job-searches.test.tsx
```

Expected: FAIL because the store and hook do not exist.

- [ ] **Step 3: Implement the narrow Supabase store**

Define:

```typescript
export type SavedJobSearchStore = {
  list(userId: string): Promise<SavedJobSearch[]>;
  insert(
    userId: string,
    filters: SavedJobSearchFilters,
    name: string,
    now: string,
  ): Promise<SavedJobSearch>;
  update(
    userId: string,
    id: string,
    patch: Partial<Pick<SavedJobSearch, "name" | "enabled" | "lastCheckedAt">>,
  ): Promise<SavedJobSearch>;
  remove(userId: string, id: string): Promise<void>;
  markChecked(userId: string, ids: string[], evaluatedAt: string): Promise<void>;
};
```

`createSupabaseSavedJobSearchStore(client)` must:

- query `user_saved_job_searches`
- always add `.eq("user_id", userId)` for update and delete operations
- order list results by `updated_at desc`
- create IDs with `crypto.randomUUID()`
- write both display `query_text` and normalized `query_key`
- parse every returned row through `savedJobSearchFromRow`
- throw when Supabase returns an error or a malformed row
- bulk-update successful checkpoint IDs with `.in("id", ids)`
- set `updated_at` on every mutation

The insert payload is:

```typescript
{
  id: crypto.randomUUID(),
  user_id: userId,
  name,
  query_text: filters.query,
  query_key: savedJobSearchQueryKey(filters),
  category: filters.category,
  career_type: filters.careerType,
  is_enabled: true,
  last_checked_at: now,
  created_at: now,
  updated_at: now,
}
```

- [ ] **Step 4: Implement the hook with bounded and optimistic mutations**

The hook must:

- return `idle` with no store calls when `viewer` is `null`
- load rows when the viewer changes
- block a duplicate by `filterKey`
- return `limit` at 10 rows
- trim and cap the name at 60 characters
- optimistically rename, pause, resume, and remove
- on resume, send both `enabled: true` and `lastCheckedAt: new Date().toISOString()`
- restore the previous item array when a mutation fails
- update local checkpoints only after `markChecked` succeeds and leave them
  unchanged when it fails

Create the production store lazily from `createBrowserSupabaseClient()`. Keep
the optional injected store parameter solely for deterministic tests.

- [ ] **Step 5: Run hook and domain tests**

Run:

```bash
cd apps/web
npm test -- --run \
  src/lib/saved-job-searches.test.ts \
  src/features/saved-searches/use-saved-job-searches.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the authenticated data access**

```bash
git add apps/web/src/features/saved-searches
git commit -m "feat(web): sync saved job searches"
```

---

### Task 4: Save the Current Jobs Filter

**Files:**
- Create: `apps/web/src/features/saved-searches/saved-search-composer.tsx`
- Create: `apps/web/src/features/saved-searches/saved-search-composer.module.css`
- Create: `apps/web/src/features/saved-searches/saved-search-composer.test.tsx`
- Modify: `apps/web/src/features/jobs/job-list.tsx`
- Modify: `apps/web/src/features/jobs/job-list.module.css`
- Modify: `apps/web/src/features/jobs/job-list.test.tsx`
- Modify: `apps/web/src/app/jobs/page.tsx`

**Interfaces:**
- Consumes: `JobListFilters`, `useAuthViewer`, `useSavedJobSearches`, and Task 2 naming helpers.
- Produces: `SavedSearchComposer({ filters, openOnReady })`.

- [ ] **Step 1: Write the login continuation and save behavior tests**

Mock `useAuthViewer` and `useSavedJobSearches`, then assert:

```typescript
expect(
  screen.getByRole("link", { name: "이 검색 저장" }),
).toHaveAttribute(
  "href",
  "/login?next=%2Fjobs%3Fq%3DPython%26category%3Dbackend%26save_search%3D1",
);
```

For a signed-in viewer:

```typescript
fireEvent.click(screen.getByRole("button", { name: "이 검색 저장" }));
expect(screen.getByLabelText("저장 검색 이름")).toHaveValue(
  "Python · 백엔드",
);
fireEvent.click(screen.getByRole("button", { name: "검색 조건 저장" }));
await waitFor(() =>
  expect(create).toHaveBeenCalledWith(
    { query: "Python", category: "backend", careerType: "" },
    "Python · 백엔드",
  ),
);
```

Also test `duplicate`, `limit`, and filterless disabled states in this component
file rather than adding more JobList-wide tests.

- [ ] **Step 2: Run the component test and confirm missing-module failure**

Run:

```bash
cd apps/web
npm test -- --run src/features/saved-searches/saved-search-composer.test.tsx
```

Expected: FAIL because `SavedSearchComposer` does not exist.

- [ ] **Step 3: Implement the compact inline composer**

The component must:

- render beside the existing filter actions, not as a full-screen modal
- disable saving when all three filters are empty
- show a login link while `ready && !viewer`
- preserve `q`, `category`, and `career_type` in the login `next`
- add only `save_search=1` as the continuation marker
- open automatically after login when `openOnReady` is true
- use a 60-character controlled name input
- map mutation results to these messages:

```typescript
const RESULT_MESSAGES = {
  created: "검색 조건을 저장했습니다.",
  duplicate: "이미 같은 조건을 저장했습니다.",
  limit: "저장 검색은 최대 10개까지 만들 수 있습니다.",
  error: "검색 조건을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
} as const;
```

On success, include a `/career/alerts` link.

- [ ] **Step 4: Wire the continuation flag through the jobs page**

In `apps/web/src/app/jobs/page.tsx`, read:

```typescript
const saveSearchRequested = first(params.save_search) === "1";
```

Pass it to `JobList`, add `saveSearchRequested?: boolean` to `JobListProps`,
and render:

```tsx
<SavedSearchComposer
  filters={filters}
  openOnReady={saveSearchRequested}
/>
```

Do not include `save_search` in pagination, retry, or reset URLs; it is a
one-time continuation marker.

- [ ] **Step 5: Add restrained responsive styles**

Use the existing 44px touch target, `var(--color-line)`,
`var(--color-brand-subtle)`, and `var(--color-accent-strong)`. Keep the form
inside the filter panel and stack its input/actions below 720px. Do not add a
shadow or gradient.

- [ ] **Step 6: Run focused jobs and composer tests**

Run:

```bash
cd apps/web
npm test -- --run \
  src/features/saved-searches/saved-search-composer.test.tsx \
  src/features/jobs/job-list.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the save flow**

```bash
git add \
  apps/web/src/app/jobs/page.tsx \
  apps/web/src/features/jobs/job-list.tsx \
  apps/web/src/features/jobs/job-list.module.css \
  apps/web/src/features/jobs/job-list.test.tsx \
  apps/web/src/features/saved-searches/saved-search-composer.tsx \
  apps/web/src/features/saved-searches/saved-search-composer.module.css \
  apps/web/src/features/saved-searches/saved-search-composer.test.tsx
git commit -m "feat(web): save job search filters"
```

---

### Task 5: Bounded Saved-Search Evaluation

**Files:**
- Create: `apps/web/src/lib/saved-search-notifications.ts`
- Create: `apps/web/src/lib/saved-search-notifications.test.ts`
- Create: `apps/web/src/app/notifications/saved-search-jobs/route.ts`
- Create: `apps/web/src/app/notifications/saved-search-jobs/route.test.ts`
- Create: `apps/web/src/features/saved-searches/use-saved-search-evaluation.ts`
- Create: `apps/web/src/features/saved-searches/use-saved-search-evaluation.test.tsx`

**Interfaces:**
- Consumes: existing `getPostings()` and `PostingSummary`.
- Produces:

```typescript
export type SavedSearchEvaluationGroup =
  | {
      searchId: string;
      status: "ready";
      total: number;
      items: PostingSummary[];
    }
  | {
      searchId: string;
      status: "error";
      total: null;
      items: [];
    };

export type SavedSearchEvaluationResponse = {
  evaluatedAt: string;
  groups: SavedSearchEvaluationGroup[];
};

export type SavedSearchEvaluationState =
  | { status: "idle"; groups: []; error: "" }
  | {
      status: "loading";
      groups: SavedSearchEvaluationGroup[];
      error: "";
    }
  | { status: "ready"; groups: SavedSearchEvaluationGroup[]; error: "" }
  | {
      status: "partial";
      groups: SavedSearchEvaluationGroup[];
      error: string;
    }
  | { status: "error"; groups: []; error: string };
```

- [ ] **Step 1: Write request and aggregation tests**

Test the pure notification helper:

```typescript
expect(
  flattenSavedSearchNotifications(groups, searches, 5).map((item) => item.job.id),
).toEqual(["newest-job", "shared-job"]);
```

The fixture must put `shared-job` in two groups and assert it appears once
with both saved-search names.

Test the route with two valid rules where one `getPostings` call resolves and
one rejects:

```typescript
expect(response.status).toBe(200);
expect(body.groups).toEqual([
  expect.objectContaining({ searchId: "search-1", status: "ready", total: 3 }),
  { searchId: "search-2", status: "error", total: null, items: [] },
]);
```

Also assert malformed dates, unsupported enums, duplicate IDs, and 11 rules
return `400`.

Test the hook with an injected fetch function and `markChecked` spy. A
partial response containing one ready enabled search, one error, and one
ready paused search must:

```typescript
expect(result.current.state.groups).toEqual(response.groups);
expect(markChecked).toHaveBeenCalledWith(
  ["enabled-ready"],
  response.evaluatedAt,
);
```

The paused search is included only when the hook receives
`{ includePaused: true }`. Re-rendering after the local checkpoint update
must not trigger a second fetch.

- [ ] **Step 2: Run the route tests and confirm missing-module failure**

Run:

```bash
cd apps/web
npm test -- --run \
  src/lib/saved-search-notifications.test.ts \
  src/app/notifications/saved-search-jobs/route.test.ts \
  src/features/saved-searches/use-saved-search-evaluation.test.tsx
```

Expected: FAIL because the contract, route, and hook do not exist.

- [ ] **Step 3: Implement strict request normalization**

Accept:

```typescript
type SavedSearchEvaluationRequest = {
  searches: Array<{
    id: string;
    query: string;
    category: string;
    careerType: string;
    lastCheckedAt: string;
  }>;
};
```

Validation rules:

- one to ten searches
- unique non-empty IDs up to 100 characters
- query up to 200 characters
- supported category and career enum only
- finite ISO date no more than five minutes in the future
- at least one non-empty filter

Return Korean `400` JSON for invalid input.

- [ ] **Step 4: Implement partial-success evaluation**

Capture one `evaluatedAt = new Date().toISOString()` before starting requests.
For each rule call:

```typescript
getPostings({
  ...(search.query ? { q: search.query } : {}),
  ...(search.category ? { category: search.category } : {}),
  ...(search.careerType ? { career_type: search.careerType } : {}),
  limit: 20,
});
```

Filter:

```typescript
const checkpoint = Date.parse(search.lastCheckedAt);
const items = postings.items
  .filter((posting) => {
    const discoveredAt = posting.first_seen_at
      ? Date.parse(posting.first_seen_at)
      : Number.NaN;
    return Number.isFinite(discoveredAt) && discoveredAt > checkpoint;
  })
  .slice(0, 5);
```

Use `Promise.allSettled`; a backend failure becomes an error group and does
not turn the whole request into `502`. Set `Cache-Control: no-store`.

- [ ] **Step 5: Implement shared dedupe and the evaluation hook**

`flattenSavedSearchNotifications` must:

- combine only ready groups
- dedupe by posting ID
- retain all matching saved-search IDs and names
- sort descending by `first_seen_at`
- cap the flattened result at the requested limit

`useSavedSearchEvaluation(
  searches,
  loadStatus,
  markChecked,
  options?: {
    includePaused?: boolean;
    fetcher?: typeof fetch;
  },
)` must:

- evaluate only enabled searches by default
- evaluate enabled and paused searches when `includePaused` is true so the
  manager can show a current result total for every saved rule
- run once for each signature of ID/filter/enabled values
- deliberately exclude `lastCheckedAt` from the signature so marking a
  checkpoint cannot trigger a fetch loop and erase just-rendered results
- return `partial` and retain successful groups when only some rules fail;
  return `error` only when the request fails or no rule succeeds
- call `markChecked(readyEnabledSearchIds, evaluatedAt)` only after ready
  groups are stored in state; never advance a paused search checkpoint even
  when `includePaused` is true
- expose `refresh()` for an explicit retry
- abort fetches on unmount

Return `{ state, refresh }`, using `SavedSearchEvaluationState`. The optional
`fetcher` exists only for deterministic tests; production defaults to
`window.fetch`.

- [ ] **Step 6: Run the focused notification tests**

Run:

```bash
cd apps/web
npm test -- --run \
  src/lib/saved-search-notifications.test.ts \
  src/app/notifications/saved-search-jobs/route.test.ts \
  src/features/saved-searches/use-saved-search-evaluation.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the evaluation boundary**

```bash
git add \
  apps/web/src/app/notifications/saved-search-jobs \
  apps/web/src/features/saved-searches/use-saved-search-evaluation.ts \
  apps/web/src/features/saved-searches/use-saved-search-evaluation.test.tsx \
  apps/web/src/lib/saved-search-notifications.ts \
  apps/web/src/lib/saved-search-notifications.test.ts
git commit -m "feat(web): evaluate saved search alerts"
```

---

### Task 6: Saved-Search Management Page

**Files:**
- Create: `apps/web/src/app/career/alerts/page.tsx`
- Create: `apps/web/src/app/career/alerts/page.test.tsx`
- Create: `apps/web/src/features/saved-searches/saved-search-manager.tsx`
- Create: `apps/web/src/features/saved-searches/saved-search-manager.module.css`
- Create: `apps/web/src/features/saved-searches/saved-search-manager.test.tsx`

**Interfaces:**
- Consumes: `useAuthViewer`, `useSavedJobSearches`, `useSavedSearchEvaluation`.
- Produces: `/career/alerts` with rename, pause/resume, delete, retry, and job links.

- [ ] **Step 1: Write manager interaction tests**

Mock the three hooks and verify:

```typescript
expect(screen.getByText("Python 백엔드")).toBeInTheDocument();
expect(screen.getByText("현재 공식 공고 23건")).toBeInTheDocument();
expect(screen.getByText("새로 확인 2건")).toBeInTheDocument();
expect(screen.getByRole("link", { name: "공고 보기" })).toHaveAttribute(
  "href",
  "/jobs?q=Python&category=backend",
);
```

Then click `일시 중지`, `이름 수정`, and the two-step `삭제` confirmation and
assert the corresponding hook methods receive the saved-search ID.

Add separate tests for:

- signed-out login CTA
- zero saved searches
- list-load error with retry
- evaluation partial error that preserves successful rows

- [ ] **Step 2: Run the manager test and confirm missing-module failure**

Run:

```bash
cd apps/web
npm test -- --run src/features/saved-searches/saved-search-manager.test.tsx
```

Expected: FAIL because the manager does not exist.

- [ ] **Step 3: Implement the manager**

The top-level state order is:

1. auth loading
2. signed-out login CTA
3. saved-search loading
4. saved-search error with `reload`
5. empty state linking to `/jobs`
6. compact row list

Each row renders:

- name
- active/paused text badge
- non-empty filter chips
- current total from the matching ready evaluation group
- session new count from that group
- formatted `lastCheckedAt`
- generated jobs URL
- rename form
- pause/resume button
- two-click delete button

Call the evaluation hook with `{ includePaused: true }`. An enabled row may
show both its current total and `새로 확인 N건`. A paused row may show its
current total, but replace the new-count label with `일시 중지` so a
co-occurring result is never presented as an active alert. Its `공고 보기`
link remains available.

When `setEnabled(id, true)` is called, rely on Task 3 to set the resume
checkpoint. Do not independently mutate `lastCheckedAt` in the component.

- [ ] **Step 4: Add page metadata and route test**

Use:

```typescript
export const metadata: Metadata = {
  title: "공고 알림",
  description: "저장한 공고 검색 조건과 새로 확인된 공식 공고를 관리합니다.",
  robots: { index: false, follow: false },
};
```

The page test should assert it renders `SavedSearchManager`; do not duplicate
all manager behavior in the route test.

- [ ] **Step 5: Style the page at existing service density**

Use a 32px desktop page title, 16–18px section titles, 13–14px body text,
10–14px radii, one main list panel, and row dividers. Below 720px, stack row
metadata and keep every action at least 44px high. Do not add gradients,
glass effects, or a card per metric.

- [ ] **Step 6: Run manager and page tests**

Run:

```bash
cd apps/web
npm test -- --run \
  src/features/saved-searches/saved-search-manager.test.tsx \
  src/app/career/alerts/page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the management page**

```bash
git add \
  apps/web/src/app/career/alerts \
  apps/web/src/features/saved-searches/saved-search-manager.tsx \
  apps/web/src/features/saved-searches/saved-search-manager.module.css \
  apps/web/src/features/saved-searches/saved-search-manager.test.tsx
git commit -m "feat(web): manage saved search alerts"
```

---

### Task 7: Notification Menu, Account Navigation, and Privacy Copy

**Files:**
- Modify: `apps/web/src/components/app-shell/app-shell.tsx`
- Modify: `apps/web/src/features/notifications/activity-notification-center.tsx`
- Modify: `apps/web/src/features/notifications/activity-notification-center.module.css`
- Modify: `apps/web/src/features/notifications/activity-notification-center.test.tsx`
- Modify: `apps/web/src/features/account/account-overview.tsx`
- Modify: `apps/web/src/features/account/account-overview.test.tsx`
- Modify: `apps/web/src/app/privacy/page.tsx`

**Interfaces:**
- Consumes: `viewer` already owned by AppShell, saved-search hooks, and Task 5 flattened notifications.
- Produces: saved-search items at the top of the existing bell menu and links to `/career/alerts`.

- [ ] **Step 1: Extend the notification behavior test**

Mock saved-search hooks and add a test that renders:

```text
저장 검색 · Python 백엔드
NAVER · Backend Engineer
이직핏이 새로 확인
```

Assert:

```typescript
expect(screen.getByText("저장 검색 · Python 백엔드")).toBeInTheDocument();
expect(
  screen.getByText("NAVER · Backend Engineer").closest("a"),
).toHaveAttribute("href", "/jobs/new-job");
expect(screen.getByRole("link", { name: "공고 알림에서 더 보기" }))
  .toHaveAttribute("href", "/career/alerts");
```

Add a partial-failure test that keeps a successful alert visible and shows a
short retry status. Keep the existing followed-company, saved-job, stage,
and owned-skill tests unchanged.

- [ ] **Step 2: Run the activity notification test and confirm the new assertions fail**

Run:

```bash
cd apps/web
npm test -- --run \
  src/features/notifications/activity-notification-center.test.tsx \
  src/features/account/account-overview.test.tsx
```

Expected: FAIL because the saved-search section and account link are absent.

- [ ] **Step 3: Compose saved-search notifications into the existing center**

Pass the existing AppShell `viewer` into:

```tsx
<ActivityNotificationCenter
  onNavigate={closeUtilityMenus}
  viewer={viewer}
/>
```

Inside the center:

- call `useSavedJobSearches(viewer)`
- call `useSavedSearchEvaluation(...)` with the default
  `includePaused: false`
- flatten at most five new jobs
- include saved-search count/loading in the existing `hasActivity` decision
- render new jobs before application/saved/company/skill activity
- show no invented empty notification
- link overflow and management to `/career/alerts`

Use `CompanyMark` for the company identity and retain keyboard-accessible
full-row links.

- [ ] **Step 4: Add account and user-menu entry points**

Add `공고 알림` to the user menu between `저장 보관함` and `관심 기업`.

Add an account summary item:

```typescript
{
  href: "/career/alerts",
  icon: Bell,
  label: "공고 알림",
  value: viewer ? "계정 저장" : "로그인 필요",
  description: "저장 검색과 새 공고",
}
```

Do not query the saved-search table only to display a count on the account
overview; the manager page owns that data.

- [ ] **Step 5: Update privacy disclosure**

State that signed-in saved job searches, enabled status, and last successful
check time are stored in the private Supabase account table and removed when
the user deletes them. Keep community posts/reactions explicitly
browser-only.

- [ ] **Step 6: Run the focused integration tests**

Run:

```bash
cd apps/web
npm test -- --run \
  src/features/notifications/activity-notification-center.test.tsx \
  src/features/account/account-overview.test.tsx \
  src/features/saved-searches/saved-search-manager.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the navigation and notification integration**

```bash
git add \
  apps/web/src/app/privacy/page.tsx \
  apps/web/src/components/app-shell/app-shell.tsx \
  apps/web/src/features/account/account-overview.tsx \
  apps/web/src/features/account/account-overview.test.tsx \
  apps/web/src/features/notifications/activity-notification-center.tsx \
  apps/web/src/features/notifications/activity-notification-center.module.css \
  apps/web/src/features/notifications/activity-notification-center.test.tsx
git commit -m "feat(web): show saved search notifications"
```

---

### Task 8: Regression, Browser Verification, Push, and Production Migration

**Files:**
- Modify only files that fail the checks below; do not add broad test scaffolding.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified `main`, Vercel deployment, migrated production RLS table.

- [ ] **Step 1: Run the focused feature suite**

Run:

```bash
.venv/bin/pytest \
  packages/backend/tests/test_user_saved_job_search_security.py \
  packages/backend/tests/test_migration_offline.py -q

cd apps/web
npm test -- --run \
  src/lib/saved-job-searches.test.ts \
  src/lib/saved-search-notifications.test.ts \
  src/app/notifications/saved-search-jobs/route.test.ts \
  src/features/saved-searches/use-saved-job-searches.test.tsx \
  src/features/saved-searches/use-saved-search-evaluation.test.tsx \
  src/features/saved-searches/saved-search-composer.test.tsx \
  src/features/saved-searches/saved-search-manager.test.tsx \
  src/features/notifications/activity-notification-center.test.tsx \
  src/features/account/account-overview.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run one final repository regression**

Run:

```bash
cd /root/work/ejik-fit
.venv/bin/pytest packages/backend/tests -q
cd apps/web
npm test -- --run
npm run lint
npm run build
```

Expected: backend and web suites pass, TypeScript exits `0`, and the
production build completes. Do not create extra tests for static CSS if these
checks pass.

- [ ] **Step 3: Inspect the actual local browser**

Run the production build or dev server and verify at 1440px and a Pixel 7
viewport:

1. `/jobs?q=Python&category=backend`
2. logged-out `이 검색 저장` link preserves the URL
3. `/career/alerts` signed-out state
4. bell menu with existing local activity
5. mobile bottom navigation and inline save form spacing

Record console errors and page errors; expected count is zero. Authentication
and RLS writes require the production migration and a real magic-link login,
so do not fabricate a logged-in browser fixture and report it as production.

- [ ] **Step 4: Check diff and protected untracked files**

Run:

```bash
git diff --check
git status --short
```

Expected: only intended tracked changes plus the pre-existing protected
untracked `.agents/`, handoff files, and root `package-lock.json`.

- [ ] **Step 5: Push `main`**

```bash
git push origin main
```

Expected: the implementation commits push without force.

- [ ] **Step 6: Monitor CI, Vercel, and schema sync**

Because Task 1 adds `packages/backend/alembic/**` to the crawler push paths,
the push-triggered source workflow must:

1. install base backend dependencies
2. run `alembic upgrade head`
3. run `ejikfit seed-sources`
4. avoid a full scheduled crawl

Monitor both CI jobs and the schema-sync workflow to terminal status. If
GitHub returns a transient `503`, retain the queued run and retry status
inspection rather than creating duplicate runs.

- [ ] **Step 7: Verify production behavior**

After Vercel and migration success:

- `/jobs` and `/career/alerts` return `200`
- logged-out save action produces a safe same-origin login continuation
- `/career/alerts` shows the login-required state without console errors
- migration/catalog inspection confirms RLS is enabled with an authenticated
  owner-only policy, and an anonymous PostgREST request cannot read rows
- if two authenticated test sessions are already available, additionally
  confirm one user cannot read or mutate the other's row; do not create or
  impersonate production users solely for this check
- no service-role key appears in client bundles

Then update the task plan as complete and report the exact CI/deployment URLs
and verification results.
