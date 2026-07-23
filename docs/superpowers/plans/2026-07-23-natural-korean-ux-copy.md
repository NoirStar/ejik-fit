# Natural Korean UX Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every first-party, user-facing Korean UI string so that it is natural, concise, consistent, and clear about the user's next action without changing product behavior or source data.

**Architecture:** Keep copy local to the component that owns its context, while putting the small set of genuinely shared product terms in `src/lib/labels.ts`. Migrate one user journey at a time behind focused Vitest assertions, then add an AST-based source contract that prevents the approved legacy phrases from returning. Preserve all data, authentication, storage, routing, and rendering boundaries.

**Tech Stack:** Next.js 16.2.11, React 19.2.0, TypeScript 5.8, Vitest 3.2, Testing Library, Playwright 1.61.1, Pretendard.

## Global Constraints

- Use `~합니다` for facts and state, and `~해 주세요` for requested user actions.
- Buttons and menu items use a short action or destination without honorific endings.
- Use `내 기술`, `스킬맵`, `공고`, `필수·우대 미표기`, `저장 목록`, and `최근 확인` consistently.
- Compact charts may shorten `필수·우대 미표기` to `미표기` only when the full meaning is present in the local legend or help text.
- Remove redundant descriptions when a nearby heading, field label, or action already says the same thing.
- Do not expose `복구 세션`, `그래프 응답`, `운영 DB`, `브라우저 원본`, or other implementation vocabulary in product UI.
- Preserve account-enumeration protection without explaining account lookup behavior in the reset flow.
- Preserve necessary privacy, source-scope, deletion, and analysis-limit facts.
- Do not edit user-authored posts/comments, employer-authored job content, company names, technology names, or source data fixtures.
- Do not change authentication, database persistence, API requests, routing, or state-management behavior.
- Do not add a localization framework or a monolithic copy dictionary.
- Keep button and tab labels on one line at 320px and above.
- Preserve all pre-existing dirty files in the main worktree; stage only files named by each task.

---

## File Structure

- `apps/web/src/lib/labels.ts`: canonical shared product terms plus existing job-label formatters.
- `apps/web/src/lib/labels.test.ts`: exact glossary contract.
- `apps/web/src/lib/ui-copy-contract.test.ts`: AST-based guard for forbidden first-party UI phrases.
- `apps/web/src/app/login/page.tsx` and `apps/web/src/features/auth/*`: authentication copy and validation messages.
- `apps/web/src/components/app-shell/app-shell.tsx`: global search, navigation, account, and notification copy.
- `apps/web/src/features/market/*`: market headings, legends, trends, evidence, and empty/error states.
- `apps/web/src/components/skill-graph-*`, `apps/web/src/features/owned-skills/*`: skill-map labels, instructions, recommendations, and errors.
- `apps/web/src/features/jobs/*`, `apps/web/src/features/search/*`: job discovery and global-search copy.
- `apps/web/src/features/home-feed/*`, `apps/web/src/features/community/*`: feed, composer, post, comment, reaction, and migration copy.
- `apps/web/src/features/career/*`, `apps/web/src/features/account/*`, `apps/web/src/features/saved-*`, `apps/web/src/features/companies/*`, `apps/web/src/features/hiring-calendar/*`, `apps/web/src/features/notifications/*`: personal workspace copy.
- `apps/web/src/app/privacy/page.tsx`, `apps/web/src/app/data-policy/page.tsx`, `apps/web/src/app/methodology/page.tsx`, `apps/web/src/app/corrections/page.tsx`, and `apps/web/src/features/sources/source-directory.tsx`: trust and policy copy.
- Existing colocated `*.test.ts(x)` files and `apps/web/e2e/*.e2e.ts`: behavior and rendered-copy verification.

---

### Task 1: Lock the Shared Product Glossary

**Files:**
- Modify: `apps/web/src/lib/labels.test.ts`
- Modify: `apps/web/src/lib/labels.ts`

**Interfaces:**
- Produces: `PRODUCT_TERMS`, a readonly object consumed by migrated UI components.
- Preserves: `formatCareer(value: string | null): string` and `formatEmployment(value: string | null): string`.

- [ ] **Step 1: Write the failing glossary test**

Add this test without changing the existing posting-label cases:

```ts
import {
  formatCareer,
  formatEmployment,
  PRODUCT_TERMS,
} from "./labels";

it("keeps shared Korean product terms consistent", () => {
  expect(PRODUCT_TERMS).toEqual({
    ownedSkills: "내 기술",
    skillMap: "스킬맵",
    unspecifiedRequirement: "필수·우대 미표기",
    unspecifiedRequirementCompact: "미표기",
    savedItems: "저장 목록",
    lastChecked: "최근 확인",
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/web
npm test -- --run src/lib/labels.test.ts
```

Expected: FAIL because `PRODUCT_TERMS` is not exported.

- [ ] **Step 3: Add the canonical terms**

Add this before the existing formatters in `src/lib/labels.ts`:

```ts
export const PRODUCT_TERMS = {
  ownedSkills: "내 기술",
  skillMap: "스킬맵",
  unspecifiedRequirement: "필수·우대 미표기",
  unspecifiedRequirementCompact: "미표기",
  savedItems: "저장 목록",
  lastChecked: "최근 확인",
} as const;
```

Do not move screen-specific sentences into this object.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
cd apps/web
npm test -- --run src/lib/labels.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the glossary contract**

```bash
git add apps/web/src/lib/labels.ts apps/web/src/lib/labels.test.ts
git commit -m "test: lock Korean product terminology"
```

---

### Task 2: Rewrite Authentication and Global-Shell Copy

**Files:**
- Create: `apps/web/src/app/login/page.test.tsx`
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/app/login/page.module.css`
- Modify: `apps/web/src/features/auth/auth-credentials.ts`
- Modify: `apps/web/src/features/auth/auth-credentials.test.ts`
- Modify: `apps/web/src/features/auth/auth-panel.tsx`
- Modify: `apps/web/src/features/auth/auth-panel.test.tsx`
- Modify: `apps/web/src/features/auth/use-auth-viewer.ts`
- Modify: `apps/web/src/features/auth/use-auth-viewer.test.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.test.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/loading.tsx`
- Modify: `apps/web/src/app/loading.test.tsx`
- Modify: `apps/web/src/app/manifest.ts`
- Modify: `apps/web/src/app/error.tsx`
- Modify: `apps/web/src/app/error.test.tsx`
- Modify: `apps/web/src/app/not-found.tsx`
- Modify: `apps/web/src/app/not-found.test.tsx`

**Interfaces:**
- Consumes: `PRODUCT_TERMS.ownedSkills` and `PRODUCT_TERMS.savedItems`.
- Preserves: every Supabase call, safe return path, credential-validation rule, and account-enumeration behavior.
- Produces: a minimal login page and actionable authentication errors.

- [ ] **Step 1: Write failing login and recovery-copy tests**

Create `src/app/login/page.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("@/features/auth/auth-panel", () => ({
  AuthPanel: () => <div data-testid="auth-panel" />,
}));

