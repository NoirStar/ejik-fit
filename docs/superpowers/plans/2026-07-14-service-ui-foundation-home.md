# Service UI Foundation and Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pretendard 기반의 조밀한 전역 시각 체계, 한글 이직핏 워드마크, 64px 단일 데스크톱 헤더, 실제 콘텐츠가 먼저 보이는 홈 피드를 구현한다.

**Architecture:** 기존 Next.js App Router, React 19, CSS Modules, semantic CSS token, Phosphor 구조를 유지한다. 전역 token과 typography를 먼저 고정하고 AppShell과 BrandMark가 이를 소비하게 만든 뒤, HomeFeed의 데이터·상호작용 로직은 그대로 둔 채 DOM 위계와 CSS 표현만 정돈한다.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.8, CSS Modules, Vitest, Testing Library, Playwright 1.61

## Global Constraints

- 승인 설계: `docs/superpowers/specs/2026-07-14-service-ui-density-redesign-design.md`
- 정보와 기능을 추가하지 않는다.
- 커뮤니티 fixture는 기존 mock 경계를 유지한다.
- 공고, 기술 시장 수치, 스킬 그래프는 실제 API 경계를 유지한다.
- 전역 제품 글꼴은 Pretendard Variable이다.
- 일반 페이지 제목은 데스크톱 32px, 모바일 28px을 넘지 않는다.
- 포인트 색은 단일 바이올렛을 활성 상태와 핵심 행동에만 사용한다.
- 데스크톱 헤더는 한 줄 64px, 모바일 상단 바는 56px이다.
- 전역 셸 최대 폭은 1280px, 모바일 좌우 여백은 16px이다.
- 모든 터치 대상은 최소 44px이다.
- 이번 배치에서 favicon은 교체하지 않는다.
- URL, 주요 내비게이션 라벨, 저장 상태와 API 계약을 변경하지 않는다.
- DESIGN_VARIANCE 4 / MOTION_INTENSITY 2 / VISUAL_DENSITY 7
- 기존 CSS Modules와 Phosphor를 유지하며 새 UI 프레임워크나 모션 의존성을 추가하지 않는다.
- 시각 확인은 1440x900, 1024x768, 390x844에서 수행한다.

---

## File Structure

### Modify

- `apps/web/src/styles/tokens.css`: 색상, 크기, 레이어, 공통 타이포 토큰의 단일 출처
- `apps/web/src/styles/typography.css`: Pretendard 우선순위와 숫자 표현
- `apps/web/src/app/globals.css`: body 글꼴 충돌, legacy dark override, 전역 브랜드 스타일 제거
- `apps/web/src/components/brand/brand-mark.tsx`: 기존 심볼과 영문 부제를 한글 워드마크로 교체
- `apps/web/src/components/app-shell/app-shell.tsx`: 데스크톱 헤더를 단일 행으로 재배치
- `apps/web/src/components/app-shell/app-shell.module.css`: 64px/56px 헤더, 단일 행 내비게이션, 알림 레이어
- `apps/web/src/features/home-feed/home-feed.tsx`: 중복 eyebrow와 설명 제거, 간결한 홈 제목 유지
- `apps/web/src/features/home-feed/home-feed.module.css`: 3열 셸, 구분선 기반 피드, 조밀한 레일과 모바일 흐름
- `apps/web/src/styles/design-system.test.ts`: 토큰, Pretendard, 라이트 테마 계약
- `apps/web/src/components/app-shell/app-shell.test.tsx`: 워드마크와 헤더 구조 계약
- `apps/web/src/features/home-feed/home-feed.test.tsx`: 중복 소개 문구 제거와 기존 작성 동작 보존
- `apps/web/e2e/header-brand-lockup.e2e.ts`: 새 워드마크, 단일 헤더, 알림 위치 검증

### Create

- `apps/web/src/components/brand/brand-mark.test.tsx`: 한글 워드마크 단위 테스트
- `apps/web/src/features/home-feed/home-feed.styles.test.ts`: 홈 밀도 CSS 계약
- `apps/web/e2e/service-ui-foundation.e2e.ts`: 데스크톱·모바일 실제 계산 스타일과 첫 화면 콘텐츠 검증

## Interfaces

### Shared CSS tokens

