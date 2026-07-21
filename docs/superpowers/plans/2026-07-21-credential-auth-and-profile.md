# Credential Auth and Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the community detail reading hierarchy and replace passwordless-only authentication with verified email/password signup, password recovery, and an editable nickname profile without losing guest career data.

**Architecture:** Keep Supabase Auth as the credential and session authority. Add a public-name-only `user_profiles` table protected by RLS, keep the existing account-state merge for guest-to-account migration, and split pure credential validation from the client auth UI. Deliver the visual correction, database contract, auth flow, and profile editor as independently reviewable commits.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Supabase Auth/SSR, PostgreSQL, SQLAlchemy 2, Alembic, Vitest/Testing Library, Playwright.

## Global Constraints

- Login identifier is the verified email; do not add a separate username or `@handle`.
- Passwords are 10–72 characters and contain at least one letter and one digit.
- Nicknames are trimmed, 2–20 characters, may be duplicated, and never expose the email.
- Guest career state remains usable and is merged into the authenticated account before the server becomes canonical.
- Do not persist passwords in app tables, logs, analytics, URL state, or browser storage.
- Keep Supabase errors generic in user-facing copy and preserve `safeAuthNextPath` for every redirect.
- Add automated tests only at validation, auth calls, RLS/migration, merge, and critical responsive boundaries; use browser inspection for pure visual tuning.
- Do not stage `.agents/`, handoff images/documents, or the root `package-lock.json`.

---

### Task 1: Correct community detail reading hierarchy

**Files:**
- Modify: `apps/web/src/features/home-feed/post-detail-view.tsx`
- Modify: `apps/web/src/features/home-feed/local-post-detail.tsx`
- Modify: `apps/web/src/app/posts/[id]/post-detail.module.css`
- Modify: `apps/web/src/app/posts/[id]/page.test.tsx`
- Modify: `apps/web/src/features/home-feed/local-post-detail.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/e2e/post-detail.e2e.ts`

**Interfaces:**
- Consumes: `MockPostDetail.paragraphs`, `CommunityPostFeedItem.title`, and `LocalCommunityPost.body`.
- Produces: a detail article whose header contains category, title, and author only; actual content remains in the `aria-label="글 본문"` region.

- [x] **Step 1: Add focused regression assertions**

In `page.test.tsx`, extend the mock detail test with the known feed preview and first real paragraph:

```tsx
expect(
  screen.queryByText(
    "지금 회사가 나쁘지는 않지만 비슷한 업무만 반복하고 있어 성장 속도가 느린 것 같습니다. 제안을 받은 팀은 기술적으로 매력적이지만 규모가 작아 고민이에요.",
  ),
).not.toBeInTheDocument();
expect(
  screen.getByText(
    "현재 팀에서는 익숙한 서비스의 유지보수 비중이 커졌습니다. 문제를 안정적으로 처리하는 법은 배웠지만, 설계 선택의 폭을 넓힐 기회가 줄었다고 느낍니다.",
  ),
).toBeInTheDocument();
```

In `local-post-detail.test.tsx`, assert the generic gray lead is absent:

```tsx
expect(
  screen.queryByText("이 브라우저에서 직접 작성하고 저장한 커뮤니티 글입니다."),
).not.toBeInTheDocument();
```

- [x] **Step 2: Run the focused tests and observe the duplicate-copy failure**

Run:

```bash
cd apps/web
npm test -- --run 'src/app/posts/[id]/page.test.tsx' src/features/home-feed/local-post-detail.test.tsx
```

Expected: both new absence assertions fail against the current lead paragraphs.

- [x] **Step 3: Remove the feed-only lead from both detail headers**

Delete `const lead = ...` and this element from `PostDetailView`:

```tsx
<p className={styles.lead}>{lead}</p>
```

Delete this element from `LocalPostDetail`:

```tsx
<p className={styles.lead}>
  이 브라우저에서 직접 작성하고 저장한 커뮤니티 글입니다.
</p>
```

Do not remove the article body, transparency badge, or sidebar disclosure.

- [x] **Step 4: Widen the reading column and make title wrapping content-driven**

Change the desktop grid and title rules in `post-detail.module.css` to:

