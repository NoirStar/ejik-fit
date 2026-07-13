# 내 커리어 현황 구현 계획

**목표:** 브라우저 저장 기술과 실제 적합도 API를 연결해 `/career`를 유용한 개인화 현황 화면으로 교체한다.

**아키텍처:** 서버 페이지는 상위 기술 제안만 실제 API에서 읽는다. 클라이언트 화면은 로컬 기술을 구독하고 기존 내부 fit route에 요청한다. 순수 모델이 응답을 과장 없는 지표·추천·분야 행으로 바꾼다.

---

## Task 1: 보유 기술 저장 변경을 구독 가능하게 만들기

**파일:**

- 수정: `apps/web/src/lib/owned-skills.ts`
- 수정: `apps/web/src/lib/owned-skills.test.ts`

1. `writeOwnedSkills`와 `clearOwnedSkills`가 기본 `localStorage`를 변경할 때 전용 이벤트를 보내고 구독자가 최신 정규화 기술을 받는 실패 테스트를 작성한다.
2. 다른 탭의 `storage` 이벤트도 같은 구독 함수로 전달하는 테스트를 작성한다.
3. `subscribeOwnedSkills(listener)`와 내부 알림을 최소 구현한다.
4. 기존 정규화, 검색 파라미터, 가짜 Storage 테스트가 모두 유지되는지 확인한다.

## Task 2: 적합도 응답을 정직한 커리어 화면 모델로 변환하기

**파일:**

- 생성: `apps/web/src/features/career/model.ts`
- 생성: `apps/web/src/features/career/model.test.ts`

1. 전체·신입·경력·신입·경력 조건과 payload 정규화를 테스트한다.
2. `matching_posting_count`, `strong_fit_posting_count`, 추천 개수의 직접 매핑을 테스트한다.
3. 추천 기술의 스킬맵·공고 검색 링크 인코딩과 필수·우대·근거 수를 테스트한다.
4. 분야 레이블과 보유·부족 기술 분리를 테스트한다.
5. 빈 응답을 0 지표와 빈 목록으로 안전하게 변환한다.

## Task 3: 내 커리어 클라이언트 화면과 서버 페이지 구현

**파일:**

- 생성: `apps/web/src/features/career/career-overview.tsx`
- 생성: `apps/web/src/features/career/career-overview.module.css`
- 생성: `apps/web/src/features/career/career-overview.test.tsx`
- 생성: `apps/web/src/app/career/page.test.tsx`
- 수정: `apps/web/src/app/career/page.tsx`

1. 기술 없음 상태, 기술 추가·중복 검증·삭제·전체 삭제 테스트를 먼저 작성한다.
2. 저장 기술 변경 이벤트를 받으면 화면과 fit 요청이 갱신되는 테스트를 작성한다.
3. 경력 select 변경 시 `owned_skills`와 `career_type` payload가 정확한지 테스트한다.
4. 준비·성공·오류·겹침 없음 상태의 제목과 행동을 테스트한다.
5. 서버 페이지가 `getSkillStats({ limit: 12 })`를 호출하고 성공한 기술명만 제안으로 전달하는 테스트를 작성한다.
6. 페이지와 컴포넌트를 최소 구현한다.
7. 20rem 기술 관리 열과 유연한 분석 열, 960px/640px 반응형, 44px 터치 영역, focus-visible과 reduced motion을 구현한다.

## Task 4: 실제 API와 배포 검증

1. 집중 테스트와 TypeScript를 실행한다.
2. 운영 API 응답을 프록시로 연결해 1440px, 820px, 390px에서 분석 결과와 화면을 검사한다.
3. 기술 추가·삭제, 경력 조건 변경, 헤더 내 스택 동기화, 오류 상태를 브라우저에서 확인한다.
4. 전체 Vitest, Playwright, TypeScript, production build를 실행한다.
5. 독립 코드 리뷰에서 Critical/Important를 수정한다.
6. main에 fast-forward 병합하고 원격 푸시한다.
7. GitHub CI와 Vercel 배포 성공 후 운영 `/career`를 재검증한다.