```css
--type-page-title: 2rem;
--type-detail-title: 2.125rem;
--type-section-title: 1.25rem;
--type-item-title: 1.0625rem;
--type-body: 0.9375rem;
--type-support: 0.875rem;
--type-meta: 0.8125rem;
--header-height-desktop: 4rem;
--header-height-mobile: 3.5rem;
--layer-header: 30;
--layer-mobile-nav: 35;
--layer-popover: 40;
--layer-dialog: 80;
```

### BrandMark contract

```tsx
type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};
```

`showWordmark=true`은 이직과 핏을 분리한 한글 워드마크를 렌더링한다. `showWordmark=false`는 기존 호출 호환을 위해 색상 핏 글자만 렌더링한다. 장식 글자는 `aria-hidden=true`이고 링크의 기존 `aria-label="이직핏 홈"`이 접근 가능한 이름을 제공한다.

---

### Task 1: Global typography, color, spacing, and layer tokens

**Files:**

- Modify: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles/typography.css`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/styles/design-system.test.ts`

**Interfaces:**

- Consumes: RootLayout의 기존 import 순서
- Produces: 모든 후속 CSS가 소비하는 공통 type, color, size, layer token

- [ ] **Step 1: Write the failing foundation tests**

`design-system.test.ts`의 첫 번째 테스트를 다음 계약으로 교체하고 body 테스트를 추가한다.

```ts
it("defines the approved light service tokens and local Korean font", () => {
  const tokens = read("src/styles/tokens.css");
  const typography = read("src/styles/typography.css");
  const globals = read("src/app/globals.css");

  for (const token of [
    "--color-bg: #f7f7fa",
    "--color-surface: #ffffff",
    "--color-text: #17171c",
    "--color-muted: #62626d",
    "--color-faint: #8b8b96",
    "--color-line: #e7e7ec",
    "--color-accent: #6d4be8",
    "--header-height-desktop: 4rem",
    "--header-height-mobile: 3.5rem",
    "--content-max: 80rem",
    "--type-page-title: 2rem",
    "--type-detail-title: 2.125rem",
    "--type-item-title: 1.0625rem",
    "--type-body: 0.9375rem",
    "--type-meta: 0.8125rem",
    "--layer-header: 30",
    "--layer-popover: 40",
  ]) {
    expect(tokens).toContain(token);
  }

  expect(tokens).not.toContain("@media (prefers-color-scheme: dark)");
  expect(typography).toContain("/fonts/PretendardVariable.woff2");
  expect(typography).toContain("font-display: swap");
  expect(typography).toContain(
    '--font-korean: "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
  );
  expect(globals).not.toContain("@media (prefers-color-scheme: dark)");
});

it("keeps Pretendard as the computed body family instead of Geist", () => {
  const globals = read("src/app/globals.css");
  const bodyRule = globals.match(/body\s*\{([^}]*)\}/)?.[1] ?? "";

  expect(bodyRule).toContain("font-family: var(--font-korean);");
  expect(bodyRule).toContain("font-size: var(--type-body);");
  expect(bodyRule).not.toContain("var(--font-geist)");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
cd apps/web
npm test -- src/styles/design-system.test.ts --run
```

Expected: FAIL because the current tokens still use `#f6f7f9`, the header height is `7rem`, globals contains dark overrides, and body uses Geist.

- [ ] **Step 3: Implement the approved token and typography foundation**

Set `tokens.css` to:

```css
:root {
  color-scheme: light;
  --color-bg: #f7f7fa;
  --color-surface: #ffffff;
  --color-surface-subtle: #fbfbfc;
  --color-surface-muted: #f1f1f5;
  --color-brand-subtle: #f1edff;
  --color-text: #17171c;
  --color-muted: #62626d;
  --color-faint: #8b8b96;
  --color-line: #e7e7ec;
  --color-line-soft: #efeff3;
  --color-accent: #6d4be8;
  --color-accent-strong: #5638c6;
  --color-info: #4f6bed;
  --color-success: #14804a;
  --color-warning: #a95b10;
  --color-danger: #c9362b;
  --color-graph: #07111d;
  --radius-control: 0.625rem;
  --radius-panel: 0.75rem;
  --radius-overlay: 1rem;
  --shadow-overlay: 0 1rem 2.5rem rgb(35 31 49 / 0.14);
  --touch-target: 2.75rem;
  --header-height-desktop: 4rem;
  --header-height-mobile: 3.5rem;
  --mobile-nav-height: 4.25rem;
  --content-max: 80rem;
  --type-page-title: 2rem;
  --type-detail-title: 2.125rem;
  --type-section-title: 1.25rem;
  --type-item-title: 1.0625rem;
  --type-body: 0.9375rem;
  --type-support: 0.875rem;
  --type-meta: 0.8125rem;
  --layer-header: 30;
  --layer-mobile-nav: 35;
  --layer-popover: 40;
  --layer-dialog: 80;
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
}
```

