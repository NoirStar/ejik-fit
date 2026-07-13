# 커뮤니티 글 상세 구현 계획

## 1. 공유 브라우저 상태

파일:

- `apps/web/src/lib/social-interactions.ts`
- `apps/web/src/lib/social-interactions.test.ts`

순서:

1. 빈 상태와 손상 저장값 정규화 테스트를 작성한다.
2. 공감·저장 toggle과 저장 실패 테스트를 작성한다.
3. 로컬 댓글 검증, 추가, 정렬 테스트를 작성한다.
4. custom event와 storage event 구독 테스트를 작성한다.
5. 최소 구현으로 테스트를 통과시킨다.

## 2. 상세 mock 콘텐츠

파일:

- `apps/web/src/features/home-feed/mock-post-details.ts`
- 관련 모델 테스트

순서:

1. 모든 홈 social item id에 상세 콘텐츠가 존재하는지 테스트한다.
2. 글 본문 문단, 대표 예시 댓글, 관련 글 id를 타입으로 정의한다.
3. 면접 후기는 회사 유형·직무·단계를 기존 feed item에서만 가져온다.

## 3. 상세 상호작용

파일:

- `apps/web/src/features/home-feed/post-detail-actions.tsx`
- `apps/web/src/features/home-feed/post-detail-actions.module.css`
- `apps/web/src/features/home-feed/post-detail-actions.test.tsx`

순서:

1. 초기 공감·저장 상태 읽기 테스트를 작성한다.
2. toggle과 같은 탭 동기화 테스트를 작성한다.
3. 댓글 빈 값·길이·정상 제출 테스트를 작성한다.
4. localStorage 실패 시 성공을 주장하지 않는 테스트를 작성한다.
5. 접근 가능한 버튼, 폼 라벨, live announcement를 구현한다.

## 4. 서버 상세 화면

파일:

- `apps/web/src/app/posts/[id]/page.tsx`
- `apps/web/src/app/posts/[id]/page.test.tsx`
- `apps/web/src/app/posts/[id]/post-detail.module.css`
- `apps/web/src/features/home-feed/post-detail-view.tsx`

순서:

1. 동적 metadata와 not-found 테스트를 작성한다.
2. 커뮤니티 글, 면접 후기, 예시 데이터 고지 렌더링 테스트를 작성한다.
3. 기존 RouteShell을 상세 전용 읽기 화면으로 교체한다.
4. related post 링크와 모바일 단일 열을 구현한다.

## 5. 홈 피드 동기화

파일:

- `apps/web/src/features/home-feed/home-feed.tsx`
- `apps/web/src/features/home-feed/home-feed.test.tsx`

순서:

1. 저장·공감 상태가 재마운트 후 유지되는 테스트를 작성한다.
2. 상세에서 추가한 로컬 댓글이 홈 카드 댓글 수에 반영되는 테스트를 작성한다.
3. 기존 임시 state를 공유 상태 모듈로 교체한다.

## 6. 브라우저와 최종 검증

파일:

- `apps/web/e2e/post-detail.e2e.ts`

검증:

- 커뮤니티 카드에서 상세 진입
- 1440px, 390px overflow 0
- 공감·저장·댓글이 새로고침 뒤 유지
- 상세에서 홈으로 돌아왔을 때 상태 동기화
- 44px 주요 타깃과 모바일 하단 내비 여백
- console error 0
- 전체 Vitest, Playwright, TypeScript, production build
- 독립 리뷰 후 main fast-forward, push, CI/Vercel 운영 확인

