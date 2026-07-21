# Design — 이직핏

이 문서는 이직핏의 잠긴 앱 디자인 시스템이다. 페이지별 취향을 새로 만들지 않고,
모든 화면이 같은 제품처럼 보이도록 이 기준을 먼저 읽고 확장한다.

## Genre

`modern-minimal` 제품 UI. 국내 개발자 커뮤니티와 채용 데이터 서비스에 맞게 정보 밀도는
높게 유지하고, 장식보다 탐색·비교·근거 확인을 우선한다.

## Macrostructure family

- 홈: **Ecosystem Index** — 커뮤니티, 공식 공고, 시장 신호를 서로 다른 발견 면으로 노출한다.
- 시장·공고·커리어: **Workbench** — 작은 페이지 안내 뒤에 제어 영역과 주 작업 영역을 바로 둔다.
- 스킬맵: **Map / Diagram** — 그래프를 주인공으로 두고 제어와 근거 패널은 보조한다.
- 정책·방법론·개인정보: **Long Document** — 카드 나열 대신 읽기 좋은 연속 문서로 구성한다.
- 기업·공고·커뮤니티 상세: 제품형 **detail document** — 정체성/제목, 핵심 메타, 본문/근거 순서다.

## Theme

기존 보라색 브랜드와 사용자가 선택한 파스텔 팔레트를 보존하되 각 색에 하나의 역할만 준다.

- `--color-bg`: `oklch(97.70% 0.0040 286.33)`
- `--color-surface`: `oklch(100% 0 0)`
- `--color-surface-subtle`: `oklch(98.84% 0.0013 286.38)`
- `--color-surface-muted`: `oklch(95.93% 0.0053 286.30)`
- `--color-brand-subtle`: `oklch(95.45% 0.0243 296.12)`
- `--color-text`: `oklch(20.69% 0.0098 285.51)`
- `--color-muted`: `oklch(50% 0.0173 285.76)`
- `--color-faint`: `oklch(55.20% 0.0153 285.89)`
- `--color-line`: `oklch(92.94% 0.0067 286.27)`
- `--color-line-soft`: `oklch(95.33% 0.0053 286.30)`
- `--color-accent`: `oklch(54.36% 0.2236 286.27)`
- `--color-accent-strong`: `oklch(46.80% 0.2066 284.82)`
- `--color-focus`: `oklch(20.69% 0.0098 285.51)`
- `--color-demand-required`: `oklch(68.53% 0.0803 235.68)`
- `--color-demand-preferred`: `oklch(81.20% 0.0562 177.39)`
- `--color-demand-unspecified`: `oklch(94.99% 0.0384 72.37)`
- `--color-demand-highlight`: `oklch(84.07% 0.0886 32.76)`

보라색은 선택·주요 행동·링크에만 사용한다. 파스텔 네 색은 시장 데이터와 조용한 상태 표현에만
사용하며, 한 화면에서 강조색이 차지하는 면적은 작게 유지한다.

## Typography

- Display: Pretendard Variable, weight 720–800, normal
- Body: Pretendard Variable, weight 400–650
- Mono/numeric: Pretendard Variable tabular numerals
- Display tracking: `-0.035em`
- 페이지 제목: `1.75rem`; 상세 제목: `1.875rem`; 섹션 제목: `1–1.25rem`

한글 제품 UI에서는 서체 추가보다 문장 크기와 밀도 안정성이 중요하므로 단일 패밀리를 의도적으로
사용한다. 로고는 별도 SVG 워드마크가 브랜드의 개성을 담당한다.

## Spacing

4px 기반 이름 있는 간격을 사용한다.

- `--space-3xs: 0.25rem`
- `--space-2xs: 0.5rem`
- `--space-xs: 0.75rem`
- `--space-sm: 1rem`
- `--space-md: 1.5rem`
- `--space-lg: 2rem`
- `--space-xl: 3rem`
- `--space-2xl: 4.5rem`

페이지 도입부는 짧게, 주 작업 영역은 밀도 있게, 문서형 페이지는 읽기 호흡을 넓게 둔다.

## Motion