```css
.workspace {
  grid-template-columns: minmax(0, 1fr) minmax(14rem, 16rem);
  gap: clamp(1.25rem, 2.5vw, 1.5rem);
}

.article {
  padding: clamp(1.5rem, 3vw, 2.25rem);
}

.hero h1 {
  max-width: none;
  margin-top: 0.875rem;
  font-size: clamp(1.625rem, 2.3vw, 1.875rem);
  letter-spacing: -0.035em;
  line-height: 1.3;
  word-break: keep-all;
  overflow-wrap: break-word;
  text-wrap: pretty;
}
```

Remove the now-unused `.lead` rule. Preserve the existing responsive media rules unless browser inspection shows a verified collision.

- [x] **Step 5: Add one desktop title geometry assertion to the existing E2E**

Inside the existing viewport loop, after the title becomes visible, add:

```ts
if (width === 1440) {
  const titleBox = await page
    .getByRole("heading", { exact: true, level: 1, name: postTitle })
    .boundingBox();
  const lineHeight = await page
    .getByRole("heading", { exact: true, level: 1, name: postTitle })
    .evaluate((element) => parseFloat(getComputedStyle(element).lineHeight));
  expect(titleBox?.height).toBeLessThanOrEqual(lineHeight * 1.1);
}
```

- [x] **Step 6: Clarify the related-job prompt and primary action**

For the no-skills job-card state, keep the explanatory sentence but add a visible
`내 기술 추가` link to `/career`. Use a compact flex row so the action remains available
without turning the notice into another large card. Strengthen the notice text to the
normal body color, and render `공고 상세` as the only solid brand-colored action with
white text. Keep `공식 원문` secondary and preserve the existing save action.

Add one focused assertion to the existing no-personalization HomeFeed test that the
`내 기술 추가` link resolves to `/career`. Use browser inspection rather than a CSS
snapshot for color and spacing.

- [x] **Step 7: Verify and commit the visual correction**

Run:

```bash
cd apps/web
npm test -- --run 'src/app/posts/[id]/page.test.tsx' src/features/home-feed/local-post-detail.test.tsx
npm test -- --run src/features/home-feed/home-feed.test.tsx
npx playwright test e2e/post-detail.e2e.ts
npm run lint
```

Expected: focused component tests, the three responsive detail journeys, and TypeScript pass.

Commit:

```bash
git add apps/web/src/features/home-feed/post-detail-view.tsx apps/web/src/features/home-feed/local-post-detail.tsx apps/web/src/features/home-feed/home-feed.tsx apps/web/src/features/home-feed/home-feed.module.css apps/web/src/features/home-feed/home-feed.test.tsx 'apps/web/src/app/posts/[id]/post-detail.module.css' 'apps/web/src/app/posts/[id]/page.test.tsx' apps/web/src/features/home-feed/local-post-detail.test.tsx apps/web/e2e/post-detail.e2e.ts
git commit -m "fix: simplify community post details"
git push origin main
```

---

### Task 2: Define credential and nickname validation

**Files:**
- Create: `apps/web/src/features/auth/auth-credentials.ts`
- Create: `apps/web/src/features/auth/auth-credentials.test.ts`

**Interfaces:**
- Produces: `CredentialAuthMode`, `normalizeCredentialAuthMode`, `validateEmail`, `validatePassword`, `validateNickname`, `validateSignUp`, and `validatePasswordUpdate`.
- Consumes: no React or Supabase dependency; this is the shared pure validation boundary for Tasks 4 and 5.

- [ ] **Step 1: Write the validation contract tests**

Create tests covering exact accepted and rejected values:

```ts
import { describe, expect, it } from "vitest";

import {
  normalizeCredentialAuthMode,
  validateNickname,
  validatePassword,
  validatePasswordUpdate,
  validateSignUp,
} from "./auth-credentials";

describe("credential auth validation", () => {
  it("accepts only supported URL modes", () => {
    expect(normalizeCredentialAuthMode("signup")).toBe("signup");
    expect(normalizeCredentialAuthMode("update-password")).toBe("update-password");
    expect(normalizeCredentialAuthMode("unknown")).toBe("signin");
  });

  it("enforces the password and nickname contract", () => {
    expect(validatePassword("career2026")).toBe("");
    expect(validatePassword("onlyletters")).toContain("숫자");
    expect(validatePassword("1234567890")).toContain("영문자");
    expect(validateNickname(" 커리어곰 ")).toEqual({ value: "커리어곰", error: "" });
    expect(validateNickname("a").error).toContain("2자");
  });

  it("returns field errors without leaking credentials", () => {
    expect(
      validateSignUp({
        email: "bad",
        password: "short",
        passwordConfirmation: "different",
        nickname: "x",
      }),
    ).toMatchObject({
      email: expect.any(String),
      password: expect.any(String),
      passwordConfirmation: expect.any(String),
      nickname: expect.any(String),
    });
    expect(
      validatePasswordUpdate("career2026", "career2026"),
    ).toEqual({});
  });
});
```

