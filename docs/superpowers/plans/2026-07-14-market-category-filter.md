# 시장 기술 분야 필터 구현 계획

1. 백엔드 계약 테스트에서 `category` query 전달과 DB 필터 의미를 먼저 고정한다.
2. 공고 API는 확정 카테고리 기술이 있는 공개 공고만 반환하도록 `DatabasePostingReader`를 확장한다. 카테고리 요청이 있으면 기존 검색 인덱스 대신 DB 검색을 사용한다.
3. 기술 통계 API는 동일한 공고 집합을 고른 뒤 그 공고의 전체 확정 기술을 집계한다.
4. 웹 API 클라이언트에 `category` query를 추가한다.
5. 시장 모델에 지원 카테고리, URL 정규화, 다른 필터를 보존하는 링크 빌더를 추가한다.
6. 시장 페이지가 공고·통계 요청에 동일한 카테고리를 전달하고, 반응형 분야 필터와 현재 범위 설명을 표시한다.
7. 공고 페이지가 같은 카테고리를 검증·요청·폼·재시도 URL에 유지한다.
8. 백엔드·웹 focused test를 거쳐 전체 pytest, Vitest, TypeScript, production build, Chromium 회귀를 실행한다.
9. 독립 리뷰 후 `main`에 fast-forward하고 GitHub CI, Vercel Web/API, 운영 URL을 확인한다.
