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

모바일 하단 내비게이션은 브라우저 UI와 기기 안전 영역을 고려해 실제 safe-area 값과 12px 중
더 큰 값을 하단 여유로 사용한다.

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
- 홈의 커리어 브리핑은 근거가 있는 다음 학습 후보 한 가지를 주 행동으로 보여준다. 준비도와
  기술 중복 공고 수는 보조 사실로 묶고, 시장 전체 수요는 우측 레일과 피드 안 시장 카드에만 둔다.
- 홈의 전체 기술 수요 레일은 901px 이상에서만 보인다. 900px 이하에서는 브리핑 뒤에 연속 피드를
  바로 두고, 시장 근거는 피드 안의 시장 카드로 제공한다.
- 홈의 공식 공고 순서는 저장한 기술의 필수·우대·기타 근거를 우선한다. 공고 슬롯은 맞춤 4개마다
  새로운 분야 탐색 1개를 섞고, 탐색 공고는 별도 대형 배지나 CTA 없이 짧은 이유만 표시한다.
  커뮤니티 글과 시장 콘텐츠의 기존 삽입 간격, 자동 무한 스크롤은 이 정렬과 독립적으로 유지한다.
- 기술 입력은 `/career`와 헤더 `내 기술` 패널이 같은 검색형 선택기를 사용한다. 빈 입력에서 전체
  카탈로그를 펼치지 않고, 입력할 때만 순위가 높은 표준 기술을 최대 6개 보여주며 직접 입력도
  허용한다.
- 시장은 표·막대·범례를 우선하며 파스텔은 데이터 의미에만 사용한다.
- 스킬맵은 그래프를 가장 넓은 주 작업 면으로 둔다. 노드 크기는 시장 수요, 채움색은 기술 분야,
  보라색 실선 테두리는 내 기술, 작은 주황색 점은 상위 3개 학습 추천만 뜻한다. 선의 농도는 함께
  요구된 관계 강도만 표현하며 전체 선을 굵게 만들지 않는다.
- 스킬맵의 기본 화면은 공개 공고 기술 관계망을 안정된 **전체 시장 지도**로 보여준다. 서버에서는
  최대 60개 기술을 받고, 안정된 배치에는 데스크톱 최대 60개 기술·96개 관계, 모바일 최대 40개
  기술·64개 관계만 사용한다. 실제 표시 예산은 데스크톱 48개 기술·84개 관계, 모바일 30개
  기술·48개 관계다. 기술 분야별로 느슨한 공간 군집을 만들되 실제 동시 등장 관계가 군집 경계를
  넘나드는 모습은 보존한다.
- 노드 한 번 선택은 현재 지도 안에서 연결만 강조하고 선택 분석을 갱신한다. 이 동작만으로 관계망을
  다시 받거나 화면을 자동 확대·이동하지 않는다. 사용자가 `선택 주변 보기`를 명시적으로 실행할 때만
  직접 연결 또는 두 단계 관계망을 다시 받고 최대 30개 노드로 전환한다. `전체 지도`로 돌아오면
  이전 시장 지형과 선택을 복원한다.
- 스킬맵 검색은 입력 중 노드를 제거하거나 배치를 바꾸지 않는다. 검색 결과를 확정했을 때만 해당
  기술을 선택하고, 현재 시장 지도에 없는 기술이면 그 기술의 주변 관계망을 불러온다.
- 스킬맵의 관계선 밀도와 기술명 밀도는 같은 topology 위의 표시 정보만 바꾼다. 숨긴 관계도 force
  계산에는 남겨 설정 변경으로 배치가 흔들리지 않게 하고, hover·선택·명시적인 경로 강조에서는
  필요한 관계를 다시 표시한다.
- 분야 필터는 전체 상태에서 첫 분야를 누르면 해당 분야만 남기고, 이후 선택은 비교 분야를
  추가하거나 제거한다. 마지막 분야를 해제하면 전체로 돌아간다. 이 필터와 관계선·기술명 설정은
  네트워크 요청, force 재가열, 카메라 재맞춤 없이 같은 좌표에서 opacity와 작은 scale만 220ms
  안에 전환한다.
- 스킬맵에서 허용하는 상태 모션은 그래프 가시성 전환, 툴바 메뉴 열림, HUD 수치 교체 세 가지다.
  reduced motion에서는 공간 이동을 없애고 120ms 이하의 opacity 변화만 사용한다.
- `내 기술과의 시장 연결`은 현재 지도에서 공고 동시 등장 강도가 높은 최대 네 관계를 설명한다.
  사용자가 명시적으로 켤 때만 경로를 강조하며, 선수 지식이나 학습 순서로 표현하지 않는다.
- 내 기술·분야·범례는 그래프 위의 압축 툴바에서 필요할 때만 연다. 큰 설정 카드 묶음을 그래프보다
  먼저 두지 않는다. 데스크톱 선택 분석은 약 20rem 보조 레일, 모바일은 그래프 뒤의 단일 열로 둔다.
  개인의 보유 기술은 공유 가능한 시장 관계망 위에 브라우저에서 덧씌우며, 보유 기술 변경만으로
  관계망을 다시 받지 않는다.
- 모바일 스킬맵은 기본적으로 페이지 스크롤과 노드 탭을 함께 지원한다. 사용자가 `그래프 조작`을
  명시적으로 켠 동안만 이동·핀치 확대를 받고, 끄면 즉시 문서 스크롤 중심 상태로 돌아간다.
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
