# 스킬맵 필터·전환 UX 개선 설계

## 목표

스킬맵의 분야 필터와 보기 설정이 눌린 즉시 이해 가능한 결과를 만들고, 그래프의 공간 기억을
보존한 채 부드럽게 전환되도록 한다. 최대 60개 기술 규모에서는 WebGL로 교체하지 않고 현재
Canvas 2D 렌더러를 유지하며, 불필요한 데이터 복제·시뮬레이션 재시작·카메라 이동을 제거한다.

## 확인된 문제와 근거

- 분야 필터는 모든 분야가 켜진 상태에서 하나씩 제외하는 방식이다. 첫 클릭으로 관심 분야를
  좁히려면 나머지 열 개 분야를 더 꺼야 한다.
- 전체 지도는 최대 48개 노드로 다시 채워지므로 한 분야를 제외해도 `48개 기술`이 유지될 수
  있다. 운영 화면에서 `백엔드`를 해제했을 때 HUD가 `48개 기술 · 58개 관계`로 유지됐다.
- 분야 필터로 topology signature가 바뀔 때마다 Canvas가 ready 상태를 잃고, 그래프 데이터를
  복제한 뒤 시뮬레이션 재가열과 자동 맞춤을 다시 실행한다.
- 전역 `.force-canvas`가 준비 상태 변경마다 브라우저 기본 `ease`로 520ms 페이드인한다. 실제
  계산보다 화면이 더 느리고 깜빡이는 것처럼 느껴진다.
- 관계선·기술명 밀도는 배치를 유지하지만 시각값을 즉시 교체해 변화가 튄다.
- `skill-graph-experience.tsx`와 `skill-graph-force-canvas.tsx`가 각각 상태 조정, 데이터 요청,
  필터 모델, UI, Canvas 전환을 함께 소유해 변경 경계가 불명확하다.

## 비교한 접근

### 1. CSS 피드백만 추가

버튼·메뉴·Canvas에 페이드와 눌림 상태만 추가한다. 작업량은 작지만 분야 필터의 역방향 의미,
그래프 재가열, 카메라 재설정은 남는다. 증상을 가릴 뿐이므로 채택하지 않는다.

### 2. 안정된 layout topology와 가시성 전환 분리 — 채택

서버에서 받은 현재 지도 범위 안에서 레이아웃용 노드·관계를 안정적으로 유지하고, 필터 결과는
`visibleNodeIds`와 `visibleLinkIds`로 전달한다. Canvas는 가시성 값을 짧게 보간하고 숨은 노드는
포인터 판정에서 제외한다. 필터·밀도·라벨 변경은 시뮬레이션과 카메라를 건드리지 않는다.

### 3. Sigma/WebGL 렌더러로 교체

수천 개 노드에는 적합하지만 현재 제품 예산은 최대 60개 기술이다. 번들·GPU·접근성·모바일 입력
복잡도가 커지고 현재 문제의 원인인 필터 의미를 해결하지 못하므로 채택하지 않는다.

## 사용자 동작 계약

### 분야 필터

- 초기 상태는 `전체`다. 내부 선택 배열이 비어 있으면 전체를 뜻한다.
- 전체 상태에서 분야 하나를 누르면 해당 분야만 선택한다.
- 분야가 선택된 상태에서 다른 분야를 누르면 함께 비교할 분야로 추가한다.
- 선택된 분야를 다시 누르면 제거한다. 마지막 분야를 제거하면 전체로 돌아간다.
- 별도의 `전체` 버튼으로 언제든 전체 상태로 돌아간다.
- 메뉴 요약은 `분야 전체`, `분야 1개`, `분야 2개`처럼 현재 의미를 말한다.
- 메뉴 안에는 적용 결과 기술 수를 표시하며 `aria-live="polite"`로 최종 결과만 알린다.
- 필터에서 제외된 선택 기술은 선택을 해제하고 관련 공고 요청을 중단한다. 화면에 보이지 않는
  기술의 분석 패널이 남는 모순을 허용하지 않는다.

### 지도 범위

- `전체 지도`와 `선택 주변 보기`는 기존 데이터 의미와 URL 계약을 유지한다.
- 서버 요청 중에도 현재 Canvas를 유지하고 상태 문구만 `관계망을 불러오는 중`으로 바꾼다.
- 새 topology가 도착하면 공통 노드 좌표를 보존하고 새 노드는 연결된 기존 노드나 분야 앵커
  주변에서 시작한다.
- 명시적인 범위 전환에서만 시뮬레이션을 낮은 강도로 갱신하고 전체 맞춤을 실행한다.

### 보기 설정

- 관계선 `핵심 / 균형 / 자세히`는 topology를 바꾸지 않고 선의 opacity를 보간한다.
- 기술명 `주요만 / 더 많이`는 라벨 opacity를 보간한다.
- 활성 버튼은 `aria-pressed`, 텍스트, 선택 표시를 함께 사용해 색상만으로 구분하지 않는다.
- HUD 기술·관계 수는 실제 필터 결과를 즉시 표시한다.

## 모션 계약

이 페이지에서 사용하는 상태 모션은 세 종류로 제한한다.

1. 그래프 필터 전환: 노드·관계선 opacity와 노드 scale, 220ms `--ease-out`
2. 메뉴 열기: opacity와 `translateY(-4px → 0)`, 180ms `--ease-out`
3. HUD 수치 교체: opacity와 `translateY(2px → 0)`, 120ms `--ease-out`

포커스 링은 즉시 표시하고 애니메이션하지 않는다. `prefers-reduced-motion: reduce`에서는 공간
이동과 scale을 제거하고 120ms 이하 opacity 전환만 허용한다. 페이지 진입·장식 반복 애니메이션은
추가하지 않는다.

