# 이직핏 프론트엔드 재구축 및 고성능 기술 그래프 설계

작성일: 2026-07-10

상태: 사용자 작성 문서 검토 승인 완료

관련 감사: `docs/audits/2026-07-10-ui-ux-trust-audit.md`

## 1. 목표

이 작업은 이직핏의 백엔드 수집·분석 기반을 유지하면서 프론트엔드 표현 계층을
재구축한다. 목표는 다음과 같다.

1. 실데이터, 부분 장애, 빈 상태를 정직하게 표시한다.
2. 홈, 공고, 기술 맵, 상세 화면을 하나의 앱 셸과 디자인 시스템으로 통합한다.
3. 동작하지 않는 UI와 가짜 계정 표현을 제거한다.
4. 기술 맵을 Obsidian의 graph view처럼 빠르고 공간 기억이 생기는 탐색 도구로 만든다.
5. 데스크톱 최대 50,000노드·150,000간선을 수용할 수 있는 WebGL 렌더링 기반을 만든다.
6. 모바일, 키보드, reduced motion, 스크린리더 사용자를 포함한다.
7. 데이터 정책, 분석 지표, 개인정보, 정정 요청, 검색·공유 metadata를 공개한다.
8. 새 구조 전환 후 레거시 전역 CSS와 대형 화면 컴포넌트를 제거한다.

## 2. 비목표

- 백엔드 프레임워크 교체
- 데이터베이스 모델 전면 재설계
- 크롤러·커넥터 재작성
- 사용자 계정·결제·서버 프로필 구현
- 실제 알림, 기업 분석, 채용 캘린더 기능 구현
- 합격 가능성이나 개인 채용 결과 예측
- 수만 개 공고 노드를 동시에 화면에 노출
- Sigma.js v4 alpha 도입

## 3. 보존 범위

다음 자산은 기존 구현을 유지하고 새 프론트엔드에서 adapter를 통해 사용한다.

- FastAPI API와 현재 응답 스키마
- PostgreSQL 모델과 수집 데이터
- 공식 출처와 마감 판정 정책
- 스킬 추출, 필수·우대 분류, 원문 근거
- Fit 계산과 그래프 관계 계산의 도메인 규칙
- 현재 force graph와 무관한 그래프 view 변환 테스트 중 유효한 규칙
- favicon과 현재 브랜드 이름 `이직핏`, 영문명 `EJIK FIT`

## 4. 재구축 범위

- 공통 앱 셸과 실제 경로 기반 내비게이션
- 홈 대시보드 화면과 상태 모델
- 공고 탐색 목록과 상세 연결
- 기술 맵 렌더러·레이아웃·인스펙터·모바일 구조
- 로딩, 부분 장애, 전체 장애, 빈 상태
- 디자인 토큰, 타이포그래피, 표면, 모션
- 접근성 대체 탐색
- 정책·지표·개인정보·정정 요청 페이지
- metadata, sitemap, robots, manifest, JSON-LD
- 프론트엔드 단위·통합·브라우저·성능 테스트

## 5. 파일과 모듈 경계

새 프론트엔드는 다음 책임 경계를 사용한다. 실제 구현에서는 기존 `src/lib`의
도메인 로직을 필요한 만큼 adapter 뒤에 두고, 화면별 코드가 직접 API 응답을
임의 보정하지 못하게 한다.

```text
apps/web/src/
  app/
    layout.tsx
    page.tsx
    jobs/
    skills/graph/
    data-policy/
    methodology/
    privacy/
    corrections/
    robots.ts
    sitemap.ts
    manifest.ts
  components/
    app-shell/
  features/
    dashboard/
      api.ts
      model.ts
      state.ts
      components/
    jobs/
      api.ts
      model.ts
      components/
    graph/
      model/
      renderer/
      layout/
      performance/
      components/
    owned-skills/
  ui/
    button/
    field/
    status/
    empty-state/
    source-proof/
  styles/
    tokens.css
    reset.css
    typography.css
    motion.css
```

### 5.1 경계 원칙

- `app`은 route와 server data orchestration만 담당하며 root layout에서 공통 앱 셸을
  한 번 적용한다.