describe("LoginPage", () => {
  afterEach(() => cleanup());

  it("shows only the information needed to log in", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { level: 1, name: "로그인" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("auth-panel")).toBeInTheDocument();
    expect(
      screen.queryByText("로그인하면 달라지는 점"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/이메일 확인으로 계정을 보호하고/),
    ).not.toBeInTheDocument();
  });
});
```

Replace the recovery assertion in `auth-panel.test.tsx` with:

```tsx
const status = await screen.findByRole("status");
expect(status).toHaveTextContent("비밀번호 재설정 요청을 완료했습니다.");
expect(status).toHaveTextContent(
  "developer@example.com의 메일함을 확인해 주세요.",
);
expect(status).not.toHaveTextContent("가입 여부와 관계없이");
```

Update validation expectations to use `입력해 주세요`, `포함해 주세요`, and
`확인해 주세요` with the approved spacing.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd apps/web
npm test -- --run \
  src/app/login/page.test.tsx \
  src/features/auth/auth-credentials.test.ts \
  src/features/auth/auth-panel.test.tsx \
  src/features/auth/use-auth-viewer.test.tsx
```

Expected: FAIL on the old page heading, old reset success copy, and joined `해주세요` strings.

- [ ] **Step 3: Simplify the login page**

The rendered core of `src/app/login/page.tsx` must become:

```tsx
<main className={styles.page}>
  <section aria-labelledby="login-title" className={styles.panel}>
    <Link className={styles.back} href={nextPath}>
      <ArrowLeft aria-hidden="true" size={17} />
      돌아가기
    </Link>
    <header className={styles.header}>
      <h1 id="login-title">로그인</h1>
    </header>
    {errorValue === "callback" && (
      <p className={styles.callbackError} role="alert">
        인증 링크를 사용할 수 없습니다. 로그인하거나 새 링크를 받아 주세요.
      </p>
    )}
    <AuthPanel initialMode={initialMode} nextPath={nextPath} />
  </section>
</main>
```

Remove the unused `CheckCircle` import and every `.scope` and `.header p` rule from
`page.module.css`. Keep panel sizing, keyboard focus, and mobile layout unchanged.

- [ ] **Step 4: Rewrite the authentication states without changing behavior**

Use these exact strings in `auth-panel.tsx` and `auth-credentials.ts`:

| Old intent | New copy |
| --- | --- |
| Missing/invalid input | `이메일을 입력해 주세요.`, `올바른 이메일 주소를 입력해 주세요.`, `비밀번호를 한 번 더 입력해 주세요.` |
| Invalid sign-in | `이메일 또는 비밀번호를 확인해 주세요.` |
| Missing browser auth client | `[로그인/회원가입/메일 전송]을 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.` |
| Generic async failure | `[행동]하지 못했습니다. 잠시 후 다시 시도해 주세요.` |
| Verification sent | `확인 메일을 보냈습니다.` and `{email}의 메일함에서 가입을 확인해 주세요.` |
| Reset sent | `비밀번호 재설정 요청을 완료했습니다.` and `{email}의 메일함을 확인해 주세요.` |
| Recovery checking | `재설정 링크를 확인하고 있습니다.` |
| Recovery missing | `이 링크는 만료되었거나 사용할 수 없습니다.` |
| Signup introduction | `가입하려면 이메일 확인이 필요합니다.` |
| Sign-in introduction | Remove it; field labels already explain the form. |

Delete the reset-form paragraph `가입된 주소인지 여부는 화면에 표시하지 않습니다.`.
Keep the generic success response and identical Supabase branch behavior so an attacker
still cannot distinguish registered from unregistered addresses.

- [ ] **Step 5: Rewrite global shell and global error copy**

Apply these exact replacements while preserving component structure:

```ts
const GLOBAL_COPY = {
  searchPlaceholder: "회사, 직무, 기술, 주제 검색",
  notificationDescription: "새 공고와 지원 현황을 확인합니다.",
  guestStorage: "내 기술은 이 기기에 저장됩니다.",
  signedInStorage: "내 기술과 저장 항목을 계정에 저장했습니다.",
  savedItems: PRODUCT_TERMS.savedItems,
};
```

Do not create `GLOBAL_COPY` as a new exported abstraction; the object above shows the
final values to place in their existing local positions. Change the global error body to
`페이지를 불러오지 못했습니다. 다시 시도하거나 홈으로 이동해 주세요.` and retain
the existing `다시 시도` and `홈으로` actions. Change shared metadata copy to
`채용공고의 기술 수요와 내 기술을 비교하는 이직핏입니다.` and the manifest description
to `채용공고 기술 분석과 스킬맵`. Change loading labels to complete Korean phrases such as
`홈 피드를 불러오는 중` and `내 커리어를 불러오는 중`.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
cd apps/web
npm test -- --run \
  src/app/login/page.test.tsx \
  src/features/auth/auth-credentials.test.ts \
  src/features/auth/auth-panel.test.tsx \
  src/features/auth/use-auth-viewer.test.tsx \
  src/components/app-shell/app-shell.test.tsx \
  src/app/loading.test.tsx \
  src/app/error.test.tsx \
  src/app/not-found.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit authentication and shell copy**

```bash
git add \
  apps/web/src/app/login \
  apps/web/src/features/auth \
  apps/web/src/components/app-shell/app-shell.tsx \
  apps/web/src/components/app-shell/app-shell.test.tsx \
  apps/web/src/app/layout.tsx \
  apps/web/src/app/loading.tsx \
  apps/web/src/app/loading.test.tsx \
  apps/web/src/app/manifest.ts \
  apps/web/src/app/error.tsx \
  apps/web/src/app/error.test.tsx \
  apps/web/src/app/not-found.tsx \
  apps/web/src/app/not-found.test.tsx
git commit -m "fix: simplify Korean authentication copy"
```

---

### Task 3: Make Market Language Explain the Data at a Glance

**Files:**
- Modify: `apps/web/src/app/market/page.tsx`
- Modify: `apps/web/src/app/market/page.test.tsx`
- Modify: `apps/web/src/app/market/loading.tsx`
- Modify: `apps/web/src/app/market/loading.test.tsx`
- Modify: `apps/web/src/features/market/explicit-demand-bar.tsx`
- Modify: `apps/web/src/features/market/market-overview.tsx`
- Modify: `apps/web/src/features/market/market-overview.test.tsx`
- Modify: `apps/web/src/features/market/market-pulse-summary.tsx`
- Modify: `apps/web/src/features/market/market-pulse-summary.test.tsx`
- Modify: `apps/web/src/features/market/selected-technology-evidence.tsx`
- Modify: `apps/web/src/features/market/selected-technology-evidence.test.tsx`
- Modify: `apps/web/src/features/market/technology-demand-chart.tsx`
- Modify: `apps/web/src/features/market/technology-demand-chart.test.tsx`
- Modify: `apps/web/src/features/market/technology-trend-panel.tsx`
- Modify: `apps/web/src/features/market/use-market-trends.ts`
- Modify: `apps/web/src/features/market/model.ts`
- Modify: `apps/web/src/features/market/model.test.ts`
- Modify: `apps/web/e2e/market-overview.e2e.ts`

