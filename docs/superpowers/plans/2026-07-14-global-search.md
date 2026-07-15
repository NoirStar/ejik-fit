# 통합 검색 구현 계획

**목표:** 헤더의 회사·직무·기술·주제 검색 약속을 실제 데이터 경계가 분명한 `/search` 화면으로 연결한다.

**아키텍처:** 서버 페이지가 공고 검색과 기술 통계를 병렬로 읽고 독립적인 resource state로 순수 모델에 전달한다. 프레젠테이션 컴포넌트는 URL 범위 탭과 결과 섹션만 렌더링한다. 기업은 실제 공고 응답에서 파생하고 커뮤니티만 기존 mock 원본을 검색한다.

---

## Task 1: 검색 결과 모델을 테스트 주도로 구현

**파일:**

- 생성: `apps/web/src/features/search/model.test.ts`
- 생성: `apps/web/src/features/search/model.ts`

1. 검색어와 범위 정규화 실패 테스트를 작성한다.
2. 기업 그룹화, 공고 링크, 최근 검증, 대표 기술 계산 테스트를 작성한다.
3. 기술 정확/접두/부분 일치 정렬과 실제 통계 링크 테스트를 작성한다.
4. 커뮤니티 mock 검색과 예시 출처 유지 테스트를 작성한다.
5. 실제 데이터 준비·부분 실패·전체 실패·빈 결과 상태 테스트를 작성한다.
6. 최소 순수 모델 구현 후 집중 테스트를 통과시킨다.

## Task 2: 검색 서버 페이지와 결과 UI 구현

**파일:**

- 생성: `apps/web/src/app/search/page.test.tsx`
- 생성: `apps/web/src/app/search/page.tsx`
- 생성: `apps/web/src/features/search/search-results.test.tsx`
- 생성: `apps/web/src/features/search/search-results.tsx`
- 생성: `apps/web/src/features/search/search-results.module.css`

1. 빈 검색어에서 API를 호출하지 않는 페이지 테스트를 작성한다.
2. 공고 `q`와 두 API의 100건 범위 호출, 부분 실패 격리 테스트를 작성한다.
3. 동적 제목과 `noindex, follow` 메타데이터 테스트를 작성한다.
4. 검색 전, 실제 결과, 결과 없음, 부분 실패, 전체 실패의 컴포넌트 테스트를 작성한다.
5. 전체/기업/공고/기술/커뮤니티 범위별 결과와 출처 설명을 구현한다.
6. 1120px 최대 폭, 2열 데스크톱, 단일 열 모바일, focus-visible 및 reduced motion을 구현한다.

## Task 3: 검색 진입 경로 연결

**파일:**

- 수정: `apps/web/src/components/app-shell/app-shell.tsx`
- 수정: `apps/web/src/components/app-shell/app-shell.test.tsx`
- 수정: `apps/web/src/features/home-feed/home-feed.tsx`
- 수정: `apps/web/src/features/home-feed/home-feed.test.tsx`

1. 헤더 검색이 `/search`로 제출되고 검색 페이지에서 현재 질의를 유지하는 테스트를 작성한다.
2. 커뮤니티 태그가 해당 커뮤니티 범위 검색으로 이어지는 테스트를 작성한다.
3. 기존 `/` 단축키, 메뉴 닫기, 내 스택 동기화 동작이 유지되는지 확인한다.

## Task 4: 브라우저와 운영 배포 검증

**파일:**

- 생성: `apps/web/e2e/global-search.e2e.ts`
- 수정: `apps/web/e2e/fixtures/test-api.mjs`

1. fixture의 `q` 검색을 제목·기업·근무지·기술 범위에서 실제 API 의미와 맞춘다.
2. 1440px, 820px, 390px에서 헤더 검색→전체 결과→기업/공고/기술/커뮤니티 링크 흐름을 검증한다.
3. 가로 넘침 없음, 44px 터치 목표, 실제/예시 레이블을 검증한다.
4. 전체 Vitest, Playwright, TypeScript, lint, production build를 실행한다.
5. 독립 코드 리뷰에서 Critical/Important를 수정한다.
6. main에 fast-forward 병합·푸시하고 GitHub CI와 Vercel 운영 배포를 재검증한다.