- [ ] **Step 2: Run the new test and verify the module is missing**

Run: `cd apps/web && npm test -- --run src/features/auth/auth-credentials.test.ts`

Expected: FAIL because `auth-credentials.ts` does not exist.

- [ ] **Step 3: Implement the pure validation module**

Use these stable types and signatures:

```ts
export type CredentialAuthMode =
  | "signin"
  | "signup"
  | "reset"
  | "update-password";

export type SignUpFields = {
  email: string;
  password: string;
  passwordConfirmation: string;
  nickname: string;
};

export type SignUpErrors = Partial<Record<keyof SignUpFields, string>>;

export function normalizeCredentialAuthMode(value: unknown): CredentialAuthMode;
export function validateEmail(value: string): string;
export function validatePassword(value: string): string;
export function validateNickname(value: string): { value: string; error: string };
export function validateSignUp(fields: SignUpFields): SignUpErrors;
export function validatePasswordUpdate(
  password: string,
  passwordConfirmation: string,
): Partial<Record<"password" | "passwordConfirmation", string>>;
```

Use a bounded email check (`<=254`, one `@`, non-whitespace local/domain), Unicode-aware letter matching with `/\p{L}/u`, digit matching with `/\d/`, and reject nickname control characters with `/[\p{Cc}\p{Cf}]/u`.

- [ ] **Step 4: Run and commit**

Run:

```bash
cd apps/web
npm test -- --run src/features/auth/auth-credentials.test.ts
npm run lint
```

Expected: validation tests and TypeScript pass.

Commit:

```bash
git add apps/web/src/features/auth/auth-credentials.ts apps/web/src/features/auth/auth-credentials.test.ts
git commit -m "feat: define credential auth validation"
```

---

### Task 3: Add the private-owner/public-name profile contract

**Files:**
- Modify: `packages/backend/src/ejikfit/models.py`
- Create: `packages/backend/alembic/versions/20260721_0020_user_profiles.py`
- Create: `packages/backend/tests/test_user_profile_security.py`
- Modify: `packages/backend/tests/test_models.py`

**Interfaces:**
- Produces: SQLAlchemy `UserProfile`, PostgreSQL table `user_profiles`, new-user trigger `public.create_user_profile()`, and owner-update RLS.
- Consumes: Supabase `auth.users`, `auth.uid()`, PostgreSQL roles `anon` and `authenticated`; remains SQLite-compatible for model tests.

- [ ] **Step 1: Add the migration security contract test**

Create `test_user_profile_security.py` with assertions for every security boundary:

```py
from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20260721_0020_user_profiles.py"
)


def test_user_profile_migration_exposes_only_public_name_and_owner_updates() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert '"user_profiles"' in sql
    assert "REFERENCES auth.users(id)" in sql
    assert "ON DELETE CASCADE" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "FOR SELECT" in sql
    assert "TO anon, authenticated" in sql
    assert "FOR UPDATE TO authenticated" in sql
    assert "auth.uid() = user_id" in sql
    assert "SECURITY DEFINER" in sql
    assert "SET search_path = ''" in sql
    assert "raw_user_meta_data" in sql
    assert "INSERT INTO public.user_profiles" in sql
    assert "email" not in sql.lower()
```

Extend `test_models.py` to instantiate `UserProfile(user_id=uuid.uuid4(), nickname="커리어곰")` after `Base.metadata.create_all` and assert the nickname.