**Interfaces:**
- Consumes: `PRODUCT_TERMS.unspecifiedRequirement` and `PRODUCT_TERMS.unspecifiedRequirementCompact`.
- Preserves: demand counts, filters, trend requests, selected-technology state, and chart geometry.
- Produces: one consistent meaning for unclassified requirement data across table, chart, evidence, and accessibility labels.

- [ ] **Step 1: Change market tests to the approved language**

Use these assertions in the existing focused tests:

```tsx
expect(
  screen.getByRole("heading", { level: 1, name: "채용 시장 기술 동향" }),
).toBeInTheDocument();
expect(
  screen.getByText("기업 채용공고에 많이 나온 기술과 최근 변화를 보여줍니다."),
).toBeInTheDocument();
expect(screen.getAllByText(/미표기 3건/).length).toBeGreaterThan(0);
expect(
  screen.getByText(
    "공고에 기술은 나오지만 필수 또는 우대로 구분되어 있지 않은 경우입니다.",
  ),
).toBeInTheDocument();
expect(screen.queryByText(/구분 안 됨/)).not.toBeInTheDocument();
```

Update the demand-bar accessible-name expectation to:

```ts
"인프라, 명시 요구 9건, 필수 5건, 우대 4건, 전체 등장 12건, 필수·우대 미표기 3건, 1위 대비 막대 길이 100%"
```

- [ ] **Step 2: Run market tests and verify RED**

Run:

```bash
cd apps/web
npm test -- --run \
  src/app/market/page.test.tsx \
  src/app/market/loading.test.tsx \
  src/features/market/market-overview.test.tsx \
  src/features/market/market-pulse-summary.test.tsx \
  src/features/market/selected-technology-evidence.test.tsx \
  src/features/market/technology-demand-chart.test.tsx
```

Expected: FAIL on the old hero, legend, evidence label, and accessible name.

- [ ] **Step 3: Apply the market copy hierarchy**

Use the following final hierarchy:

```tsx
<h1>채용 시장 기술 동향</h1>
<p>기업 채용공고에 많이 나온 기술과 최근 변화를 보여줍니다.</p>

<h2>기술 수요</h2>
<span>필수</span>
<span>우대</span>
<span>{PRODUCT_TERMS.unspecifiedRequirementCompact}</span>
```

Place this explanation once in the existing `데이터를 읽는 기준` region:

```tsx
<p>
  막대와 주간 변화는 필수 또는 우대로 명시된 공고 수를 기준으로 합니다.
  공고에 기술은 나오지만 필수 또는 우대로 구분되어 있지 않은 경우는
  필수·우대 미표기로 표시합니다. 막대는 1위와의 상대적인 차이이며
  시장점유율이 아닙니다.
</p>
```

Remove repeated phrases such as `현재 불러온 범위`, `실제 공식 공고`, and
`계속 확인할 수 있습니다` where the page-level scope notice already applies.

- [ ] **Step 4: Make trend loading, insufficient-data, and failure states direct**

Use these exact states:

```ts
const TREND_COPY = {
  loading: "주간 추세를 불러오고 있습니다.",
  insufficient: (collectedWeeks: number, requiredWeeks: number) =>
    `${collectedWeeks}주치 데이터가 쌓였습니다. ${requiredWeeks}주부터 변화선을 표시합니다.`,
  error: "주간 추세를 불러오지 못했습니다. 기술 수요와 관련 공고는 정상적으로 표시됩니다.",
};
```

Keep the existing honest-data statement, but shorten it to
`수집된 공고만 사용하며 빠진 주차를 임의로 채우지 않습니다.`

- [ ] **Step 5: Run market unit and E2E tests**

Run:

```bash
cd apps/web
npm test -- --run src/app/market src/features/market
npm run test:e2e -- market-overview.e2e.ts --reporter=line
```

Expected: all selected unit tests and market E2E tests PASS.

- [ ] **Step 6: Commit market copy**

```bash
git add apps/web/src/app/market apps/web/src/features/market apps/web/e2e/market-overview.e2e.ts
git commit -m "fix: clarify Korean market terminology"
```

---

### Task 4: Turn the Skill Map into a Clear Learning Decision

**Files:**
- Modify: `apps/web/src/app/skills/graph/page.tsx`
- Modify: `apps/web/src/app/skills/graph/page.test.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.tsx`
- Modify: `apps/web/src/components/skill-graph-experience.test.tsx`
- Modify: `apps/web/src/components/skill-graph-force-canvas.tsx`
- Modify: `apps/web/src/components/skill-ranking.tsx`
- Modify: `apps/web/src/components/skill-ranking.test.tsx`
- Modify: `apps/web/src/features/owned-skills/owned-skills-sheet.tsx`
- Modify: `apps/web/src/features/owned-skills/owned-skills-sheet.test.tsx`
- Modify: `apps/web/e2e/skill-map.e2e.ts`

**Interfaces:**
- Consumes: `PRODUCT_TERMS.ownedSkills`, `PRODUCT_TERMS.skillMap`, and both unspecified-requirement terms.
- Preserves: graph loading, reduced-motion rendering, drag, pinch, zoom, node selection, filters, saved skills, and fit-analysis requests.
- Produces: headings that answer “what should I learn next?” without changing graph calculations.

- [ ] **Step 1: Write failing skill-map language assertions**

Add or replace assertions in `skill-graph-experience.test.tsx`:

```tsx
expect(
  screen.getByRole("heading", { level: 1, name: "스킬맵" }),
).toBeInTheDocument();
expect(
  screen.getByText("내 기술과 함께 자주 요구되는 기술을 보여줍니다."),
).toBeInTheDocument();
expect(screen.getByText("내 기술")).toBeInTheDocument();
expect(screen.getByText("다음에 배울 기술")).toBeInTheDocument();
expect(screen.getByText("함께 요구되는 기술")).toBeInTheDocument();
expect(screen.getByText("필수·우대 미표기")).toBeInTheDocument();
expect(screen.queryByText(/내 스택|기술 맵|다음 준비|미분류/)).not.toBeInTheDocument();
```

Update the E2E heading lookup to `스킬맵` while retaining the existing mouse, touch,
reduced-motion, and selected-node assertions.

- [ ] **Step 2: Run skill-map tests and verify RED**

Run:

```bash
cd apps/web
npm test -- --run \
  src/app/skills/graph/page.test.tsx \
  src/components/skill-graph-experience.test.tsx \
  src/components/skill-ranking.test.tsx \
  src/features/owned-skills/owned-skills-sheet.test.tsx
```