Set `typography.css` to keep Pretendard first for both text and numeric content:

```css
@font-face {
  font-family: "Pretendard Variable";
  font-style: normal;
  font-weight: 45 920;
  font-display: swap;
  src: url("/fonts/PretendardVariable.woff2") format("woff2-variations");
}

:root {
  --font-korean: "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
}

body,
button,
input,
select,
textarea {
  font-family: var(--font-korean);
}

[data-numeric] {
  font-family: var(--font-korean);
  font-variant-numeric: tabular-nums;
}
```

In `globals.css`:

1. Keep the light semantic aliases in `:root`.
2. Remove every `@media (prefers-color-scheme: dark)` block.
3. Change body to `font-family: var(--font-korean)` and `font-size: var(--type-body)`.
4. Keep `line-height: 1.6`, focus treatment, reset, legacy route selectors, and functional overflow rules.
5. Do not change route copy or data rendering.

- [ ] **Step 4: Run the focused and full design tests and verify GREEN**

Run:

```bash
cd apps/web
npm test -- src/styles/design-system.test.ts src/styles/skill-graph-layout.test.ts --run
```

Expected: PASS with no warnings.

- [ ] **Step 5: Commit the foundation**

```bash
git add apps/web/src/styles/tokens.css apps/web/src/styles/typography.css apps/web/src/app/globals.css apps/web/src/styles/design-system.test.ts
git commit -m "style: establish compact service typography"
```

---

### Task 2: Korean wordmark, single-row header, and correctly layered menus

**Files:**

- Create: `apps/web/src/components/brand/brand-mark.test.tsx`
- Modify: `apps/web/src/components/brand/brand-mark.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.module.css`
- Modify: `apps/web/src/components/app-shell/app-shell.test.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/styles/design-system.test.ts`
- Modify: `apps/web/e2e/header-brand-lockup.e2e.ts`

**Interfaces:**

- Consumes: Task 1의 header, color, radius, layer token
- Produces: 한 줄 데스크톱 헤더, 56px 모바일 헤더, 텍스트 워드마크, 헤더 아래 popover

- [ ] **Step 1: Write failing BrandMark and AppShell tests**

Create `brand-mark.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("renders the approved Korean wordmark without the old symbol or English subtitle", () => {
    const { container } = render(<BrandMark size="sm" />);

    expect(screen.getByText("이직")).toBeInTheDocument();
    expect(screen.getByText("핏")).toBeInTheDocument();
    expect(screen.queryByText("EJIK FIT")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector(".brand-lockup__mark")).not.toBeInTheDocument();
  });

  it("keeps a compact fit glyph when the full wordmark is disabled", () => {
    render(<BrandMark showWordmark={false} />);

    expect(screen.queryByText("이직")).not.toBeInTheDocument();
    expect(screen.getByText("핏")).toBeInTheDocument();
  });
});
```

Add to `app-shell.test.tsx`:

```tsx
it("places the desktop navigation inside the single header row", () => {
  const { container } = render(
    <AppShell>
      <main>내용</main>
    </AppShell>,
  );

  const header = container.querySelector("header");
  const row = header?.firstElementChild;
  expect(row).not.toBeNull();
  expect(row?.querySelector('nav[aria-label="주요 탐색"]')).toBeInTheDocument();
  expect(screen.getByText("이직")).toBeInTheDocument();
  expect(screen.getByText("핏")).toBeInTheDocument();
  expect(screen.queryByText("EJIK FIT")).not.toBeInTheDocument();
});
```

Replace the old narrow-brand source assertion in `design-system.test.ts` with:

```ts
it("keeps the Korean wordmark visible without the retired symbol", () => {
  const globals = read("src/app/globals.css");

  expect(globals).toContain(".brand-lockup__ink");
  expect(globals).toContain(".brand-lockup__accent");
  expect(globals).not.toContain(".brand-lockup__mark");
  expect(globals).not.toContain(".brand-lockup__copy");
  expect(globals).not.toContain("@media (max-width: 340px)");
});
```

- [ ] **Step 2: Run the unit tests and verify RED**

Run:

```bash
cd apps/web
npm test -- src/components/brand/brand-mark.test.tsx src/components/app-shell/app-shell.test.tsx --run
```

Expected: FAIL because BrandMark still renders an image and English subtitle, and desktop navigation is outside the utility row.

- [ ] **Step 3: Implement the Korean wordmark**

Replace the BrandMark render body with:

```tsx
return (
  <span
    aria-hidden="true"
    className={`brand-lockup brand-lockup--${size} ${className}`.trim()}
  >
    {showWordmark && <span className="brand-lockup__ink">이직</span>}
    <span className="brand-lockup__accent">핏</span>
  </span>
);
```

Remove the `next/image` import. In `globals.css`, replace the old mark, copy, English subtitle, shadow, dark-mode, and narrow-screen hiding rules with:

```css
.brand-lockup {
  display: inline-flex;
  align-items: baseline;
  color: var(--color-text);
  font-size: 1.625rem;
  font-weight: 820;
  letter-spacing: -0.105em;
  line-height: 1;
  white-space: nowrap;
}

.brand-lockup__ink,
.brand-lockup__accent {
  display: inline-block;
  transform-origin: center bottom;
}

.brand-lockup__ink {
  transform: rotate(-0.8deg);
}

.brand-lockup__accent {
  color: var(--color-accent);
  font-weight: 880;
  transform: translateY(0.04em) rotate(1.2deg);
}

.brand-lockup--sm {
  font-size: 1.5rem;
}

.brand-lockup--lg {
  font-size: 2rem;
}
```

- [ ] **Step 4: Move navigation into the header row**

In `app-shell.tsx`, move the existing `desktopNav` nav between HeaderSearchForm and `utilities` inside `utilityRow`. Keep NAV_ITEMS, labels, hrefs, icons, active state, and click handlers unchanged. Delete only the now-empty second header row.

In `app-shell.module.css` implement:

```css
.header {
  position: sticky;
  top: 0;
  z-index: var(--layer-header);
  height: var(--header-height-desktop);
  border-bottom: 1px solid var(--color-line);
  background: color-mix(in srgb, var(--color-surface) 97%, transparent);
  backdrop-filter: blur(14px);
}

.utilityRow {
  display: grid;
  width: min(calc(100% - 3rem), var(--content-max));
  height: 100%;
  grid-template-columns: auto minmax(12rem, 20rem) minmax(24rem, 1fr) auto;
  align-items: center;
  gap: 1rem;
  margin: 0 auto;
}

.desktopNav {
  min-width: 0;
  height: 100%;
}

.navInner {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: stretch;
  justify-content: center;
  margin: 0;
}

.navItem {
  min-width: 4.75rem;
  padding: 0 0.625rem;
  font-size: var(--type-meta);
}

.menu {
  z-index: var(--layer-popover);
  top: calc(100% + 0.625rem);
  box-shadow: var(--shadow-overlay);
}
```

Delete the desktop `top: calc(100% + 4.125rem)` menu override. At `max-width: 1040px`, hide `utilityLabel`, `userLabel`, and `userCaret`. At `max-width: 820px`:

```css
.header {
  height: var(--header-height-mobile);
}

.utilityRow {
  width: 100%;
  height: 100%;
  padding: 0 0.75rem;
}

.desktopNav,
.stackButton {
  display: none;
}

.content {
  min-height: calc(100dvh - var(--header-height-mobile));
}

.menu {
  position: fixed;
  top: calc(var(--header-height-mobile) + 0.5rem);
  right: 0.75rem;
}
```

Delete the later `top: 4.5rem` mobile menu override so the token-based top value remains authoritative.

Keep search expansion, write, notification, user menu, mobile bottom navigation, focus, Escape, outside click, and OwnedSkillsSheet logic unchanged.

- [ ] **Step 5: Rewrite the browser contract for the new header**

In `header-brand-lockup.e2e.ts`:

1. Keep widths 390, 360, 350, 341, 340, 320.
2. Assert `.brand-lockup__ink` and `.brand-lockup__accent` are visible at every width.
3. Assert no `.brand-lockup__mark` and no `EJIK FIT`.
4. Remove the mobile stack-button target because mobile reaches skills through 내 정보.
5. Keep brand, search, write, notification, and user controls at least 44x44.
6. Assert no horizontal overflow.
7. Rename the desktop menu test to `keeps utility menus below the single desktop header`.
8. Assert header height is at most 64px and each menu y is at least header bottom plus 8px.