- [ ] **Step 2: Run the tests and verify the model and migration are absent**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_user_profile_security.py packages/backend/tests/test_models.py -q
```

Expected: collection fails because the migration and `UserProfile` do not exist.

- [ ] **Step 3: Add the SQLAlchemy model**

Append after `UserCareerState`:

```py
class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    nickname: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
```

- [ ] **Step 4: Implement migration `20260721_0020`**

The migration must:

1. create `user_profiles` with a PostgreSQL check equivalent to
   `nickname IS NULL OR (nickname = btrim(nickname) AND char_length(nickname) BETWEEN 2 AND 20 AND nickname !~ '[[:cntrl:]]')`;
2. add the `auth.users` cascade foreign key only when that table exists;
3. enable RLS and grant only `SELECT` to `anon`, `SELECT, UPDATE` to `authenticated`;
4. create a public select policy and an owner update policy with both `USING` and `WITH CHECK`;
5. backfill one null-nickname row for every existing `auth.users` row;
6. create a hardened `SECURITY DEFINER SET search_path = ''` trigger function that inserts a trimmed metadata nickname only when it passes 2–20 characters and contains no control characters;
7. revoke direct execute from `PUBLIC` and attach the trigger to `auth.users`;
8. drop trigger/function/table in `downgrade()` only when PostgreSQL is used.

Do not grant client insert or delete permissions.

- [ ] **Step 5: Verify the migration contract and offline chain**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_user_profile_security.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py -q
alembic -c packages/backend/alembic.ini upgrade head --sql >/tmp/ejikfit-profile-migration.sql
```

Expected: tests pass and offline SQL generation exits zero.

- [ ] **Step 6: Commit and push the database contract**

```bash
git add packages/backend/src/ejikfit/models.py packages/backend/alembic/versions/20260721_0020_user_profiles.py packages/backend/tests/test_user_profile_security.py packages/backend/tests/test_models.py
git commit -m "feat: add verified user profiles"
git push origin main
```

The push-path migration workflow applies the profile table before the web UI depends on it.

---

### Task 4: Replace passwordless-only UI with credential auth flows

**Files:**
- Create: `apps/web/src/features/auth/auth-panel.tsx`
- Create: `apps/web/src/features/auth/auth-panel.module.css`
- Create: `apps/web/src/features/auth/auth-panel.test.tsx`
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/app/login/page.module.css`
- Delete after reference scan: `apps/web/src/features/auth/login-form.tsx`
- Delete after reference scan: `apps/web/src/features/auth/login-form.module.css`
- Delete after replacement: `apps/web/src/features/auth/login-form.test.tsx`
- Modify: `apps/web/src/app/auth/callback/route.ts`

**Interfaces:**
- Consumes: Task 2 validation, `createBrowserSupabaseClient`, `safeAuthNextPath`, and Task 3's signup metadata trigger.
- Produces: `<AuthPanel initialMode nextPath />` supporting signin, signup, reset request, verification resend, and password update.

- [ ] **Step 1: Write the critical Supabase call tests**

Mock these auth methods: `signUp`, `signInWithPassword`, `resend`,
`resetPasswordForEmail`, `updateUser`, and `getUser`. Cover:

```tsx
expect(signUp).toHaveBeenCalledWith({
  email: "developer@example.com",
  password: "career2026",
  options: {
    data: { nickname: "커리어곰" },
    emailRedirectTo: expect.stringContaining("/auth/callback"),
  },
});

expect(signInWithPassword).toHaveBeenCalledWith({
  email: "developer@example.com",
  password: "career2026",
});

expect(resetPasswordForEmail).toHaveBeenCalledWith(
  "developer@example.com",
  { redirectTo: expect.stringContaining("mode%3Dupdate-password") },
);

expect(updateUser).toHaveBeenCalledWith({ password: "career2026" });
```

Also assert invalid signup values do not call Supabase, auth failures use generic Korean copy,
and submitting buttons re-enable after failure.

- [ ] **Step 2: Run the auth-panel test and verify the component is absent**

Run: `cd apps/web && npm test -- --run src/features/auth/auth-panel.test.tsx`

Expected: FAIL because `auth-panel.tsx` does not exist.

- [ ] **Step 3: Implement `AuthPanel` as a bounded state machine**

Use this public contract:

```tsx
type AuthPanelProps = {
  initialMode: CredentialAuthMode;
  nextPath: string;
};