- `features/*/model`은 API 응답을 화면 모델로 변환한다.
- 화면 컴포넌트는 샘플이나 임의 수치를 생성하지 않는다.
- `ui`는 제품 도메인을 모르는 공통 primitive만 가진다.
- 기술 그래프 렌더러는 React 상태와 WebGL lifecycle을 adapter로 분리한다.
- 새 스타일은 CSS Modules와 공통 token을 사용한다.
- 전역 CSS는 reset, token, typography, motion만 포함한다.

## 6. 데이터 상태 모델

각 독립 리소스는 다음 상태를 사용한다.

```ts
type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; updatedAt?: string }
  | { status: "empty"; reason: "no-data" | "no-match" }
  | { status: "error"; message: string; retryable: boolean };
```

홈은 postings, skill stats, graph summary 상태를 독립적으로 보존하고 최종 화면 상태를
다음처럼 계산한다.

```ts
type DashboardStatus = "ready" | "partial" | "empty" | "error";
```

- 모두 성공: `ready`
- 하나 이상 성공하고 하나 이상 실패: `partial`
- 성공했지만 표시 가능한 데이터 없음: `empty`
- 모든 핵심 리소스 실패: `error`

실패한 리소스를 다른 리소스나 샘플로 채우지 않는다.

## 7. 데이터 정직성 규칙

1. 프로덕션 route에는 샘플 공고와 고정 퍼센트를 포함하지 않는다.
2. 실제 시계열 API가 없으면 추세 차트를 렌더링하지 않는다.
3. 마감일 필드가 없으면 D-day를 계산하거나 추정하지 않는다.
4. 부분 장애는 일반 화면에서 볼 수 있는 status banner로 표시한다.
5. Fit은 `요구 기술 일치도`로 표현하고 합격 확률이 아님을 명시한다.
6. Fit 옆에 계산에 사용한 공고 수와 기준 설명 링크를 표시한다.
7. 통계는 기준 기간, 표본 수, 마지막 갱신 시각을 함께 표시한다.
8. 테스트 fixture는 테스트와 비프로덕션 성능 검증 route에만 존재할 수 있다.
9. 개발 fixture를 프로덕션 bundle의 화면 데이터로 import하지 않는다.

## 8. 공통 앱 셸

### 8.1 데스크톱

- 좌측 rail 또는 상단 bar 중 하나만 사용하며 route마다 구조를 바꾸지 않는다.
- 기본 항목은 홈, 공고 탐색, 기술 맵, 내 스택이다.
- 기업 분석, 채용 달력, 알림, 설정은 실제 기능이 생길 때까지 숨긴다.
- 현재 route는 pathname을 기준으로 계산한다.
- 가짜 사용자명, 아바타, 알림 badge를 표시하지 않는다.

### 8.2 모바일

- 하단 내비게이션에 아이콘과 한국어 텍스트를 함께 표시한다.
- 최소 터치 영역은 44×44px이다.
- 내 스택은 bottom sheet로 열고 어느 주요 route에서도 접근할 수 있다.
- bottom sheet는 Escape, backdrop, 닫기 버튼을 지원하고 focus를 복귀한다.

## 9. 홈 대시보드

홈은 실제 운영 snapshot을 짧게 읽는 화면이다.

### 9.1 상단 신뢰 요약

- 분석 기간
- 공식 출처 수
- 표시 공고 수
- 마지막 갱신 시각
- 데이터 정책 링크

### 9.2 핵심 영역

- 실제 공고 수와 기술 통계 요약
- 내 스택과 요구 기술 일치도 설명
- 최근 확인된 공고 목록
- 수요가 높은 관련 기술
- 부분 장애 또는 빈 상태 안내

실제 시계열이 없으므로 기존 고정 라인 차트와 기간 버튼은 제거한다. API가 시계열을
제공하게 되면 별도 feature로 추가한다.

### 9.3 공고 행

- 전체 행은 내부 상세 링크다.
- 별도 공식 원문 링크를 제공한다.
- 회사명, 제목, 위치, 상태, 마지막 확인 시각을 표시한다.
- 긴 위치와 제목은 desktop에서 grid minmax와 ellipsis를 사용한다.
- 모바일에서는 1열 카드로 전환하되 정보 순서를 유지한다.

## 10. 공고 탐색과 상세

### 10.1 공고 탐색

- 검색과 지역·경력·기간 필터를 URL에 보존한다.
- 화면에 이미 있는 5개만 필터링하지 않고 API 조회 범위와 일치시킨다.
- 결과 수, 적용 필터, 초기화 버튼을 제공한다.
- 결과 없음과 API 오류를 구분한다.

