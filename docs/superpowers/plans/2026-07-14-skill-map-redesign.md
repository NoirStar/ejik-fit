# 스킬맵 리디자인 구현 계획

## 1. 회귀 기준과 글로벌 내비게이션

파일:

- `apps/web/src/components/app-shell/app-shell.tsx`
- `apps/web/src/components/app-shell/app-shell.test.tsx`
- `apps/web/src/app/skills/graph/page.test.tsx`

순서:

1. `/skills/graph`에서 스킬맵 내비게이션이 활성 상태가 되는 실패 테스트를 작성한다.
2. 중복 브랜드 레일, 비동작 도구 버튼, 합성 채용 캘린더가 없는 화면 계약을 테스트한다.
3. 경로 별칭을 글로벌 활성 상태 판정에 추가한다.

## 2. 실제 근거 중심 뷰 모델

파일:

- `apps/web/src/components/skill-graph-experience.tsx`
- `apps/web/src/components/skill-graph-experience.test.tsx`

순서:

1. 선택 기술의 언급·필수·우대·미분류 수치 테스트를 작성한다.
2. 관련 공고가 `/jobs/:id`로 연결되는 테스트를 작성한다.
3. 다음 준비와 분야 분포가 API 응답이 있을 때만 표시되는 테스트를 작성한다.
4. 선택 기술과 무관한 Fit 및 합성 일정 코드를 제거한다.

## 3. 작업 공간 정보 구조

파일:

- `apps/web/src/components/skill-graph-experience.tsx`
- `apps/web/src/components/skill-graph-experience.module.css`
- `apps/web/src/app/globals.css`

순서:

1. 중복 내부 레일을 제거한다.
2. 소개·검색·빠른 선택·3열 작업 공간을 시맨틱 구조로 재배치한다.
3. 왼쪽 필터, 중앙 그래프, 오른쪽 선택 분석의 데스크톱 계층을 구현한다.
4. 그래프 아래에 실제 fit 응답 기반 다음 준비와 API 분야 분포를 배치한다.
5. 기존 `ti-*` 전용 CSS를 CSS Module로 옮기고 사용하지 않는 규칙을 제거한다.

## 4. 상호작용과 오류 상태

파일:

- `apps/web/src/app/skills/graph/page.tsx`
- `apps/web/src/components/skill-graph-experience.tsx`
- 관련 단위 테스트

순서:

1. API 실패 상태를 컴포넌트 안에 전달해 고정 overlay 대신 인라인 오류로 표시한다.
2. 필터 결과 없음, 그래프 데이터 없음, fit 요청 실패 상태를 구분한다.
3. 보유 기술 추가·삭제와 필터 초기화의 상태 및 live 안내를 보강한다.
4. hover, active, focus-visible, reduced-motion 상태를 구현한다.

## 5. 반응형 브라우저 검증

파일:

- `apps/web/e2e/skill-map.e2e.ts`

검증:

- 홈 또는 직접 링크에서 스킬맵 진입
- 1440px, 820px, 390px overflow 0
- `/skills/graph` 글로벌 내비게이션 활성 상태
- 선택 기술 변경 후 제목과 실제 수치 갱신
- 관련 공고 상세 링크 이동
- 모바일 그래프 최소 높이와 44px 조작 대상
- 모바일 하단 내비게이션과 본문 여백
- console error 0
- 전체 Vitest, Playwright, lint, TypeScript, production build
- 독립 리뷰 후 main 병합, push, CI와 Vercel 운영 확인