Expected: FAIL on the old `이직핏 기술 맵`, `내 스택`, recommendation, and requirement labels.

- [ ] **Step 3: Replace the visible hierarchy and instructions**

Use these final labels in `skill-graph-experience.tsx`:

```ts
const SKILL_MAP_COPY = {
  title: PRODUCT_TERMS.skillMap,
  description: "내 기술과 함께 자주 요구되는 기술을 보여줍니다.",
  ownedSkills: PRODUCT_TERMS.ownedSkills,
  addSkill: "기술 추가",
  filters: "그래프 범위",
  recommendation: "다음에 배울 기술",
  related: "함께 요구되는 기술",
  desktopControls: "드래그 · 확대 · 선택",
  mobileControls: "이동 · 두 손가락으로 확대 · 탭하여 선택",
};
```

Keep these values local rather than exporting `SKILL_MAP_COPY`. Replace the selected-node
`미분류` label with the full canonical label. Replace the recommendation empty state with
`내 기술을 추가하면 공고에서 함께 요구되는 기술이 표시됩니다.` Import shared terms with
`import { PRODUCT_TERMS } from "@/lib/labels";` only in files that render them.

- [ ] **Step 4: Remove implementation vocabulary from graph states**

Use these exact messages:

```ts
const GRAPH_STATES = {
  loadError: "스킬맵을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
  empty: "표시할 기술이 없습니다. 검색어나 분야 필터를 줄여 주세요.",
  fitLoading: "내 기술과 공고를 비교하고 있습니다.",
  fitError: "내 기술을 비교하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};
```

Do not alter the error branches or retry handlers. In the owned-skills sheet, use `내 기술`,
`내 기술 닫기`, `추가한 기술`, and `아직 추가한 기술이 없습니다.` consistently.

- [ ] **Step 5: Run unit and interaction tests**

Run:

```bash
cd apps/web
npm test -- --run \
  src/app/skills/graph/page.test.tsx \
  src/components/skill-graph-experience.test.tsx \
  src/components/skill-ranking.test.tsx \
  src/features/owned-skills/owned-skills-sheet.test.tsx
npm run test:e2e -- skill-map.e2e.ts --reporter=line
```

Expected: all selected tests PASS, including desktop drag, mobile pan/pinch/tap, and reduced motion.

- [ ] **Step 6: Commit skill-map copy**

```bash
git add \
  apps/web/src/app/skills/graph \
  apps/web/src/components/skill-graph-experience.tsx \
  apps/web/src/components/skill-graph-experience.test.tsx \
  apps/web/src/components/skill-graph-force-canvas.tsx \
  apps/web/src/components/skill-ranking.tsx \
  apps/web/src/components/skill-ranking.test.tsx \
  apps/web/src/features/owned-skills \
  apps/web/e2e/skill-map.e2e.ts
git commit -m "fix: make skill map guidance actionable"
```

---

### Task 5: Clarify Job Discovery and Search Results

**Files:**
- Modify: `apps/web/src/app/jobs/page.tsx`
- Modify: `apps/web/src/app/jobs/page.test.tsx`
- Modify: `apps/web/src/app/jobs/[id]/page.tsx`
- Modify: `apps/web/src/app/jobs/[id]/page.test.tsx`
- Modify: `apps/web/src/app/jobs/[id]/error.tsx`
- Modify: `apps/web/src/features/jobs/job-list.tsx`
- Modify: `apps/web/src/features/jobs/job-list.test.tsx`
- Modify: `apps/web/src/features/jobs/job-detail-view.tsx`
- Modify: `apps/web/src/features/jobs/job-detail-actions.tsx`
- Modify: `apps/web/src/features/jobs/job-detail-actions.test.tsx`
- Modify: `apps/web/src/features/jobs/model.ts`
- Modify: `apps/web/src/features/jobs/model.test.ts`
- Modify: `apps/web/src/components/job-card.tsx`
- Modify: `apps/web/src/components/job-card.test.tsx`
- Modify: `apps/web/src/components/source-meta.tsx`
- Modify: `apps/web/src/components/skill-evidence.tsx`
- Modify: `apps/web/src/components/skill-evidence.test.tsx`
- Modify: `apps/web/src/app/search/page.tsx`
- Modify: `apps/web/src/app/search/page.test.tsx`
- Modify: `apps/web/src/features/search/search-results.tsx`
- Modify: `apps/web/src/features/search/search-results.test.tsx`
- Modify: `apps/web/e2e/jobs-explorer.e2e.ts`
- Modify: `apps/web/e2e/job-detail.e2e.ts`
- Modify: `apps/web/e2e/global-search.e2e.ts`

**Interfaces:**
- Consumes: `PRODUCT_TERMS.ownedSkills` and `PRODUCT_TERMS.unspecifiedRequirementCompact`.
- Preserves: query parameters, filters, pagination, saved jobs, fit analysis, source links, and search scopes.
- Produces: labels that distinguish job details, technology requirements, and search scope without policy repetition.

- [ ] **Step 1: Update job and search tests first**

Use these exact expectations in the existing tests:

```tsx
expect(
  screen.getByRole("heading", { level: 1, name: "채용공고" }),
).toBeInTheDocument();
expect(
  screen.getByText("기술·직무·기업으로 공고를 찾고 내 기술과 비교합니다."),
).toBeInTheDocument();
expect(screen.getAllByRole("link", { name: "기술 요건 보기" }).length).toBeGreaterThan(0);
expect(screen.queryByText(/내 스택/)).not.toBeInTheDocument();
```

Change the search skill breakdown assertion to:

```tsx
expect(
  within(skill).getByText("필수 12 · 우대 4 · 미표기 2"),
).toBeInTheDocument();
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd apps/web
npm test -- --run \
  src/app/jobs/page.test.tsx \
  src/app/jobs/[id]/page.test.tsx \
  src/features/jobs/job-list.test.tsx \
  src/features/jobs/job-detail-actions.test.tsx \
  src/components/job-card.test.tsx \
  src/components/skill-evidence.test.tsx \
  src/app/search/page.test.tsx \
  src/features/search/search-results.test.tsx
```

Expected: FAIL on `공고 탐색`, `분석 보기`, `내 스택`, and `미분류`.

- [ ] **Step 3: Rewrite job-list hierarchy and next actions**

Use this copy set in the existing positions:

```ts
const JOB_COPY = {
  title: "채용공고",
  description: "기술·직무·기업으로 공고를 찾고 내 기술과 비교합니다.",
  currentList: "현재 목록",
  details: "공고 보기",
  requirements: "기술 요건 보기",
  empty: "조건에 맞는 공고가 없습니다. 검색어나 필터를 줄여 주세요.",
  savedEmpty: "저장한 공고가 없습니다.",
  addSkills: "내 기술을 추가하면 공고의 기술 요건과 비교합니다.",
};
```