- [ ] **Step 6: Run unit and browser tests and verify GREEN**

Run:

```bash
cd apps/web
npm test -- src/components/brand/brand-mark.test.tsx src/components/app-shell/app-shell.test.tsx src/styles/design-system.test.ts --run
npx playwright test e2e/header-brand-lockup.e2e.ts
```

Expected: all tests PASS, all six mobile widths have no horizontal overflow, and both desktop menus open below the header.

- [ ] **Step 7: Commit the brand and shell**

```bash
git add apps/web/src/components/brand/brand-mark.tsx apps/web/src/components/brand/brand-mark.test.tsx apps/web/src/components/app-shell/app-shell.tsx apps/web/src/components/app-shell/app-shell.module.css apps/web/src/components/app-shell/app-shell.test.tsx apps/web/src/app/globals.css apps/web/src/styles/design-system.test.ts apps/web/e2e/header-brand-lockup.e2e.ts
git commit -m "feat: introduce compact Korean brand shell"
```

---

### Task 3: Editorial home density without changing feed behavior

**Files:**

- Create: `apps/web/src/features/home-feed/home-feed.styles.test.ts`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Create: `apps/web/e2e/service-ui-foundation.e2e.ts`

**Interfaces:**

- Consumes: Task 1 type tokens and Task 2 compact header
- Produces: 1280px 3열 홈, 구분선 기반 중앙 피드, 390px 단일 흐름

- [ ] **Step 1: Write the failing home content and style tests**

Add to `home-feed.test.tsx`:

```tsx
it("keeps a concise service heading without the redundant AI-style eyebrow", () => {
  render(<HomeFeed snapshot={snapshot} />);

  expect(
    screen.getByRole("heading", { name: "내 커리어와 가까운 이야기" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("커뮤니티 예시 + 공식 채용 데이터"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      "현업의 고민과 면접 경험 사이에 확인 가능한 공고 근거를 함께 놓았습니다.",
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "커뮤니티 글쓰기" }),
  ).toBeInTheDocument();
});
```

Create `home-feed.styles.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "src/features/home-feed/home-feed.module.css"),
  "utf8",
);

function rule(selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("home feed service density", () => {
  it("uses the approved compact shell and sticky offset", () => {
    const rails =
      css.match(/\.leftRail,\s*\.rightRail\s*\{([^}]*)\}/s)?.[1] ?? "";

    expect(rule("layout")).toContain("width: min(calc(100% - 3rem), var(--content-max));");
    expect(rule("layout")).toContain(
      "grid-template-columns: 13.5rem minmax(0, 1fr) 17.5rem;",
    );
    expect(rails).toContain(
      "top: calc(var(--header-height-desktop) + 1.25rem);",
    );
  });

  it("renders one divided feed surface instead of floating cards", () => {
    const cards =
      css.match(
        /\.socialCard,\s*\.jobCard,\s*\.marketCard\s*\{([^}]*)\}/s,
      )?.[1] ?? "";
    const titles =
      css.match(
        /\.cardCopy h2,\s*\.jobIdentity h2,\s*\.marketBody h2\s*\{([^}]*)\}/s,
      )?.[1] ?? "";

    expect(rule("feedList")).toContain("gap: 0;");
    expect(rule("feedList")).toContain("overflow: hidden;");
    expect(cards).toContain("border: 0;");
    expect(cards).toContain("border-bottom: 1px solid var(--color-line-soft);");
    expect(titles).toContain("font-size: var(--type-item-title);");
  });

  it("uses a text-active tab instead of a filled purple pill", () => {
    const active = css.match(/\.tabs button\[data-active="true"\]\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(active).toContain("background: transparent;");
    expect(active).toContain("color: var(--color-accent-strong);");
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd apps/web
npm test -- src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts --run
```

Expected: FAIL because the eyebrow and description still render, the home width is 88.75rem, feed cards are separated by gaps, and the active tab is a filled pill.

- [ ] **Step 3: Simplify the home header without removing its action**

In `home-feed.tsx`, keep the `feedHeader`, h1, composer button, ref, and click handler. Remove only:

```tsx
<p className={styles.eyebrow}>커뮤니티 예시 + 공식 채용 데이터</p>
<p>현업의 고민과 면접 경험 사이에 확인 가능한 공고 근거를 함께 놓았습니다.</p>
```