- `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
- `--ease-in: cubic-bezier(0.7, 0, 0.84, 0)`
- `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`
- 필터 결과 재배치와 패널 열기처럼 상태 변화 이해에 필요한 동작만 애니메이션한다.
- 페이지 단위 등장 애니메이션은 사용하지 않는다.
- reduced motion에서는 공간 이동을 제거하고 150ms 이하의 opacity 변화만 허용한다.

## Microinteractions stance

- 저장·팔로우처럼 결과가 화면에 보이면 성공 토스트를 띄우지 않는다.
- 모든 키보드 포커스는 즉시 표시하며 흰 배경에서 3:1 이상 대비를 확보한다.
- 터치 가능한 제어는 최소 44×44 CSS px다.
- hover는 색상 또는 1px 이동 중 하나만 사용하고 같은 동작의 focus/tap 상태를 제공한다.
- 탭·버튼·주요 링크 라벨은 320px에서도 한 줄이다.

## Navigation and footer

- Navigation: **N1b product shell with visible search spine**. 실제 목적지 다섯 개가 있으므로 메뉴를
  인위적으로 숨기지 않는다. 데스크톱 헤더와 모바일 하단 내비게이션은 같은 정보구조를 공유한다.
- Footer: **Ft2 Inline rule single line**. 정책·방법론 링크를 짧은 한 줄 구조로 유지한다.

## CTA voice

- Primary: 진한 보라색 채움, 8–10px 반경, 구체적인 동사형 한글 라벨
- Secondary: 투명 배경과 얇은 경계 또는 단순 텍스트 링크
- 한 영역에서 같은 목적의 CTA를 두 번 노출하지 않는다.

## Per-page allowances

- 홈은 연속 피드를 하나의 표면으로 취급한다. 관련 공식 공고는 배경 톤과 배지로 구분하며 굵은
  왼쪽 강조선과 중첩 카드 프레임을 사용하지 않는다.
- 시장은 표·막대·범례를 우선하며 파스텔은 데이터 의미에만 사용한다.
- 스킬맵은 그래프 배경을 항상 현재 테마와 맞추며 모바일에서 터치 제어를 제공한다.
- 정책 문서는 장식 카드나 페이지 진입 애니메이션을 사용하지 않는다.
- eyebrow는 출처나 상태처럼 실제 메타정보가 있을 때만 사용하고 페이지 장식으로 반복하지 않는다.

## What pages MUST share

- 워드마크와 파비콘
- 배경·텍스트·보라색 포인트와 시장 데이터 팔레트
- Pretendard 타이포그래피와 제목 크기 범위
- 44px 터치 기준과 진한 포커스 링
- 버튼 반경, 경계선 강도, 데이터 수치의 tabular numerals

## What pages MAY differ on

- 홈의 3열 발견 구조, 시장/공고의 작업대 구조, 스킬맵의 공간 구조
- 상세 페이지의 사이드 패널 유무
- 데이터 밀도에 따른 카드 대신 선·배경·여백의 사용 비율

## Exports

실제 런타임 원본은 `apps/web/src/styles/tokens.css`다.

### tokens.css

```css
:root {
  --color-paper: oklch(97.70% 0.0040 286.33);
  --color-paper-2: oklch(100% 0 0);
  --color-ink: oklch(20.69% 0.0098 285.51);
  --color-ink-2: oklch(50% 0.0173 285.76);
  --color-rule: oklch(92.94% 0.0067 286.27);
  --color-accent: oklch(54.36% 0.2236 286.27);
  --color-accent-ink: oklch(100% 0 0);
  --color-focus: oklch(20.69% 0.0098 285.51);
  --font-display: var(--font-korean);
  --font-body: var(--font-korean);
  --font-outlier: var(--font-korean);
  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
  --space-2xl: 4.5rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 0.9375rem;
  --text-lg: 1.25rem;
  --text-xl: 1.75rem;
  --text-2xl: 1.875rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-short: 180ms;
  --radius-card: 0.625rem;
  --radius-pill: 999px;
  --radius-input: 0.625rem;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(97.70% 0.0040 286.33);
  --color-ink: oklch(20.69% 0.0098 285.51);
  --color-accent: oklch(54.36% 0.2236 286.27);
  --font-display: var(--font-korean);
  --font-body: var(--font-korean);
  --spacing-md: 1.5rem;
  --text-md: 0.9375rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "color": {
    "paper": { "$value": "oklch(97.70% 0.0040 286.33)", "$type": "color" },
    "ink": { "$value": "oklch(20.69% 0.0098 285.51)", "$type": "color" },
    "accent": { "$value": "oklch(54.36% 0.2236 286.27)", "$type": "color" },
    "focus": { "$value": "oklch(20.69% 0.0098 285.51)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Pretendard Variable", "$type": "fontFamily" },
    "body": { "$value": "Pretendard Variable", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 0.977 0.0040 286.33;
  --foreground: 0.2069 0.0098 285.51;
  --primary: 0.5436 0.2236 286.27;
  --primary-foreground: 1 0 0;
  --muted: 0.9593 0.0053 286.30;
  --muted-foreground: 0.5000 0.0173 285.76;
  --border: 0.9294 0.0067 286.27;
  --input: 0.9294 0.0067 286.27;
  --ring: 0.2069 0.0098 285.51;
  --radius: 0.625rem;
}
```
