# 이직핏 공고 탐색·상세 밀도 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 API 공고 데이터와 기존 저장·필터 동작을 유지하면서 데스크톱과 모바일 첫 화면에서 공고 결과를 더 빨리 보여 주고, 공고 상세 제목과 지원 흐름을 실제 채용 서비스 수준의 밀도로 정리한다.

**Architecture:** 데이터 조회와 모델 코드는 변경하지 않고 `JobList`, `JobDetailView`, `JobDetailActions`의 마크업 계층과 CSS Module만 조정한다. Vitest 정적 스타일 계약으로 크기·표면 규칙을 고정하고 Playwright로 뷰포트 내 콘텐츠 노출, 줄바꿈, 터치 영역, 고정 액션과 하단 내비게이션의 관계를 검증한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, Playwright Chromium.

## Global Constraints

- 공고, 회사, 기술 수치는 기존 실제 API 경계를 유지하며 mock 데이터로 보강하지 않는다.
- 일반 페이지 제목은 데스크톱 32px, 모바일 28px을 넘지 않는다.
- 공고 상세 제목은 데스크톱 34px, 모바일 28px을 넘지 않는다.
- 본문 글꼴은 Pretendard 계열을 유지하고 한글 제목에는 `word-break: keep-all`을 적용한다.
- 터치 대상은 가로·세로 44px 이상을 유지한다.
- 1440x900 공고 화면에 실제 공고 2개 이상, 390x844 화면에 공고 1개 이상이 보여야 한다.
- 검색 파라미터, 저장한 공고, 내 기술 비교, 외부 원문 링크와 오류 상태 계약을 변경하지 않는다.
- 의미 없는 카드·pill·hover 부유 효과를 추가하지 않는다.

---

## 파일 구조

- Create: `apps/web/src/features/jobs/job-list.styles.test.ts` — 목록 제목, 단일 목록 표면, 모바일 2열 조건의 정적 계약.
- Create: `apps/web/src/app/jobs/[id]/job-detail.styles.test.ts` — 상세 제목 상한, 한글 줄바꿈, 모바일 고정 액션 여백의 정적 계약.
- Modify: `apps/web/e2e/jobs-explorer.e2e.ts` — 첫 화면 공고 노출과 계산 스타일 회귀 검증.
- Modify: `apps/web/e2e/job-detail.e2e.ts` — 상세 제목, 조건 우선순위, 모바일 액션 바 위치 검증.
- Modify: `apps/web/src/features/jobs/job-list.tsx` — 회사 로고 크기와 중복 상단 카피를 축약.
- Modify: `apps/web/src/features/jobs/job-list.module.css` — compact header/filter, 단일 구분선 목록, 2열 모바일 조건.
- Modify: `apps/web/src/app/jobs/[id]/job-detail.module.css` — compact hero/facts/content와 모바일 순서.
- Modify: `apps/web/src/features/jobs/job-detail-actions.module.css` — 데스크톱 sticky panel과 모바일 하단 액션 바.

### Task 1: 공고 목록 밀도 계약

**Files:**
- Create: `apps/web/src/features/jobs/job-list.styles.test.ts`
- Modify: `apps/web/e2e/jobs-explorer.e2e.ts`

**Interfaces:**
- Consumes: 현재 `JobList`의 `h1`, `.jobCard`, `.facts`, 접근 가능한 공고 링크.
- Produces: 목록 구현이 만족해야 할 계산 스타일과 첫 화면 노출 계약.

- [ ] **Step 1: 정적 스타일 실패 테스트 작성**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./job-list.module.css", import.meta.url), "utf8");