Do not change tab state, composer behavior, context filters, feed ordering, save, reaction, follow, or API-backed items.

- [ ] **Step 4: Implement the compact home shell and divided feed**

Apply these exact structural rules in `home-feed.module.css`:

```css
.page {
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 1.25rem 0 3rem;
  background: var(--color-bg);
  color: var(--color-text);
}

.layout {
  display: grid;
  width: min(calc(100% - 3rem), var(--content-max));
  grid-template-columns: 13.5rem minmax(0, 1fr) 17.5rem;
  align-items: start;
  gap: 1.25rem;
  margin-inline: auto;
}

.leftRail,
.rightRail {
  position: sticky;
  top: calc(var(--header-height-desktop) + 1.25rem);
  display: grid;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.railCard,
.trustCard {
  padding: 1rem;
  border: 0;
  border-bottom: 1px solid var(--color-line-soft);
  border-radius: 0;
  background: transparent;
}

.leftRail > :last-child,
.rightRail > :last-child {
  border-bottom: 0;
}

.feedHeader {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0.25rem 0.75rem;
}

.feedHeader h1 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.3;
}

.tabs {
  min-height: 2.75rem;
  padding: 0 0.5rem;
  border-radius: var(--radius-panel);
}

.tabs button {
  min-width: 4.75rem;
  min-height: 2.75rem;
  border-radius: 0;
  font-size: var(--type-meta);
}

.tabs button[data-active="true"] {
  background: transparent;
  color: var(--color-accent-strong);
  box-shadow: inset 0 -2px var(--color-accent);
}

.feedList {
  display: grid;
  gap: 0;
  overflow: hidden;
  margin-top: 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.socialCard,
.jobCard,
.marketCard {
  min-width: 0;
  padding: 1.125rem 1.25rem;
  border: 0;
  border-bottom: 1px solid var(--color-line-soft);
  border-radius: 0;
  background-color: var(--color-surface);
  transition: background-color 160ms var(--ease-standard);
}

.feedList > :last-child {
  border-bottom: 0;
}

.socialCard:hover,
.jobCard:hover,
.marketCard:hover {
  background-color: var(--color-surface-subtle);
  transform: none;
}

.cardCopy h2,
.jobIdentity h2,
.marketBody h2 {
  font-size: var(--type-item-title);
  font-weight: 650;
  line-height: 1.45;
}

.cardCopy p,
.marketBody > p {
  font-size: var(--type-support);
  line-height: 1.65;
}
```

Preserve the existing market-card tint as an inner background only. Preserve semantic status colors. Replace avatar circles with 10px rounded squares, except actual company logo frames. Keep action touch targets at 44px.

At max-width 1180px retain the current two-column collapse, but use `var(--content-max)` and the existing 18rem right rail. At max-width 900px retain one feed column followed by the right rail. At max-width 640px:

```css
.page {
  padding-top: 0.75rem;
}

.layout {
  width: 100%;
  gap: 0.75rem;
}

.feedHeader {
  min-height: 3rem;
  padding: 0 1rem 0.75rem;
}

.feedHeader h1 {
  font-size: 1.25rem;
}

.feedList {
  border-right: 0;
  border-left: 0;
  border-radius: 0;
}

.socialCard,
.jobCard,
.marketCard,
.emptyFeed {
  padding: 1rem;
  border-radius: 0;
}
```

- [ ] **Step 5: Add browser-level density and overflow tests**

Create `service-ui-foundation.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

for (const viewport of [
  { height: 900, width: 1440 },
  { height: 768, width: 1024 },
  { height: 844, width: 390 },
]) {
  test(`keeps the home compact and readable at ${viewport.width}px`, async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize(viewport);
    await page.goto("/");

    const bodyFamily = await page.locator("body").evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    expect(bodyFamily).toContain("Pretendard Variable");

    const title = page.getByRole("heading", {
      level: 1,
      name: "내 커리어와 가까운 이야기",
    });
    const titleSize = await title.evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(titleSize).toBeLessThanOrEqual(viewport.width <= 390 ? 20 : 22);

    const firstArticle = page.getByRole("article").first();
    await expect(firstArticle).toBeVisible();
    const firstBox = await firstArticle.boundingBox();
    expect(firstBox).not.toBeNull();
    expect(firstBox!.y).toBeLessThan(viewport.height);

    if (viewport.width === 1440) {
      const secondBox = await page.getByRole("article").nth(1).boundingBox();
      expect(secondBox).not.toBeNull();
      expect(secondBox!.y).toBeLessThan(900);
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    expect(browserErrors).toEqual([]);
  });
}
```