## 구조

### 순수 상태 모델

`apps/web/src/lib/skill-graph-filters.ts`

- `SkillGraphDomainSelection`: 선택 분야 배열, 빈 배열은 전체
- `toggleSkillGraphDomain(selection, domain, availableDomains)`: 첫 선택·추가·제거 규칙
- `resolveSkillGraphEnabledDomains(selection)`: 전체면 `undefined`, 아니면 정규화 배열
- `skillGraphDomainSummary(selection)`: 툴바 요약 문구

React나 Canvas에 의존하지 않고 단위 테스트한다.

### 전환 모델

`apps/web/src/lib/skill-graph-visibility-transition.ts`

- 현재값, 목표값, 시작 시각으로 0–1 opacity를 계산하는 순수 함수
- `--ease-out`과 같은 cubic-bezier 근사 대신 단조로운 ease-out 수식을 사용한다.
- reduced-motion에서는 목표값을 즉시 반환한다.
- node/link/label이 같은 전환 규칙을 공유한다.

### 툴바 UI

`apps/web/src/components/skill-graph-toolbar-menus.tsx`

- 내 기술, 분야, 보기 설정, 읽는 법 메뉴만 소유한다.
- 메뉴 한 개만 열리며 바깥 클릭과 Escape로 닫힌다.
- 데이터 요청과 그래프 계산은 소유하지 않고 값과 명시적 콜백만 받는다.

### 경험 조정자

`skill-graph-experience.tsx`는 서버 topology, 선택 기술, 공고 근거, 적합도 요청을 조정한다.
분야 선택 규칙과 메뉴 마크업을 새 모듈로 이동한다. 필터용 `viewData`와 안정된 레이아웃용
`layoutData`를 분리한다.

### Canvas 렌더러

`GraphRendererProps`에 `visibleNodeIds`를 추가한다. 렌더러는 가시성 전환 값을 ref에 보관해
React 렌더 없이 requestAnimationFrame으로 다시 그린다. 숨은 노드는 그리지 않고 포인터 영역도
생성하지 않는다. 필터와 표시 밀도 변경은 `graph.graphData`, `d3ReheatSimulation`, `zoomToFit`을
호출하지 않는다.

## 성능 기준

- 분야·관계선·라벨 필터 한 번당 네트워크 요청 0회
- 분야·관계선·라벨 필터 한 번당 시뮬레이션 재가열 0회
- 분야·관계선·라벨 필터 한 번당 카메라 맞춤 0회
- requestAnimationFrame 전환은 최대 220ms 후 종료하며 백그라운드 탭에서는 즉시 최종값으로 정리
- layout topology는 데스크톱 최대 60개 노드와 96개 관계, 모바일 최대 40개 노드와 64개 관계로 제한
- 화면에 그리는 예산은 기존 데스크톱 48개/84개, 모바일 30개/48개를 유지
- 새 런타임 의존성을 추가하지 않는다.

## 오류·경계 처리

- 사용 가능한 분야에 없는 값은 상태 모델에서 제거한다.
- 선택 결과가 빈 배열이면 `전체`로 해석해 빈 그래프에 갇히지 않게 한다.
- topology 요청 실패 시 이전 Canvas와 필터 상태를 유지하고 기존 재시도 동작을 제공한다.
- 선택 기술이 필터 범위 밖이면 선택과 URL `seed`를 함께 해제한다.
- Canvas를 사용할 수 없는 환경에서는 기존 SVG/버튼 대체 그래프가 최종 필터 결과를 사용한다.

## 검증

- 필터 모델 단위 테스트: 전체→첫 선택, 다중 선택, 마지막 선택 해제, 알 수 없는 분야 제거
- 전환 모델 단위 테스트: 시작/중간/완료, 단조 증가·감소, reduced-motion 즉시 완료
- 컴포넌트 테스트: 첫 분야 클릭으로 단일 분야만 남음, HUD 수 변경, 선택 범위 해제, 요청 없음
- 렌더러 계약 테스트: visible node/link/label 변경이 topology signature를 바꾸지 않음
- 브라우저 테스트: Canvas ready 상태 유지, 네트워크 요청 0회, 필터 후 캔버스 픽셀 변화, Escape 닫기
- 반응형 확인: 320, 375, 414, 768, 1440px
- 필요한 테스트만 실행하고 전체 E2E는 배포 전 CI 한 번으로 제한한다.

## 변경 범위

생성:

- `apps/web/src/lib/skill-graph-filters.ts`
- `apps/web/src/lib/skill-graph-filters.test.ts`
- `apps/web/src/lib/skill-graph-visibility-transition.ts`
- `apps/web/src/lib/skill-graph-visibility-transition.test.ts`
- `apps/web/src/components/skill-graph-toolbar-menus.tsx`
- `docs/superpowers/plans/2026-07-30-skill-map-filter-motion.md`

수정:

- `apps/web/src/components/skill-graph-experience.tsx`
- `apps/web/src/components/skill-graph-experience.test.tsx`
- `apps/web/src/components/skill-graph-force-canvas.tsx`
- `apps/web/src/lib/graph-renderer.ts`
- `apps/web/src/lib/skill-graph-canvas-style.ts`
- `apps/web/src/lib/skill-graph-canvas-style.test.ts`
- `apps/web/src/components/skill-graph-atlas.module.css`
- `apps/web/src/app/globals.css`
- `apps/web/src/styles/skill-graph-layout.test.ts`
- `design.md`
- `.hallmark/log.json`

삭제하는 프로덕션 파일은 없다.