Keep only one source-scope notice below the result list:
`지원하기 전에 기업 채용페이지에서 최신 내용을 확인해 주세요.`

- [ ] **Step 4: Rewrite global-search scope and empty/error copy**

Use:

```ts
const SEARCH_COPY = {
  prompt: "검색어를 입력해 주세요.",
  description: "공고와 커뮤니티 글을 나누어 보여줍니다.",
  empty: "검색 결과가 없습니다. 검색어를 줄이거나 기술·기업 이름으로 검색해 주세요.",
  communityError: "커뮤니티 검색 결과를 불러오지 못했습니다.",
};
```

Retain the read-only starter-guide disclosure, but state it once at the guide section rather
than on every result. Use `미표기` for the compact requirement breakdown.

- [ ] **Step 5: Run unit and E2E tests**

Run:

```bash
cd apps/web
npm test -- --run src/app/jobs src/features/jobs src/app/search src/features/search
npm run test:e2e -- \
  jobs-explorer.e2e.ts \
  job-detail.e2e.ts \
  global-search.e2e.ts \
  --reporter=line
```

Expected: all selected tests PASS.

- [ ] **Step 6: Commit job and search copy**

```bash
git add \
  apps/web/src/app/jobs \
  apps/web/src/features/jobs \
  apps/web/src/app/search \
  apps/web/src/features/search \
  apps/web/e2e/jobs-explorer.e2e.ts \
  apps/web/e2e/job-detail.e2e.ts \
  apps/web/e2e/global-search.e2e.ts
git commit -m "fix: clarify Korean job and search copy"
```

---

### Task 6: Remove Feed and Community Copy That Explains the Interface

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/page.test.tsx`
- Modify: `apps/web/src/app/posts/[id]/page.tsx`
- Modify: `apps/web/src/app/posts/[id]/page.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/src/features/home-feed/model.ts`
- Modify: `apps/web/src/features/home-feed/model.test.ts`
- Modify: `apps/web/src/features/home-feed/post-detail-actions.tsx`
- Modify: `apps/web/src/features/home-feed/post-detail-actions.test.tsx`
- Modify: `apps/web/src/features/home-feed/following-post-list.tsx`
- Modify: `apps/web/src/features/home-feed/following-post-list.test.tsx`
- Modify: `apps/web/src/features/home-feed/author-follow-button.tsx`
- Modify: `apps/web/src/features/home-feed/local-post-detail.tsx`
- Modify: `apps/web/src/features/home-feed/local-post-detail.test.tsx`
- Modify: `apps/web/src/features/home-feed/recent-topic-list.tsx`
- Modify: `apps/web/src/features/home-feed/starter-community-guide.tsx`
- Modify: `apps/web/src/features/home-feed/starter-community-guide.test.tsx`
- Modify: `apps/web/src/features/community/community-migration.ts`
- Modify: `apps/web/src/features/community/community-migration.test.ts`
- Modify: `apps/web/src/features/community/community-store.ts`
- Modify: `apps/web/src/features/community/community-store.test.ts`
- Modify: `apps/web/src/features/community/server-comment-list.tsx`
- Modify: `apps/web/src/features/community/server-comment-list.test.tsx`
- Modify: `apps/web/src/features/community/server-post-detail.tsx`
- Modify: `apps/web/src/features/community/server-post-detail.test.tsx`
- Modify: `apps/web/src/features/community/server-post-editor.tsx`
- Modify: `apps/web/src/features/community/server-post-editor.test.tsx`
- Modify: `apps/web/src/features/community/use-community-feed.ts`
- Modify: `apps/web/src/features/community/use-community-feed.test.tsx`
- Modify: `apps/web/src/features/community/use-community-search.ts`
- Modify: `apps/web/src/features/community/use-community-search.test.tsx`
- Modify: `apps/web/src/features/community/use-community-legacy-migration.ts`
- Modify: `apps/web/src/features/community/use-community-legacy-migration.test.tsx`
- Modify: `apps/web/e2e/authenticated-community.e2e.ts`
- Modify: `apps/web/e2e/post-detail.e2e.ts`
- Modify: `apps/web/e2e/home-market-context.e2e.ts`
- Modify: `apps/web/e2e/home-career-insight.e2e.ts`

**Interfaces:**
- Consumes: canonical product terms from `PRODUCT_TERMS`.
- Preserves: feed ordering, authenticated persistence, draft recovery, comments, reactions, saves, follows, reports, and read-only starter content.
- Produces: concise feed sections and community feedback that distinguishes visible state from true asynchronous failure.

- [ ] **Step 1: Write failing feed and community-copy assertions**

Add these assertions to the existing tests in the contexts where market and career inserts render:

```tsx
expect(screen.getByRole("heading", { name: "커리어 이야기" })).toBeInTheDocument();
expect(screen.getByText("채용 시장")).toBeInTheDocument();
expect(screen.getByText("내 기술과 맞는 공고")).toBeInTheDocument();
expect(screen.getByText("미표기 2건")).toBeInTheDocument();
expect(screen.queryByText(/커리어 이야기 둘러보기|채용 시장 인사이트|내 커리어 인사이트/)).not.toBeInTheDocument();
```

For comment/editor pending labels, assert the Unicode ellipsis:

```tsx
expect(screen.getByRole("button", { name: "등록 중…" })).toBeDisabled();
expect(screen.queryByText(/등록 중\.\.\./)).not.toBeInTheDocument();
```

For visible state toggles, assert the button state changes and no separate visible success
paragraph is added. Keep existing `aria-pressed` and item-count assertions.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd apps/web
npm test -- --run \
  src/features/home-feed/home-feed.test.tsx \
  src/features/home-feed/model.test.ts \
  src/features/home-feed/post-detail-actions.test.tsx \
  src/features/community/server-comment-list.test.tsx \
  src/features/community/server-post-detail.test.tsx \
  src/features/community/server-post-editor.test.tsx
```

Expected: FAIL on old section headings, `미분류`, casual endings, and three-period pending labels.

- [ ] **Step 3: Rewrite home feed inserts and guidance**

Apply this final copy hierarchy:

```ts
const HOME_COPY = {
  title: "커리어 이야기",
  market: "채용 시장",
  career: "내 기술과 맞는 공고",
  addSkills: "내 기술을 추가하면 맞는 공고와 다음에 배울 기술을 보여줍니다.",
  graphEvidenceMissing: "이 공고에서 확인된 기술 요건이 없습니다.",
  followingEmpty: "팔로우한 작성자의 글이 없습니다.",
  followingAction: "다른 글에서 관심 있는 작성자를 팔로우해 주세요.",
};
```

Replace every `미분류` display with `미표기`; update generated summaries in
`home-feed/model.ts` to use `필수·우대 미표기` when the phrase appears in a sentence.
Import shared terms with `import { PRODUCT_TERMS } from "@/lib/labels";` in files that render
the canonical values.