describe("job list service density", () => {
  it("uses the shared page title scale and one divided result surface", () => {
    expect(css).toContain("font-size: var(--type-page-title)");
    expect(css).toContain(".jobList {");
    expect(css).toContain("border: 1px solid var(--color-line)");
    expect(css).not.toContain("transform: translateY(-1px)");
  });

  it("keeps mobile job facts in two compact columns", () => {
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.facts \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run src/features/jobs/job-list.styles.test.ts`

Expected: FAIL because the current title is a 4.5rem clamp, cards lift independently, and mobile facts use one column.

- [ ] **Step 3: 실제 뷰포트 실패 기준 추가**

각 기존 폭 반복 안에서 다음 계산 스타일을 검증하고, 1440px에서는 첫 두 공고 제목의 하단이 900px 안쪽인지, 390px에서는 첫 공고 제목이 844px 안쪽인지 확인한다.

```ts
const pageTitleSize = await page
  .getByRole("heading", { level: 1, name: "공고 탐색" })
  .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
expect(pageTitleSize).toBeLessThanOrEqual(width <= 760 ? 28 : 32);

const titles = page.locator("article h3");
const requiredVisibleTitles = width === 1440 ? 2 : width === 390 ? 1 : 0;
for (let index = 0; index < requiredVisibleTitles; index += 1) {
  const box = await titles.nth(index).boundingBox();
  expect((box?.y ?? 901) + (box?.height ?? 0)).toBeLessThanOrEqual(900);
}
```

- [ ] **Step 4: E2E 실패 확인**

Run: `npm run test:e2e -- e2e/jobs-explorer.e2e.ts --reporter=line`

Expected: FAIL on the current oversized title and delayed result position.

- [ ] **Step 5: 테스트 커밋**

```bash
git add apps/web/src/features/jobs/job-list.styles.test.ts apps/web/e2e/jobs-explorer.e2e.ts
git commit -m "test: define compact jobs explorer contract"
```

### Task 2: 공고 목록 구현

**Files:**
- Modify: `apps/web/src/features/jobs/job-list.tsx`
- Modify: `apps/web/src/features/jobs/job-list.module.css`
- Test: `apps/web/src/features/jobs/job-list.styles.test.ts`
- Test: `apps/web/src/features/jobs/job-list.test.tsx`

**Interfaces:**
- Consumes: `PostingSummary`, `CompanyMark`, 현재 URL 기반 `<form method="get">`, 저장/내 기술 상태.
- Produces: 동일한 링크와 상태를 가진 compact divided job list.

- [ ] **Step 1: 마크업 밀도 축약**

`JobItem`의 회사 로고를 40px로 바꾸고, 제목/회사/저장 버튼의 의미와 링크는 그대로 둔다.

```tsx
<CompanyMark
  companyName={job.company_name}
  size={40}
  sourceUrl={job.source_url}
/>
```

상단 eyebrow는 `검증된 공식 채용 데이터` 한 번만 유지하고 소개 문장은 한 줄 길이로 제한한다. API에서 계산한 결과·기업·최근 확인 값은 그대로 사용한다.

- [ ] **Step 2: compact CSS 구현**

다음 규칙을 기준으로 기존 CSS를 교체한다.

```css
.main { padding-top: 2rem; }
.intro h1 { font-size: var(--type-page-title); font-weight: 700; line-height: 1.25; }
.workspace { grid-template-columns: 15rem minmax(0, 1fr); gap: 1.25rem; margin-top: 1.5rem; }
.jobList { gap: 0; border: 1px solid var(--color-line); border-radius: var(--radius-panel); background: var(--color-surface); }
.jobCard { border: 0; border-bottom: 1px solid var(--color-line); border-radius: 0; }
.jobCard:hover { background: var(--color-surface-subtle); }
.identity h3 { font-size: var(--type-item-title); font-weight: 600; }
```

390px에서는 소개/요약/필터 간격을 줄이고, 필터 신뢰 문구를 숨기며, 네 가지 조건을 2열로 표시한다. 링크와 form control은 44px을 유지한다.

```css
@media (max-width: 680px) {
  .main { padding-top: 1.25rem; }
  .intro h1 { font-size: 1.75rem; }
  .summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .filterPanel > header, .trustNote { display: none; }
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

- [ ] **Step 3: 목록 단위 테스트 통과 확인**

Run: `npm test -- --run src/features/jobs/job-list.styles.test.ts src/features/jobs/job-list.test.tsx`

Expected: PASS with existing filter, save, company and error-state assertions unchanged.

- [ ] **Step 4: 목록 브라우저 테스트 통과 확인**

Run: `npm run test:e2e -- e2e/jobs-explorer.e2e.ts --reporter=line`

Expected: all jobs explorer tests PASS at 1440, 820, 600 and 390px.

- [ ] **Step 5: 구현 커밋**

```bash
git add apps/web/src/features/jobs/job-list.tsx apps/web/src/features/jobs/job-list.module.css
git commit -m "style: turn jobs explorer into a compact results workspace"
```

### Task 3: 공고 상세 밀도 계약

**Files:**
- Create: `apps/web/src/app/jobs/[id]/job-detail.styles.test.ts`
- Modify: `apps/web/e2e/job-detail.e2e.ts`

**Interfaces:**
- Consumes: `JobDetailView`의 h1, 채용 조건, `JobDetailActions`의 지원 링크와 모바일 내비게이션.
- Produces: 상세 제목 상한, 한글 줄바꿈과 모바일 액션 안전 영역 계약.

- [ ] **Step 1: 정적 스타일 실패 테스트 작성**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detailCss = readFileSync(new URL("./job-detail.module.css", import.meta.url), "utf8");
const actionCss = readFileSync(new URL("../../../features/jobs/job-detail-actions.module.css", import.meta.url), "utf8");

describe("job detail service density", () => {
  it("caps and safely wraps the posting title", () => {
    expect(detailCss).toContain("font-size: var(--type-detail-title)");
    expect(detailCss).toContain("word-break: keep-all");
  });

  it("reserves mobile space for the fixed action bar above navigation", () => {
    expect(actionCss).toMatch(/@media \(max-width: 680px\)[\s\S]*?position: fixed/);
    expect(actionCss).toContain("bottom: var(--mobile-nav-height)");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run 'src/app/jobs/[id]/job-detail.styles.test.ts'`

Expected: FAIL because the current hero uses a 4.75rem clamp and the action panel is static on mobile.

- [ ] **Step 3: E2E 계산 스타일 기준 추가**

```ts
const titleSize = await page.getByRole("heading", { level: 1 }).evaluate(
  (element) => parseFloat(getComputedStyle(element).fontSize),
);
expect(titleSize).toBeLessThanOrEqual(width <= 680 ? 28 : 34);
expect(await page.getByRole("heading", { level: 1 }).evaluate(
  (element) => getComputedStyle(element).wordBreak,
)).toBe("keep-all");
```

390px에서는 `채용 조건`이 `출처와 검증`보다 위에 있고, 지원 링크의 하단이 모바일 내비게이션 상단을 넘지 않으며 action region의 계산 위치가 `fixed`인지 검증한다.

- [ ] **Step 4: E2E 실패 확인**

Run: `npm run test:e2e -- e2e/job-detail.e2e.ts --reporter=line`

Expected: FAIL on title size, ordering and fixed action behavior.

- [ ] **Step 5: 테스트 커밋**

```bash
git add 'apps/web/src/app/jobs/[id]/job-detail.styles.test.ts' apps/web/e2e/job-detail.e2e.ts
git commit -m "test: define compact job detail contract"
```

### Task 4: 공고 상세와 모바일 액션 구현

**Files:**
- Modify: `apps/web/src/app/jobs/[id]/job-detail.module.css`
- Modify: `apps/web/src/features/jobs/job-detail-actions.module.css`
- Test: `apps/web/src/app/jobs/[id]/job-detail.styles.test.ts`
- Test: `apps/web/src/app/jobs/[id]/page.test.tsx`
- Test: `apps/web/src/features/jobs/job-detail-actions.test.tsx`

**Interfaces:**
- Consumes: 현재 상세 DOM 순서와 `--mobile-nav-height`, `--type-detail-title`, `--touch-target` 토큰.
- Produces: desktop sticky support panel and mobile fixed apply/save bar with facts-first reading flow.

- [ ] **Step 1: 상세 hero와 본문 간격 구현**

```css
.main { padding-top: 1.75rem; }
.article { margin-top: 1.25rem; }
.heroIdentity h1 {
  max-width: 32ch;
  margin-top: 0.25rem;
  font-size: var(--type-detail-title);
  font-weight: 700;
  line-height: 1.3;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.factsSection { margin-top: 1.75rem; }
.workspace { gap: 2rem; margin-top: 2rem; }
.sectionHeader h2 { font-size: var(--type-section-title); }
```

- [ ] **Step 2: 모바일 순서와 고정 액션 구현**

모바일 article 순서를 hero → facts → trust/stack → skill evidence → description으로 바꾼다. `.panel`은 하단 내비게이션 바로 위에 고정하고 header와 stack comparison을 숨겨 apply/save 두 액션만 표시한다. 본문 하단에는 두 고정 바의 높이를 포함한 padding을 둔다.

```css
@media (max-width: 680px) {
  .main { padding-bottom: calc(var(--mobile-nav-height) + 5.5rem); }
  .heroIdentity h1 { font-size: 1.75rem; }
  .factsSection { grid-row: 2; }
  .sidebar { grid-row: 3; }
  .content { grid-row: 4; }
}
```

```css
@media (max-width: 680px) {
  .panel {
    position: fixed;
    right: 0;
    bottom: var(--mobile-nav-height);
    left: 0;
    z-index: calc(var(--layer-mobile-nav) - 1);
    grid-template-columns: minmax(0, 1fr) var(--touch-target);
  }
  .header, .overlap { display: none; }
}
```

- [ ] **Step 3: 상세 단위 테스트 통과 확인**

Run: `npm test -- --run 'src/app/jobs/[id]/job-detail.styles.test.ts' 'src/app/jobs/[id]/page.test.tsx' src/features/jobs/job-detail-actions.test.tsx`

Expected: PASS while JSON-LD, official source, save persistence and exact skill overlap remain intact.

- [ ] **Step 4: 상세 브라우저 테스트 통과 확인**

Run: `npm run test:e2e -- e2e/job-detail.e2e.ts --reporter=line`

Expected: all detail tests PASS at 1440, 820, 600 and 390px with no overflow.

- [ ] **Step 5: 구현 커밋**

```bash
git add 'apps/web/src/app/jobs/[id]/job-detail.module.css' apps/web/src/features/jobs/job-detail-actions.module.css
git commit -m "style: make job detail compact and action-oriented"
```

### Task 5: 실제 브라우저 검수와 배포

**Files:**
- Modify only if inspection exposes a verified defect in the files already listed above.

**Interfaces:**
- Consumes: completed list/detail implementation.
- Produces: verified branch ready for `main`.

- [ ] **Step 1: 실제 화면 캡처**

Playwright fixture 서버에서 `/jobs`와 대표 상세를 1440x900, 1024x768, 390x844로 캡처한다. 목록은 1440에서 두 공고 제목, 390에서 첫 공고 제목이 첫 viewport 안에 있어야 한다. 상세 제목은 낱글자로 끊기지 않고 모바일 지원 바가 하단 내비게이션 위에 있어야 한다.

- [ ] **Step 2: 전체 검증**

Run: `npm test -- --run --reporter=dot`

Expected: all Vitest files PASS.

Run: `npm run lint`

Expected: TypeScript exits 0.

Run: `VERCEL=1 VERCEL_ENV=production VERCEL_PROJECT_PRODUCTION_URL=ejik-fit-web.vercel.app API_BASE_URL=https://ejik-fit-api.vercel.app npm run build`

Expected: production build and `/_not-found` page collection PASS.

Run: `npm run test:e2e -- --reporter=line`

Expected: all Playwright tests PASS with one worker.

- [ ] **Step 3: 검수 수정 커밋**

실제 화면에서 확인된 결함만 수정한 경우 관련 파일과 테스트를 커밋한다.

```bash
git add apps/web
git commit -m "fix: polish responsive jobs presentation"
```

- [ ] **Step 4: main 통합과 배포 확인**

원격 `main`을 fetch하고 충돌이 없으면 fast-forward 병합한 뒤 병합 결과에서 테스트를 다시 실행한다. `git push origin main` 후 원격 SHA, Vercel 상태와 실제 프로덕션 워드마크/공고 화면을 확인한다.