### 10.2 공고 상세

- 공통 앱 셸 안에서 렌더링한다.
- 공식 원문과 마지막 확인 시각을 첫 화면에 표시한다.
- 필수·우대 기술, 근거 문장, 신뢰도 설명을 제공한다.
- `JobPosting` JSON-LD를 생성한다.
- 오류 신고·기업 정정 요청 링크를 제공한다.
- 뒤로 가기와 공고 탐색 경로를 모두 제공한다.

## 11. 기술 맵 경험 원칙

기술 맵은 설정 패널을 보여주는 화면이 아니라 관계를 탐색하는 전체 화면 공간이다.

- 그래프가 사용 가능한 화면의 대부분을 차지한다.
- 초기 카메라 조작은 데이터 전체 안정화를 기다리지 않는다.
- 노드는 짧게 정렬된 뒤 안정되고 계속 흔들리지 않는다.
- 낮은 zoom에서는 전체 구조, 높은 zoom에서는 구체적 관계를 보여준다.
- 선택하지 않은 관계는 조용히 dim 처리한다.
- 선택 노드의 이웃과 근거 공고만 선명하게 표시한다.
- 그래프 위치는 같은 데이터에서 결정론적이며 재방문 시 유지된다.
- 설정은 접히는 popover, inspector는 오른쪽 drawer를 사용한다.
- 모바일 inspector와 설정은 bottom sheet를 사용한다.

## 12. 그래프 엔진

### 12.1 선택

- 렌더링: 안정 버전 Sigma.js v3 WebGL
- 데이터 모델: Graphology
- 레이아웃: `graphology-layout-forceatlas2`
- 백그라운드 레이아웃: ForceAtlas2 Web Worker
- React integration: Sigma instance lifecycle을 직접 감싼 adapter
- v4 alpha는 안정 버전이 될 때까지 사용하지 않는다.

Cosmograph는 수십만~수백만 노드 GPU force에 유리하지만 현재 범위에서는 라이선스,
WASM·DuckDB 도입, bundle과 운영 복잡도가 과하다. 엔진 용량 요구가 50,000노드를
지속적으로 넘을 때 별도 adapter 후보로 재평가한다.

### 12.2 renderer adapter

```ts
type GraphRendererAdapter = {
  mount(container: HTMLElement, graph: Graph): void;
  update(graph: Graph, view: GraphViewState): void;
  focusNode(nodeId: string): void;
  resize(width: number, height: number): void;
  destroy(): void;
};
```

React 컴포넌트는 adapter를 생성하고 제거하며, 노드·간선 drawing과 camera state를
직접 관리하지 않는다.

## 13. 그래프 레이아웃과 위치 안정성

### 13.1 즉시 초기 위치

- 노드 ID와 domain/community를 사용해 결정론적 초기 좌표를 생성한다.
- 최초 render는 force simulation 완료를 기다리지 않는다.
- seed와 owned skill은 초기 camera의 중심 후보가 된다.

### 13.2 Worker refinement

- 10,000노드 이하: ForceAtlas2 Worker를 제한 시간 동안 실행한다.
- 기본 refinement 시간은 1,200ms이며 안정도 임계값 도달 시 더 일찍 중지한다.
- 10,000노드 초과: 결정론적 community layout을 우선하고 live force를 기본 중지한다.
- pan, zoom, drag 중에는 simulation을 중지한다.
- drag가 끝난 뒤 선택 주변에만 짧은 local refinement를 허용한다.
- Barnes–Hut 최적화를 활성화한다.

### 13.3 위치 캐시

- IndexedDB에 graph fingerprint와 node position을 저장한다.
- fingerprint는 정렬된 node·edge ID를 Worker에서 hash해 생성한다.
- 같은 fingerprint는 캐시 위치를 즉시 사용한다.
- fingerprint가 바뀌면 공통 노드의 기존 위치를 유지하고 새 노드만 주변에 배치한다.

## 14. LOD와 표시 예산

기존 `graph-lod.ts`의 개념을 실제 Sigma reducer와 camera event에 연결한다.

### 14.1 overview

- 모든 허용 노드는 작은 점으로 표시할 수 있다.
- 개별 간선은 숨기고 community 간 집계 관계만 표시한다.
- 라벨은 상위 hub 최대 24개만 표시한다.

