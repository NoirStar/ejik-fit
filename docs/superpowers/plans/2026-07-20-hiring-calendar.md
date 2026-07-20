# 실제 공고 기반 채용 일정 구현 계획

**목표:** 명시된 공고 마감일과 이직핏 최초 확인 시각만 사용해
`/career/calendar`에 월 달력, 가까운 마감, 최근 기업 활동을 제공한다.

**구조:** 백엔드는 달력 범위 쿼리와 최근 기업별 최초 확인 집계를 한 응답으로
제공한다. Next.js 서버 페이지는 월 범위를 계산하고, 클라이언트 컴포넌트는
저장 공고·관심 기업 필터와 접근 가능한 달력 표시만 담당한다.

## 1. 채용 일정 API

파일:

- 생성: `packages/backend/src/ejikfit/api/hiring.py`
- 수정: `packages/backend/src/ejikfit/api/schemas.py`
- 수정: `packages/backend/src/ejikfit/api/app.py`
- 테스트: `packages/backend/tests/test_hiring_api.py`

구현:

- `GET /api/hiring/overview`
- 입력: `start`, `end`, `activity_days`
- 최대 62일 범위와 7~30일 활동 범위를 검증
- 대한민국 시간 기준 시작/종료 경계
- 열린 공고 중 명시 마감일이 범위에 있는 공고 목록과 총수
- 전체 열린 공고 중 마감일 미표기 수
- 최근 활동 기간에 처음 확인된 열린 공고의 기업별 집계

검증:

- 날짜 경계, 닫힌 공고 제외, 마감일 미표기 수
- 기업별 신규 공고 수와 정렬
- 잘못된 범위의 422 응답

## 2. 프론트 데이터 계약

파일:

- 수정: `apps/web/src/lib/types.ts`
- 수정: `apps/web/src/lib/api.ts`
- 생성: `apps/web/src/features/hiring-calendar/model.ts`
- 테스트: `apps/web/src/features/hiring-calendar/model.test.ts`

구현:

- API 응답 타입과 런타임 정규화
- `YYYY-MM` 파싱과 6주 달력 범위 계산
- 날짜별 공고 그룹, 7일 내 마감 수, 월 이동 링크 생성
- 잘못된 날짜 데이터 거부

## 3. 채용 일정 UI

파일:

- 생성: `apps/web/src/features/hiring-calendar/hiring-calendar.tsx`
- 생성: `apps/web/src/features/hiring-calendar/hiring-calendar.module.css`
- 테스트: `apps/web/src/features/hiring-calendar/hiring-calendar.test.tsx`

구현:

- 한 줄 요약과 데이터 한계 안내
- 월 이동, 7열 달력, 날짜별 공고
- 가까운 마감과 최근 기업 활동
- 전체/저장/관심 기업 클라이언트 필터
- 저장 공고·관심 기업 구독
- 빈 결과와 오류 상태

필요한 동작만 테스트:

- 월 달력과 실제 마감 공고 렌더링
- 저장/관심 필터 전환
- 마감일 없는 공고를 달력에 만들지 않음

## 4. 라우팅과 진입점

파일:

- 생성: `apps/web/src/app/career/calendar/page.tsx`
- 수정: `apps/web/src/components/app-shell/app-shell.tsx`
- 수정: `apps/web/src/features/career/career-overview.tsx`

구현:

- 서버에서 월 범위를 계산하고 API 요청
- 사용자 메뉴와 내 커리어 상단에 `채용 일정` 링크 추가
- 기존 5개 모바일 주 내비게이션은 유지

## 5. 검증과 배포

- 백엔드 관련 테스트와 전체 테스트
- 프론트 관련 Vitest, TypeScript, 프로덕션 빌드
- 1440px와 390px 실제 브라우저 확인
- `main` 커밋과 푸시
- 운영 API 응답과 Vercel 화면 확인