export function AuthPanel({ initialMode, nextPath }: AuthPanelProps) { ... }
```

Requirements:

- mode links preserve `next` and use `/login?mode=<mode>&next=<encoded>`;
- signin uses `signInWithPassword` and `router.replace(nextPath)` followed by `router.refresh()`;
- signup passes trimmed nickname in `options.data` and shows the verification state;
- resend uses `resend({ type: "signup", email, options: { emailRedirectTo } })`;
- reset request uses a callback whose safe next value is `/login?mode=update-password`;
- update-password checks `getUser()` before showing the form and uses `updateUser`;
- all field errors are connected with `aria-describedby` and `aria-invalid`;
- every button has at least `var(--touch-target)` height;
- never display `authError.message`.

- [ ] **Step 4: Connect server-parsed mode and safe next path**

Extend `LoginPageProps.searchParams` with `mode`. Compute:

```ts
const modeValue = Array.isArray(params.mode) ? params.mode[0] : params.mode;
const initialMode = normalizeCredentialAuthMode(modeValue);
```

Render `<AuthPanel initialMode={initialMode} nextPath={nextPath} />`. Update metadata copy from passwordless-only language to verified account language. Keep callback errors, privacy link, and guest data merge disclosure.

The callback continues exchanging the PKCE code and preserving private no-store headers. Its error redirect must preserve `next` and set `mode=signin`.

- [ ] **Step 5: Remove the old login form only after proving no references remain**

Run:

```bash
rg -n 'LoginForm|login-form' apps/web/src
```

Expected before deletion: only the old files and the now-replaced page/test. Delete the three old files after the replacement imports are clean.

- [ ] **Step 6: Verify focused auth behavior and commit**

Run:

```bash
cd apps/web
npm test -- --run src/features/auth/auth-credentials.test.ts src/features/auth/auth-panel.test.tsx src/app/trust-pages.test.tsx
npm run lint
npm run build
```

Expected: focused tests, TypeScript, and production build pass.

Commit:

```bash
git add apps/web/src/features/auth apps/web/src/app/login apps/web/src/app/auth/callback/route.ts
git commit -m "feat: add verified credential authentication"
```

---

### Task 5: Add nickname profile management and honest account copy

**Files:**
- Create: `apps/web/src/features/account/user-profile-store.ts`
- Create: `apps/web/src/features/account/user-profile-store.test.ts`
- Create: `apps/web/src/features/account/profile-editor.tsx`
- Modify: `apps/web/src/features/account/account-overview.tsx`
- Modify: `apps/web/src/features/account/account-overview.module.css`
- Modify: `apps/web/src/features/account/account-overview.test.tsx`
- Modify: `apps/web/src/features/account/account-actions.ts`
- Modify: `apps/web/src/app/privacy/page.tsx`

**Interfaces:**
- Consumes: Task 2 `validateNickname`, Task 3 `user_profiles`, existing `AuthViewer`, and Supabase browser client.
- Produces: `loadUserProfile(userId)`, `saveUserNickname(userId, nickname)`, `<ProfileEditor viewer />`, and account export profile data.

- [ ] **Step 1: Test the profile store boundary**

Mock a Supabase client and assert:

```ts
await expect(store.load("user-1")).resolves.toEqual({
  userId: "user-1",
  nickname: "커리어곰",
});
await store.updateNickname("user-1", "새닉네임");
expect(update).toHaveBeenCalledWith({
  nickname: "새닉네임",
  updated_at: expect.any(String),
});
expect(eq).toHaveBeenCalledWith("user_id", "user-1");
```

Malformed rows and Supabase errors must reject. The store must never select or return an email.

- [ ] **Step 2: Implement the profile store**

Use exact types:

```ts
export type UserProfile = { userId: string; nickname: string | null };

export type UserProfileStore = {
  load(userId: string): Promise<UserProfile>;
  updateNickname(userId: string, nickname: string): Promise<void>;
};

