# 저장 보관함 구현 계획

## 1. 모델과 계약을 테스트로 고정

- `features/saved-library/model.test.ts`를 만든다.
- 실제 `PostingDetail`을 설명 HTML 없이 표시 모델로 변환하는지 검증한다.
- 커뮤니티 mock 저장 ID 선택과 누락 개수를 검증한다.
- 클라이언트가 받은 route 응답의 URL, 날짜, 배열, 상태를 다시 검증하는지 확인한다.

## 2. 실제 공고 재확인 route 구현

- `app/career/saved/data/route.test.ts`에서 잘못된 body, 개수 제한, 중복 제거, 성공, 404, 일시 실패를 먼저 실패시킨다.
- `POST /career/saved/data`를 구현한다.
- 최대 24개 ID만 허용하고 공고별 실패를 격리한다. 요청당 동시 조회 4개, 인스턴스 전체 8개, 8초 제한, 취소 전파, ID 수 기반 요청 제한을 함께 적용한다.
- 공고 설명 본문을 제외한 표시 모델만 반환하고 `Cache-Control: no-store`를 지정한다.

## 3. 저장 보관함 UI 구현

- `features/saved-library/saved-library.test.tsx`로 hydration, 실제 공고 표시, mock 라벨, 저장 해제, 빈 상태, 부분 실패, 재시도를 고정한다.
- 기존 `saved-jobs`와 `social-interactions` 구독 계약을 재사용한다.
- 공고 ID 변화 시 route를 취소 가능한 fetch로 호출한다.
- 전체·공고·커뮤니티 범위 전환과 키보드 이동을 구현한다.
- CSS Modules로 데스크톱 2열, 모바일 1열, 44px 동작 영역을 만든다.

## 4. 페이지와 진입 경로 연결

- `/career/saved` 페이지와 noindex metadata 테스트를 추가한다.
- 사용자 메뉴, 홈 바로가기, 내 커리어 intro에서 보관함으로 연결한다.
- 기존 AppShell, HomeFeed, CareerOverview 테스트에 링크 계약을 추가한다.

## 5. 브라우저 검증

- E2E fixture는 기존 실제 API 계약 모양의 공고 상세 응답을 그대로 사용한다.
- 1440px과 390px에서 실제 공고와 명시적 mock 커뮤니티를 함께 확인한다.
- 저장 해제 후 reload에도 제거 상태가 유지되는지 확인한다.
- 범위 전환, 44px 동작 영역, 가로 넘침, 콘솔 오류를 검사한다.

## 6. 완료 검증과 배포

- 전체 Vitest, Playwright, TypeScript, production build, audit를 실행한다.
- 독립 리뷰의 Critical/Important를 수정한다.
- `main`에 fast-forward 병합하고 원격 push한다.
- Vercel 웹·API 성공 상태와 운영 `/career/saved`를 데스크톱·모바일에서 확인한다.