- [ ] **Step 4: Rewrite community form, failure, migration, and pending copy**

Use `…` in every visible pending label: `저장 중…`, `등록 중…`, `게시 중…`,
`삭제 중…`, `접수 중…`, `불러오는 중…`.

Use these failure messages:

```ts
const COMMUNITY_FAILURE_COPY = {
  invalid: "작성 내용을 확인해 주세요.",
  auth: "로그인한 뒤 다시 시도해 주세요.",
  connection: "커뮤니티에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  create: "글을 게시하지 못했습니다. 작성 내용은 그대로 두었습니다.",
  update: "수정 내용을 저장하지 못했습니다. 작성 내용은 그대로 두었습니다.",
  comment: "댓글을 등록하지 못했습니다. 작성 내용은 그대로 두었습니다.",
};
```

Replace `브라우저 원본` with `이 기기에 남은 글`. Change the destructive confirmation
button from `정말 삭제` to `글 삭제`; keep the existing confirmation dialog and delete
cascade behavior.

Visible success paragraphs for a save, reaction, follow, or comment whose result is already
rendered must be removed. Preserve screen-reader-only announcements where they communicate a
changed toggle state that is not otherwise announced.

- [ ] **Step 5: Run unit and community E2E tests**

Run:

```bash
cd apps/web
npm test -- --run src/app/posts src/features/home-feed src/features/community
npm run test:e2e -- \
  authenticated-community.e2e.ts \
  post-detail.e2e.ts \
  home-market-context.e2e.ts \
  home-career-insight.e2e.ts \
  --reporter=line
```

Expected: all selected tests PASS and durable account persistence remains covered.

- [ ] **Step 6: Commit feed and community copy**

```bash
git add \
  apps/web/src/app/page.tsx \
  apps/web/src/app/page.test.tsx \
  apps/web/src/app/posts \
  apps/web/src/features/home-feed \
  apps/web/src/features/community \
  apps/web/e2e/authenticated-community.e2e.ts \
  apps/web/e2e/post-detail.e2e.ts \
  apps/web/e2e/home-market-context.e2e.ts \
  apps/web/e2e/home-career-insight.e2e.ts
git commit -m "fix: streamline Korean community copy"
```

---

### Task 7: Rewrite the Personal Career Workspace

**Files:**
- Modify: `apps/web/src/app/career/page.tsx`
- Modify: `apps/web/src/app/career/page.test.tsx`
- Modify: `apps/web/src/app/career/account/page.tsx`
- Modify: `apps/web/src/app/career/alerts/page.tsx`
- Modify: `apps/web/src/app/career/alerts/page.test.tsx`
- Modify: `apps/web/src/app/career/calendar/page.tsx`
- Modify: `apps/web/src/app/career/calendar/page.test.tsx`
- Modify: `apps/web/src/app/career/companies/page.tsx`
- Modify: `apps/web/src/app/career/questions/page.tsx`
- Modify: `apps/web/src/app/career/questions/page.test.tsx`
- Modify: `apps/web/src/app/career/saved/page.tsx`
- Modify: `apps/web/src/app/career/saved/page.test.tsx`
- Modify: `apps/web/src/features/career/career-overview.tsx`
- Modify: `apps/web/src/features/career/career-overview.test.tsx`
- Modify: `apps/web/src/features/career/model.ts`
- Modify: `apps/web/src/features/career/model.test.ts`
- Modify: `apps/web/src/features/account/account-overview.tsx`
- Modify: `apps/web/src/features/account/account-overview.test.tsx`
- Modify: `apps/web/src/features/account/account-controls.tsx`
- Modify: `apps/web/src/features/account/profile-editor.tsx`
- Modify: `apps/web/src/features/authored-questions/authored-questions.tsx`
- Modify: `apps/web/src/features/authored-questions/authored-questions.test.tsx`
- Modify: `apps/web/src/features/saved-library/saved-library.tsx`
- Modify: `apps/web/src/features/saved-library/saved-library.test.tsx`
- Modify: `apps/web/src/features/saved-searches/saved-search-composer.tsx`
- Modify: `apps/web/src/features/saved-searches/saved-search-composer.test.tsx`
- Modify: `apps/web/src/features/saved-searches/saved-search-manager.tsx`
- Modify: `apps/web/src/features/saved-searches/saved-search-manager.test.tsx`
- Modify: `apps/web/src/features/saved-searches/use-saved-job-searches.ts`
- Modify: `apps/web/src/features/saved-searches/use-saved-job-searches.test.tsx`
- Modify: `apps/web/src/features/saved-searches/use-saved-search-evaluation.ts`
- Modify: `apps/web/src/features/saved-searches/use-saved-search-evaluation.test.tsx`
- Modify: `apps/web/src/features/hiring-calendar/hiring-calendar.tsx`
- Modify: `apps/web/src/features/hiring-calendar/hiring-calendar.test.tsx`
- Modify: `apps/web/src/features/hiring-calendar/model.ts`
- Modify: `apps/web/src/features/hiring-calendar/model.test.ts`
- Modify: `apps/web/src/features/companies/company-follow-button.tsx`
- Modify: `apps/web/src/features/companies/company-follow-button.test.tsx`
- Modify: `apps/web/src/features/companies/company-profile.tsx`
- Modify: `apps/web/src/features/companies/company-profile.test.tsx`
- Modify: `apps/web/src/features/companies/followed-companies.tsx`
- Modify: `apps/web/src/features/notifications/activity-notification-center.tsx`
- Modify: `apps/web/src/features/notifications/activity-notification-center.test.tsx`
- Modify: `apps/web/src/lib/activity-notifications.ts`
- Modify: `apps/web/src/lib/activity-notifications.test.ts`
- Modify: `apps/web/src/lib/job-application-stages.ts`
- Modify: `apps/web/src/lib/job-application-stages.test.ts`
- Modify: `apps/web/e2e/career-overview.e2e.ts`
- Modify: `apps/web/e2e/saved-library.e2e.ts`
- Modify: `apps/web/e2e/authored-questions.e2e.ts`
- Modify: `apps/web/e2e/company-profile.e2e.ts`

**Interfaces:**
- Consumes: `PRODUCT_TERMS.ownedSkills` and `PRODUCT_TERMS.savedItems`.
- Preserves: local/account merge semantics, alerts, application stages, followed companies, data export, account deletion, and legacy-community recovery.
- Produces: one language system across the personal workspace.

- [ ] **Step 1: Update career-workspace tests first**

Add these assertions to the relevant existing tests:

```tsx
expect(
  screen.getByRole("heading", { level: 1, name: "내 커리어" }),
).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "내 기술" })).toBeInTheDocument();
expect(screen.getByText("먼저 내 기술을 추가해 주세요.")).toBeInTheDocument();
expect(screen.getByText(/이 기기에 저장됨|계정에 저장됨/)).toBeInTheDocument();
expect(screen.queryByText(/내 스택|브라우저 저장 · 로그인 시 동기화/)).not.toBeInTheDocument();
```