### 14.2 medium zoom

- 현재 viewport 안의 주요 노드와 owned skill 라벨을 표시한다.
- 상위 가중치 간선만 표시한다.
- hover 이웃만 일시적으로 강조한다.

### 14.3 detail zoom

- 선택 노드의 1~2단계 이웃 라벨과 간선을 표시한다.
- 근거 공고는 선택 시 최대 20개까지 별도 node layer 또는 inspector에 표시한다.
- 전체 공고 evidence를 global graph에 동시에 넣지 않는다.

### 14.4 모바일

- 기본 가시 예산은 500노드·1,500간선이다.
- overview는 분야와 핵심 기술 중심으로 sampling한다.
- live force는 기본 비활성화한다.

## 15. 그래프 상호작용 성능

- adjacency map을 graph load 시 한 번 구축한다.
- hover와 선택은 전체 간선을 순회하지 않고 adjacency map을 사용한다.
- search index는 label, alias, domain을 정규화해 미리 구축한다.
- 화면 상태 변경은 React 전체 rerender가 아니라 Sigma node·edge reducer로 처리한다.
- label 측정과 formatting 결과를 캐시한다.
- simulation과 rendering은 camera input 동안 경쟁하지 않는다.
- 브라우저 tab이 숨겨지면 simulation과 animation을 중지한다.

## 16. 성능 예산

### 16.1 엔진 용량

- 데스크톱 최대 데이터셋: 50,000노드·150,000간선
- 모바일 기본 표시: 500노드·1,500간선
- 데스크톱 기본 detail 표시: 2,000노드·6,000간선 이하

### 16.2 사용자 체감 목표

- 첫 상호작용 가능 시간: 2초 이내 목표
- 노드 선택과 이웃 강조: 100ms 이내
- desktop 일반 그래프 pan·zoom: 60fps 목표
- 대형 그래프 또는 저사양 장치 pan·zoom: 45fps 이상 목표
- camera 입력 중 200ms 이상 long task 없음
- reduced motion에서는 초기 animation 없이 즉시 안정 상태 표시

### 16.3 자동 검증

- CI 브라우저 fixture: 5,000노드
- CI 통과 기준: 3초 pan·zoom 동안 평균 frame interval 22ms 이하, 200ms 이상
  long task 없음
- 로컬 성능 보고서: 10,000·50,000노드의 FPS, p95 frame time, long task,
  JS heap 기록
- 현재 artifact 변환 benchmark는 유지하되 실제 렌더링 benchmark와 구분한다.

## 17. 오류와 빈 상태

### 17.1 홈

- 부분 장애: 성공한 영역은 유지하고 상단에 visible banner 표시
- 전체 장애: retry와 데이터 정책 링크가 있는 오류 화면
- 빈 데이터: 수집 범위와 스택 설정 행동을 설명

### 17.2 기술 맵

- API 오류 시 가짜 노드, 캘린더, 시장 신호를 표시하지 않는다.
- retry, 홈 이동, 데이터 정책 링크를 제공한다.
- graph renderer 초기화 실패와 API 실패를 별도 메시지로 구분한다.
- WebGL을 사용할 수 없는 환경에는 제한된 목록 탐색 fallback을 제공한다.

### 17.3 공고 상세

- 404는 마감·주소 변경 가능성과 공고 탐색 링크를 제공한다.
- 일반 오류는 route `error.tsx`에서 retry와 공식 출처 정책 링크를 제공한다.

## 18. 디자인 시스템

### 18.1 타이포그래피

- 한글 본문과 제목: self-hosted Pretendard Variable
- 숫자와 영문 보조: Geist
- body 최소 15px, line-height 1.6
- 보조 문구 최소 12px이며 대비 4.5:1을 충족
- 데이터 숫자에 `font-variant-numeric: tabular-nums`
- 제목은 비표준 합성 굵기를 피하고 500, 600, 700, 800만 사용

### 18.2 색상

- 기본 배경: neutral ink 또는 밝은 cool gray
- 주 accent: fit green 한 가지
- blue는 링크와 정보 상태에만 제한
- warning과 error는 의미 상태에만 사용
- light와 dark가 같은 semantic token을 공유
- graph canvas는 두 테마 모두 deep navy를 유지