export function createSupabaseUserProfileStore(
  client: SupabaseClient,
): UserProfileStore;
```

Select only `user_id,nickname`; update only `nickname,updated_at`; scope both operations with `.eq("user_id", userId)`.

- [ ] **Step 3: Add the profile editor to the account page**

`ProfileEditor` loads the profile once per `viewer.id`, shows the verified account email read-only, and provides a labeled nickname field. On save:

1. trim and validate with `validateNickname`;
2. update `user_profiles` through the store;
3. show `닉네임을 저장했습니다.` in an aria-live status;
4. show distinct load, validation, and save errors without exposing Supabase internals.

If the profile table is not migrated, show `프로필 설정을 아직 불러오지 못했습니다.` and a retry button. Do not label it `준비 중`.

Place the editor between the identity panel and career data summary. Change guest copy to `로그인하면 현재 브라우저의 커리어 데이터를 계정에 병합합니다.` and authenticated copy to describe the real server-backed fields.

- [ ] **Step 4: Include profile data in account export and privacy copy**

Add `profile: unknown` to `AccountDataArchive`. Query `user_profiles` by `viewer.id` alongside the existing three account tables, include its error in the combined error, and serialize the row. Update privacy copy to mention public nickname and private email/password handling, while keeping community local-only disclosure until the next phase.

- [ ] **Step 5: Verify focused account behavior and commit**

Run:

```bash
cd apps/web
npm test -- --run src/features/account/user-profile-store.test.ts src/features/account/account-overview.test.tsx src/features/auth/use-auth-viewer.test.tsx
npm run lint
```

Expected: profile store, account UI, and existing sign-out behavior pass.

Commit:

```bash
git add apps/web/src/features/account apps/web/src/app/privacy/page.tsx
git commit -m "feat: manage account nicknames"
git push origin main
```

---

### Task 6: Browser, migration, CI, and production verification

**Files:**
- Modify only if a verified defect is found: files introduced or touched in Tasks 1–5
- Inspect: `.github/workflows/crawl.yml`

**Interfaces:**
- Consumes: all completed task outputs.
- Produces: a production-deployed, verified first authentication increment and a clean handoff into server community persistence.

- [ ] **Step 1: Update deprecated action runtimes in the migration workflow**

The crawler workflow still uses `actions/checkout@v4` and `actions/setup-python@v5`. Change both to stable Node-24-backed `@v6`, matching CI. Run `git diff --check` and commit this maintenance change with the database or final verification commit.

- [ ] **Step 2: Run proportional local verification**

Run backend security/migration coverage:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_user_profile_security.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py -q
```

Run complete web validation once:

```bash
cd apps/web
npm test -- --run
npm run lint
VERCEL=1 VERCEL_ENV=production VERCEL_PROJECT_PRODUCTION_URL=ejik-fit-web.vercel.app API_BASE_URL=https://ejik-fit-api.vercel.app NEXT_PUBLIC_SITE_URL=https://ejik-fit-web.vercel.app npm run build
npx playwright test
```

Expected: all commands exit zero. If `next dev` rewrites `apps/web/next-env.d.ts`, restore its production import to `./.next/types/routes.d.ts` with `apply_patch` before committing.

- [ ] **Step 3: Inspect actual desktop and mobile auth/detail screens**

At 1440×900 and 390×844 verify:

- the default community title is one line only at 1440;
- no duplicate gray feed preview appears in either mock or local detail;
- signin/signup/reset modes remain within the viewport and have no horizontal overflow;
- field labels, error links, password-manager autocomplete, focus-visible, and 44px targets work;
- no browser console or page errors occur.

- [ ] **Step 4: Review, commit, and push only intended files**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Do not stage the protected untracked files. Commit any verified final correction, then push `main`.

- [ ] **Step 5: Verify remote migration, CI, and Vercel**

Confirm the latest commit has:

- successful GitHub `ci` backend and web jobs;
- successful Vercel web and API deployments;
- successful push-triggered crawler migration job for `20260721_0020`;
- no Node 20 action deprecation annotation.

- [ ] **Step 6: Exercise production-safe auth states**

Without creating disposable personal data in logs, verify:

- `/login?mode=signin` and `/login?mode=signup` render and preserve `next`;
- invalid local inputs never call Supabase;
- signup reaches the generic verification-email state;
- the deployed profile table can be queried only by the intended RLS paths;
- an existing magic-link account can enter the reset path;
- guest career data remains present through the login redirect and is merged by the existing sync hook after a real authenticated session.

- [ ] **Step 7: Mark the plan complete and continue to server community design**

Update this plan's checkboxes as tasks land. Once all verification is green, start the separate server-community spec for posts, comments, reactions, saves, follows, migration of existing local content, reporting, and community notifications. Keep profile-based job matching excluded.