- [ ] **Step 6: Run focused unit and browser tests and verify GREEN**

Run:

```bash
cd apps/web
npm test -- src/features/home-feed/home-feed.test.tsx src/features/home-feed/home-feed.styles.test.ts src/styles/design-system.test.ts --run
npx playwright test e2e/service-ui-foundation.e2e.ts e2e/home-market-context.e2e.ts e2e/following-rail.e2e.ts
```

Expected: PASS at 1440, 1024, and 390; the first article is inside every initial viewport and the second article begins before 900px on desktop.

- [ ] **Step 7: Commit the home density pass**

```bash
git add apps/web/src/features/home-feed/home-feed.tsx apps/web/src/features/home-feed/home-feed.module.css apps/web/src/features/home-feed/home-feed.test.tsx apps/web/src/features/home-feed/home-feed.styles.test.ts apps/web/e2e/service-ui-foundation.e2e.ts
git commit -m "style: refine home into an editorial feed"
```

---

### Task 4: Real-browser inspection and first-batch regression gate

**Files:**

- No planned production file changes
- Diagnostic screenshots: `/tmp/ejik-fit-service-ui-foundation/`

**Interfaces:**

- Consumes: Tasks 1-3
- Produces: verified first-batch branch ready to merge

- [ ] **Step 1: Run all web unit tests**

Run:

```bash
cd apps/web
npm test -- --run
```

Expected: all test files and all tests PASS with no unhandled errors.

- [ ] **Step 2: Run TypeScript and production build**

Run:

```bash
cd apps/web
npm run lint
NEXT_PUBLIC_SITE_URL=https://ejik-fit.vercel.app npm run build
```

Expected: TypeScript exits 0 and Next production build exits 0 without `NEXT_PUBLIC_SITE_URL is required`.

- [ ] **Step 3: Run the complete browser suite**

Run:

```bash
cd apps/web
npm run test:e2e
```

Expected: every Playwright test passes in Chromium.

- [ ] **Step 4: Capture actual screenshots**

Start the test API and Next development server using the existing Playwright webServer configuration, then capture:

- `home-1440.png` at 1440x900
- `home-1024.png` at 1024x768
- `home-390.png` at 390x844
- `notification-1440.png` with the notification menu open
- `notification-390.png` with the notification menu open

Store them under `/tmp/ejik-fit-service-ui-foundation/`. Inspect every image with the local image viewer.

Acceptance:

1. 한글 워드마크가 모든 크기에서 즉시 읽힌다.
2. 데스크톱 내비게이션이 한 줄이며 헤더가 64px 이하이다.
3. 알림 패널이 헤더 아래에 있고 메뉴와 겹치지 않는다.
4. 홈 중앙 피드가 가장 강하고 좌우 레일이 보조로 보인다.
5. 카드보다 콘텐츠와 구분선이 먼저 보인다.
6. 1440x900에서 두 번째 게시물의 시작점이 보인다.
7. 390x844에서 첫 게시물이 보이고 가로 스크롤이 없다.
8. 보라색은 워드마크 핏, 활성 탭, 핵심 행동 외에 넓은 색면으로 반복되지 않는다.

If any acceptance item fails, return to the owning task, add a failing test that reproduces the measured failure, run it to confirm RED, implement the smallest correction, and repeat Tasks 4.1-4.4.

- [ ] **Step 5: Run repository hygiene checks**

Run:

```bash
git diff --check
git status --short
git log --oneline --decorate -4
```

Expected: no whitespace errors, only intentional first-batch files are changed or committed, and user-owned untracked root files do not appear inside the worktree.

## Plan Self-Review

- Spec coverage: first rollout unit covers global tokens, Pretendard conflict, wordmark, 64px/56px shell, notification layer, home feed, mobile density, accessibility touch targets, actual browser inspection.
- Deferred by explicit batch boundary: jobs, search, market, skill-map, career, job detail, company detail, post detail, and site-wide final visual audit are handled by subsequent plans after this independently deployable batch.
- Placeholder scan: no TBD, TODO, “similar to,” or unspecified production behavior remains.
- Type consistency: BrandMark props remain compatible; existing HomeFeed props and feed item types do not change.
- Data consistency: no task edits API clients, model transforms, fixture boundaries, URL parameters, or localStorage contracts.