### 18.3 표면

- 카드가 필요한 계층에만 border와 surface 사용
- 동일 radius 반복을 피하되 control, panel, overlay 세 단계만 사용
- 일반 dashboard에서는 shadow를 최소화
- graph node glow는 선택·hover 상태에만 사용
- 장식용 gradient와 가짜 sparkline을 사용하지 않는다.

### 18.4 모션

- control transition 140~220ms
- camera easing은 짧고 interruption 가능해야 함
- force simulation을 장식용 perpetual animation으로 사용하지 않음
- reduced motion에서 transform animation 제거

## 19. 접근성

- route당 `<main>`은 하나만 사용한다.
- 모든 input은 visible 또는 screen-reader label을 가진다.
- focus ring은 component style로 제거하지 않는다.
- mobile nav의 text label을 숨기지 않는다.
- graph search 결과를 키보드로 이동하고 Enter로 선택할 수 있다.
- 선택 노드와 이웃을 DOM 목록으로 제공한다.
- graph canvas 자체는 시각 layer로 두되 같은 핵심 정보를 inspector에서 읽을 수 있다.
- 비긴급 loading·empty·partial 변경은 `role=status`, 작업을 막는 API·renderer
  오류는 `role=alert`로 알린다.
- bottom sheet와 drawer는 focus trap, Escape close, focus return을 지원한다.
- touch target은 최소 44×44px이다.

## 20. 공개 신뢰 페이지

다음 route를 추가한다.

- `/data-policy`: 공식 공개 페이지 수집 원칙, CAPTCHA·인증 우회 금지, 마감 판정
- `/methodology`: 스킬 추출, 요구 기술 일치도, 표본·기간 설명
- `/privacy`: 계정 없음, localStorage key, URL query 저장, 삭제 방법
- `/corrections`: 오류 신고와 기업 정정·삭제 요청

문의와 정정 요청은 기존 공개 저장소
`https://github.com/NoirStar/ejik-fit/issues`로 연결한다. 개인 이메일이나 존재하지 않는
사업자 정보를 만들지 않는다.

## 21. metadata와 검색·공유

- `NEXT_PUBLIC_SITE_URL`을 production canonical base로 사용한다.
- 개발 환경 fallback은 `http://localhost:3000`이다.
- root metadata에 `metadataBase`, canonical, Open Graph, Twitter card를 설정한다.
- `robots.ts`, `sitemap.ts`, `manifest.ts`를 추가한다.
- 홈, 공고 목록, 기술 맵, 정책 페이지에 고유 title과 description을 사용한다.
- 공고 상세는 `generateMetadata`와 `JobPosting` JSON-LD를 생성한다.
- 공유 이미지는 이직핏 브랜드, 공식 출처 기반 분석, 실제 화면 목적만 표현한다.

## 22. 전환 전략

### 22.1 병행 구축

1. 공통 token, typography, primitive를 만든다.
2. 새 앱 셸을 만든다.
3. 새 데이터 상태 모델과 홈을 구현한다.
4. 공고 목록과 상세를 새 셸로 전환한다.
5. WebGL 기술 맵을 구현하고 기존 경로를 전환한다.
6. 공개 신뢰 페이지와 metadata를 추가한다.
7. 모든 route의 브라우저 검증을 완료한다.
8. 레거시 component와 CSS를 삭제한다.

### 22.2 삭제 기준

다음 조건을 모두 만족한 뒤 기존 `reference-*`, `daily-*`, `ti-*` 스타일과 대응
컴포넌트를 삭제한다.

- 홈 기능 parity와 데이터 정직성 테스트 통과
- 공고 상세와 공식 원문 경로 통과
- 기술 맵 선택·검색·필터·fallback 통과
- 390, 768, 1440px overflow 검사 통과
- light·dark 캡처 검토 통과
- 타입 검사, 전체 테스트, production build 통과

## 23. 테스트 전략

### 23.1 단위 테스트

- API 응답에서 `ResourceState` 생성
- `DashboardStatus` 계산
- 샘플과 고정 수치가 출력 모델에 존재하지 않음
- Fit 설명과 표본 정보 생성
- graph fingerprint와 deterministic position
- adjacency index와 neighborhood 탐색
- zoom별 LOD
- renderer 선택과 WebGL fallback

### 23.2 통합 테스트