For saved content, assert the heading `저장 목록`; for empty alerts, assert
`저장한 알림이 없습니다.` and the single next action `공고에서 알림 만들기`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd apps/web
npm test -- --run \
  src/app/career \
  src/features/career \
  src/features/account \
  src/features/authored-questions \
  src/features/saved-library \
  src/features/saved-searches \
  src/features/hiring-calendar \
  src/features/companies \
  src/features/notifications
```

Expected: FAIL on old owned-skill, storage, saved-library, empty-state, and tone strings.

- [ ] **Step 3: Rewrite the career overview around the user's next action**

Use these final values:

```ts
const CAREER_COPY = {
  pageTitle: "내 커리어",
  pageDescription: "내 기술과 채용공고를 비교해 다음에 준비할 기술을 찾습니다.",
  ownedSkills: PRODUCT_TERMS.ownedSkills,
  guestStorage: "이 기기에 저장됨",
  accountStorage: "계정에 저장됨",
  emptyTitle: "먼저 내 기술을 추가해 주세요.",
  emptyBody: "기술을 추가하면 맞는 공고와 다음에 배울 기술을 보여줍니다.",
  quickAdd: "추천 기술",
  comparison: "공고와 비교",
  limits: "이 결과는 합격 가능성이나 학습 순서를 예측하지 않습니다.",
};
```

Remove the separate `숫자를 읽는 방법` explanation when it repeats the page scope; keep
only `limits` next to the analysis-method and data-policy links.

- [ ] **Step 4: Apply the same voice to every personal subpage**

Use this table as the final empty/error language:

| Surface | Empty state | Next action |
| --- | --- | --- |
| Saved items | `저장한 항목이 없습니다.` | `공고 보기` |
| Alerts | `저장한 알림이 없습니다.` | `공고에서 알림 만들기` |
| Calendar | `표시할 채용 일정이 없습니다.` | `공고 보기` |
| Followed companies | `관심 기업이 없습니다.` | `공고에서 기업 보기` |
| Authored posts | `작성한 글이 없습니다.` | `글쓰기` |
| Notifications | `새 알림이 없습니다.` | No button; the state is already complete. |

Replace joined `해주세요`, casual `있어요`, and implementation phrases in all listed files.
Preserve a failure's useful durability facts, such as input being retained or a prior result
remaining visible. Use `저장 중…` and `불러오는 중…` for visible pending states.

- [ ] **Step 5: Run personal-workspace unit and E2E tests**

Run:

```bash
cd apps/web
npm test -- --run src/app/career src/features/career src/features/account \
  src/features/authored-questions src/features/saved-library \
  src/features/saved-searches src/features/hiring-calendar \
  src/features/companies src/features/notifications
npm run test:e2e -- \
  career-overview.e2e.ts \
  saved-library.e2e.ts \
  authored-questions.e2e.ts \
  company-profile.e2e.ts \
  --reporter=line
```

Expected: all selected tests PASS without changing storage or account behavior.

- [ ] **Step 6: Commit personal-workspace copy**

```bash
git add apps/web/src/app/career apps/web/src/features/career \
  apps/web/src/features/account apps/web/src/features/authored-questions \
  apps/web/src/features/saved-library apps/web/src/features/saved-searches \
  apps/web/src/features/hiring-calendar apps/web/src/features/companies \
  apps/web/src/features/notifications apps/web/e2e/career-overview.e2e.ts \
  apps/web/e2e/saved-library.e2e.ts apps/web/e2e/authored-questions.e2e.ts \
  apps/web/e2e/company-profile.e2e.ts
git commit -m "fix: simplify Korean career workspace copy"
```

---

### Task 8: Rewrite Trust Pages and Add the Full-Source Copy Contract

**Files:**
- Create: `apps/web/src/lib/ui-copy-contract.test.ts`
- Modify: `apps/web/src/app/privacy/page.tsx`
- Modify: `apps/web/src/app/privacy/clear-local-data.tsx`
- Modify: `apps/web/src/app/data-policy/page.tsx`
- Modify: `apps/web/src/app/methodology/page.tsx`
- Modify: `apps/web/src/app/corrections/page.tsx`
- Modify: `apps/web/src/app/trust-pages.test.tsx`
- Modify: `apps/web/src/features/sources/source-directory.tsx`

**Interfaces:**
- Consumes: the approved design document and the completed copy migrations from Tasks 1–7.
- Preserves: every disclosed storage field, public/private boundary, deletion behavior, source rule, and analysis limitation.
- Produces: a repository-level test that reports file, line, and forbidden phrase for regressions.

- [ ] **Step 1: Write the AST-based copy contract**

Create `src/lib/ui-copy-contract.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(process.cwd(), "src");
const ignoredSourceFiles = new Set([
  "features/home-feed/company-identity.ts",
  "features/home-feed/mock-community.ts",
  "features/home-feed/mock-post-details.ts",
]);

const forbidden = [
  "가입 여부와 관계없이",
  "이메일 확인으로 계정을 보호하고",
  "해주세요",
  "있어요",
  "보여드려요",
  "해보세요",
  "이어보세요",
  "복구 세션",
  "그래프 응답",
  "운영 DB",
  "브라우저 원본",
  "미분류",
  "구분 안 됨",
  "기술 맵",
  "내 스택",
  "...",
] as const;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolute);
    if (!/\.tsx?$/u.test(entry.name) || /\.(test|spec)\./u.test(entry.name)) {
      return [];
    }
    return [absolute];
  });
}