- 홈 ready, partial, empty, error 상태
- 스택 첫 진입, 저장, 삭제, URL 동기화
- 공고 검색·필터·상세 이동·원문 이동
- 기술 맵 검색, 키보드 선택, 이웃 inspector, evidence 지연 노출
- 정책 페이지와 footer 경로
- 공고 metadata와 JSON-LD

### 23.3 브라우저 테스트

- 390, 768, 1440px
- light, dark, reduced motion
- keyboard-only navigation
- horizontal overflow와 text clipping
- drawer와 bottom sheet focus 동작
- API partial·error mock
- WebGL unavailable fallback

### 23.4 성능 테스트

- 실제 Sigma canvas를 사용하는 5,000노드 CI fixture
- 10,000·50,000노드 로컬 benchmark route
- pan, zoom, hover, search, select 시 frame·long task·heap 기록
- benchmark 결과를 JSON과 Markdown으로 저장

## 24. 수용 기준

다음 조건을 모두 만족해야 재구축이 완료된다.

1. 프로덕션 홈 코드에 샘플 회사, 고정 D-day, 고정 추세 퍼센트가 없다.
2. API 실패가 일반 사용자에게 보이고 샘플 화면으로 대체되지 않는다.
3. 노출된 내비게이션과 버튼은 모두 실제 동작한다.
4. 가짜 사용자명, 알림 badge, 준비 중 메뉴가 없다.
5. 모바일에서 내 스택과 모든 주요 route에 접근할 수 있다.
6. 홈, 기술 맵, 공고 상세가 같은 app shell과 token을 사용한다.
7. 공고 행은 내부 상세와 공식 원문에 연결된다.
8. Fit의 의미, 표본, 기준 기간을 확인할 수 있다.
9. 기술 맵이 Sigma.js WebGL renderer를 사용한다.
10. LOD가 camera zoom과 선택 상태에 실제 연결된다.
11. hover가 전체 링크를 매번 순회하지 않는다.
12. 5,000노드 CI 성능 기준을 통과한다.
13. 50,000노드 로컬 성능 보고서가 생성된다.
14. 기술 맵은 키보드 검색과 DOM inspector 대체 탐색을 제공한다.
15. 정책·방법론·개인정보·정정 요청 route가 존재한다.
16. canonical, Open Graph, sitemap, robots, manifest가 존재한다.
17. 공고 상세가 동적 metadata와 `JobPosting` JSON-LD를 제공한다.
18. 390, 768, 1440px light·dark에서 horizontal overflow가 없다.
19. 전체 typecheck, test, production build가 통과한다.
20. 레거시 전역 dashboard·graph CSS와 사용되지 않는 컴포넌트가 제거된다.

## 25. 위험과 완화

### 25.1 WebGL 장치 편차

구형 장치와 browser에서 WebGL을 사용할 수 없을 수 있다. 기능을 숨기지 않고 검색과
이웃 목록 중심 fallback을 제공한다.

### 25.2 50,000노드 layout 비용

50,000노드에서 live force를 기본 사용하지 않는다. 결정론적 community layout,
WebGL rendering, LOD, 선택 주변 refinement로 분리한다.

### 25.3 프론트엔드 전환 회귀

route별 새 구현을 독립적으로 테스트하고 병행 구축한다. 모든 route parity와
브라우저 검증이 끝나기 전 레거시 코드를 삭제하지 않는다.

### 25.4 SEO 환경값 누락

production build에서 `NEXT_PUBLIC_SITE_URL` 누락을 명확히 경고하고 development
fallback만 허용한다.

### 25.5 문구가 분석 결과를 과장할 위험

통계와 Fit 문구를 model layer에서만 생성하고, 화면 컴포넌트가 임의 수치나 비교
표현을 만들지 못하게 한다.

## 26. 최종 결정

- 점진적 CSS 보정이 아니라 프론트엔드 표현 계층을 재구축한다.
- 백엔드와 도메인 로직은 보존한다.
- 기술 맵은 Sigma.js v3 WebGL과 Graphology Worker를 사용한다.
- 시각적 화려함보다 데이터 정직성, 상호작용 반응성, 공간 안정성을 우선한다.
- 전체 공고를 노드로 노출하지 않고 기술 구조와 선택 근거를 단계적으로 보여준다.
- 레거시 코드는 새 route 검증 후 제거한다.