function visibleStringNodes(fileName: string) {
  const sourceText = readFileSync(fileName, "utf8");
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const values: Array<{ line: number; value: string }> = [];

  function visit(node: ts.Node) {
    let value = "";
    if (ts.isJsxText(node)) {
      value = node.getText(sourceFile).replace(/\s+/gu, " ").trim();
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      value = node.text;
    }
    if (/[가-힣]/u.test(value)) {
      values.push({
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        value,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return values;
}

describe("first-party Korean UX copy", () => {
  it("does not reintroduce rejected or inconsistent phrases", () => {
    const violations: string[] = [];

    for (const fileName of collectSourceFiles(sourceRoot)) {
      const relative = path.relative(sourceRoot, fileName).split(path.sep).join("/");
      if (ignoredSourceFiles.has(relative)) continue;

      for (const item of visibleStringNodes(fileName)) {
        for (const phrase of forbidden) {
          if (item.value.includes(phrase)) {
            violations.push(`${relative}:${item.line} contains ${JSON.stringify(phrase)}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the contract and verify RED on trust-page strings**

Run:

```bash
cd apps/web
npm test -- --run src/lib/ui-copy-contract.test.ts
```

Expected: FAIL on `운영 DB` in data policy and source-directory copy, `브라우저 원본` and
`내 스택` in privacy copy, and joined `해주세요` in the data-policy failure state.

- [ ] **Step 3: Rewrite policy prose without losing facts**

Apply these exact terminology changes:

```ts
const TRUST_COPY_REPLACEMENTS = {
  "운영 DB의 현재 상태": "서비스에 반영된 최신 상태",
  "브라우저 원본": "이 기기에 남은 글",
  "URL query": "주소에 포함된 검색 조건",
  "내 스택 저장": "내 기술 저장",
  "수집 출처 요약": "수집 현황",
  "운영 DB 기준 · 1분 자동 갱신": "서비스 반영 데이터 · 1분마다 갱신",
};
```

Split any trust-page paragraph longer than three sentences into separate paragraphs or a list,
but preserve every named data category, sync rule, public/private boundary, retry rule, and
deletion consequence. Keep the Supabase Auth disclosure because it explains credential handling.

Use `공고 화면에는 영향이 없습니다. 잠시 후 다시 확인해 주세요.` for a source-directory
failure that does not affect jobs. Use `조건에 맞는 기업이 없습니다. 검색어나 수집 상태를
바꿔 주세요.` for the source empty state.

Update `trust-pages.test.tsx` with the user-facing heading while retaining all storage-key and
deletion assertions:

```tsx
expect(
  screen.getByRole("heading", {
    level: 2,
    name: "주소에 포함된 검색 조건",
  }),
).toBeInTheDocument();
expect(screen.queryByRole("heading", { name: "URL query" })).not.toBeInTheDocument();
```

- [ ] **Step 4: Clear the trust-page contract violations**

Edit the reported strings only in `privacy/page.tsx`, `data-policy/page.tsx`, and
`source-directory.tsx`, using this deterministic mapping:

| Finding | Required transformation |
| --- | --- |
| `해주세요` | Insert the required space: `해 주세요`. |
| casual ending | Rewrite as a factual `~합니다` sentence or direct `~해 주세요` action. |
| implementation term | State the user-visible result, not the storage or transport mechanism. |
| old product term | Replace with the matching `PRODUCT_TERMS` value. |
| `...` | Replace with `…` only when it is rendered progress text. |

Then rerun the contract. If it reports a file owned by Tasks 1–7, stop and complete that earlier
task rather than folding unrelated work into this commit. Do not edit ignored source-data files or
user/employer content to satisfy the test.

- [ ] **Step 5: Run trust and contract tests and verify GREEN**

Run:

```bash
cd apps/web
npm test -- --run \
  src/app/trust-pages.test.tsx \
  src/lib/ui-copy-contract.test.ts
```

Expected: PASS with `violations` equal to `[]`.

- [ ] **Step 6: Commit trust copy and the regression contract**

```bash
git add \
  apps/web/src/app/privacy \
  apps/web/src/app/data-policy \
  apps/web/src/app/methodology \
  apps/web/src/app/corrections \
  apps/web/src/app/trust-pages.test.tsx \
  apps/web/src/features/sources \
  apps/web/src/lib/ui-copy-contract.test.ts
git commit -m "test: enforce natural Korean UI copy"
```

Before committing, inspect `git diff --cached --name-only`; it must contain no ignored fixture,
user-authored content, employer job content, generated asset, or unrelated file.

---

### Task 9: Verify Copy, Layout, Performance, and Production Build

**Files:**
- Evidence only: `/tmp/ejik-natural-korean-copy/*.png` and `/tmp/ejik-natural-korean-copy/server.log`; do not commit these files.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: evidence that copy changes did not break behavior, layout, accessibility, speed, or build output.

- [ ] **Step 1: Run formatting and repository integrity checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional branch changes are present.

- [ ] **Step 2: Run the complete unit suite**

Run:

```bash
cd apps/web
npm test -- --run
```

Expected: all Vitest files PASS with zero failed tests.

- [ ] **Step 3: Run lint and the production build**

Run:

```bash
cd apps/web
npm run lint
VERCEL=1 \
VERCEL_ENV=production \
VERCEL_PROJECT_PRODUCTION_URL=ejik-fit-web.vercel.app \
API_BASE_URL=https://ejik-fit-api.vercel.app \
npm run build
```

Expected: TypeScript and Next.js build complete with exit code 0.

- [ ] **Step 4: Run all browser tests**

Run:

```bash
cd apps/web
npm run test:e2e -- --reporter=line
```

Expected: all Playwright tests PASS, including authenticated community, desktop and mobile skill-map interaction, responsive service UI, and navigation.

- [ ] **Step 5: Run performance and dependency checks**

Run:

```bash
cd apps/web
npm run test:performance -- --reporter=line
npm audit --audit-level=high
```

Expected: all performance budgets PASS and npm reports zero high/critical vulnerabilities.

- [ ] **Step 6: Capture final desktop and mobile evidence**

Run the existing production build and capture viewport screenshots for `/login`, `/`, `/market`,
`/skills/graph`, `/jobs`, and `/career` at 390×844 and 1440×1000:

```bash
mkdir -p /tmp/ejik-natural-korean-copy
npm run start -- --hostname 127.0.0.1 > /tmp/ejik-natural-korean-copy/server.log 2>&1 &
audit_server_pid=$!
trap 'kill "$audit_server_pid" 2>/dev/null || true' EXIT
until curl --fail --silent http://127.0.0.1:3000/login > /dev/null; do sleep 1; done
node <<'NODE'
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const routes = [
    ["login", "/login"],
    ["home", "/"],
    ["market", "/market"],
    ["skills", "/skills/graph"],
    ["jobs", "/jobs"],
    ["career", "/career"],
  ];
  const viewports = [
    ["mobile", { width: 390, height: 844 }],
    ["desktop", { width: 1440, height: 1000 }],
  ];

  for (const [viewportName, viewport] of viewports) {
    for (const [routeName, route] of routes) {
      const page = await browser.newPage({ viewport });
      await page.goto(`http://127.0.0.1:3000${route}`, {
        waitUntil: "networkidle",
      });
      await page.screenshot({
        path: `/tmp/ejik-natural-korean-copy/${routeName}-${viewportName}.png`,
        fullPage: routeName === "login",
      });
      await page.close();
    }
  }

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
kill "$audit_server_pid"
trap - EXIT
```

Inspect all twelve images and confirm:

```text
- no wrapped button or tab label
- no empty panel left by deleted helper copy
- no clipped email, error, or empty-state message
- page headings and shared product terms match the approved glossary
- market legend explains 필수·우대 미표기
- skill-map graph remains visible and interactive
```

Store screenshots under `/tmp/ejik-natural-korean-copy/`; do not add them to Git.

- [ ] **Step 7: Hand off for branch completion**

Record the final commit, unit/E2E/performance totals, build result, and `npm audit` result. Use the
`finishing-a-development-branch` workflow to integrate and push without touching the dirty main
worktree.
