# 인증 기반 커뮤니티 완성 설계

## 1. 목표

커뮤니티에서 사용자가 `게시했다`고 인식하는 모든 새 글과 상호작용의 원본을
Supabase DB로 통일한다. 비로그인 사용자가 작성한 내용을 실제 게시물처럼
`localStorage` 피드에 노출하는 동작은 종료하고, 로그인 과정에서 입력이 사라지지
않도록 탭 단위 임시 초안만 보존한다.

이번 설계가 완료되면 로그인 사용자는 여러 기기에서 글·댓글·공감·저장·팔로우를
이어볼 수 있고, 글과 댓글을 수정하거나 삭제할 수 있다. 홈·검색·내 글·저장함은
동일한 서버 커뮤니티 원본을 사용하며, 이직핏이 만든 시작 콘텐츠는 실제 사용자
글과 별도 영역에서 읽기 전용으로 표시한다.

## 2. 확인된 현재 상태

- `community_posts`, `community_comments`, 반응, 저장, 팔로우, 신고 테이블과 RLS,
  제한된 column grant, 집계·알림 trigger는 이미 배포되어 있다.
- 로그인 사용자의 새 글과 서버 글 상호작용은 Supabase에 저장된다.
- 비로그인 사용자의 새 글·댓글·공감·저장·팔로우는 브라우저 저장소에 남고 실제
  피드 아이템처럼 표시된다.
- 로그인 시 브라우저 글과 댓글을 서버로 옮기는 idempotent migration이 있지만,
  홈 커뮤니티 hook이 실행되어야 migration이 시작된다.
- 서버 글과 댓글은 삭제할 수 있지만 수정 UI와 store method가 없다. DB grant는
  소유자가 글의 `category`, `title`, `body`, `tags`와 댓글의 `body`를 수정할 수
  있도록 이미 제한되어 있다.
- 서버 피드는 최신 20개, 상세 댓글은 50개로 잘리며 다음 페이지를 요청하는 UI가
  없다. 통합 검색도 전체 서버 커뮤니티를 검색하지 않는다.
- 운영 DB의 공개 조회 기준 사용자 프로필, 커뮤니티 글, 댓글은 각각 0건이다.
  따라서 현재 홈의 커뮤니티 인상은 시작 콘텐츠와 브라우저 글이 대부분 만든다.
- 내 기술, 커리어 조건, 저장 공고, 지원 단계와 관심 기업은 로그인 전에는
  브라우저 상태이고 로그인 후 `user_career_states`와 병합·동기화된다. 이 로컬
  값은 로그인 상태에서 서버 원본을 보조하는 화면 캐시이므로 커뮤니티 게시 문제와
  구분한다.
- 저장소 홈페이지로 등록된 `https://ejik-fit.vercel.app`은 현재
  `DEPLOYMENT_NOT_FOUND`를 반환한다. 최신 Vercel Web deployment URL은 성공
  상태지만 Vercel Authentication으로 보호되어 있어 일반 사용자가 열 수 없다.

## 3. 검토한 접근

### 선택: 인증된 계정만 DB에 게시

게스트는 공개 글과 시작 콘텐츠를 읽을 수 있지만 게시, 댓글, 공감, 저장, 팔로우,
신고는 로그인 후에만 수행한다. 작성 중인 값은 `sessionStorage`의 임시 초안으로만
보존하고 피드 데이터로 취급하지 않는다.

이 방식은 기존 RLS와 이메일 확인 계정을 그대로 사용하며 데이터 소유권이 가장
명확하다. 익명 스팸과 기기마다 분리된 가짜 게시 상태도 만들지 않는다.

### 제외: Supabase anonymous user를 자동 생성

게스트 행동도 DB에 저장할 수 있지만 현재 프로젝트에서 anonymous auth가 꺼져
있고, 익명 계정 정리·rate limit·계정 연결·남용 방지 정책이 새로 필요하다. 사용자가
계정 게시와 익명 게시를 구분하기도 어렵다.

### 제외: 현재 local-first 게시 유지

입력 마찰은 가장 작지만 새 글이 다른 사용자에게 보이지 않고 다른 기기에서
사라진다. 사용자가 이미 문제로 지적한 동작이며 실제 커뮤니티의 저장 약속을
충족하지 못한다.

## 4. 범위와 우선순위

### P0: 게시 원본과 데이터 소유권 정리

- 모든 새 커뮤니티 게시와 상호작용을 로그인 계정 DB 쓰기로 제한한다.
- 로그인 전 작성한 값은 게시물이 아닌 임시 초안으로 보존한다.
- 기존 브라우저 게시물은 손실 없이 계정으로 한 번 이관한다.
- 서버 상태와 브라우저 임시 상태를 UI 문구와 배지로 구분한다.
- 시작 콘텐츠의 반응·저장·팔로우 기능을 제거하고 읽기 전용 안내 영역으로 옮긴다.

### P1: 일상적으로 사용할 수 있는 커뮤니티 기능 완성

- 소유자 글 수정·삭제
- 소유자 댓글 수정·삭제
- 커서 기반 글·댓글 더 보기
- 서버 전체 커뮤니티 검색
- 홈, 검색, 내 글, 저장함, 팔로잉의 동일한 서버 데이터 계약
- 인증 복귀와 이메일 확인 뒤 초안 복원

### P2: 출시 경로 복구

- 일반 사용자가 인증 장벽 없이 접근할 canonical Web URL을 확정한다.
- 저장소 홈페이지, Supabase Site URL·Redirect URL, Vercel Production alias를
  같은 canonical URL로 맞춘다.
- 공개 URL의 홈·로그인·인증 callback과 API health를 smoke test한다.

운영자 신고 큐와 제재, 사용자 차단, 첨부 파일, 실시간 subscription, DM,
프로필 기반 자동 공고 매칭은 독립된 데이터·권한 설계가 필요한 후속 단위다.

## 5. 제품 상태

### 5.1 게스트

- 공개 서버 글과 읽기 전용 시작 콘텐츠를 볼 수 있다.
- 글쓰기 composer에서 내용을 입력할 수 있지만 `피드에 올리기`를 누르면 게시하지
  않고 임시 초안을 검증·저장한 뒤 로그인으로 이동한다.
- 서버 글의 댓글·공감·저장·팔로우·신고를 누르면 현재 상세 또는 홈 주소를 안전한
  `next`로 포함해 로그인으로 이동한다.
- 기존 버전에서 만든 로컬 글이 있으면 `이전 브라우저 글` 영역에서 읽고 삭제할 수
  있으며, 계정으로 옮길 수 있다는 안내를 표시한다.

### 5.2 로그인 사용자

- 새 글은 서버 성공 응답을 받은 뒤에만 피드에 추가한다.
- 글·댓글·반응·저장·팔로우는 계정에서 복원된다.
- 자기 글과 댓글에는 수정·삭제 제어가 보이고 다른 사용자의 콘텐츠에는 신고 제어가
  보인다.
- 브라우저에 남은 이전 글이 있으면 전역 계정 동기화 단계에서 자동 이관한다.
- 이관 실패 항목은 로컬에서 지우지 않고 계정 화면과 홈에 재시도 상태를 표시한다.

### 5.3 서버 또는 인증 장애

- 서버 읽기 실패 시 이전에 성공한 서버 목록을 유지하고 재시도 버튼을 표시한다.
- 쓰기 실패 시 입력 폼을 닫거나 값을 지우지 않는다.
- 인증 상태 확인이 3초 fallback에 도달했더라도 게시를 로컬 글로 전환하지 않는다.
  로그인 설정 오류를 명시하고 재시도를 제공한다.
- 시작 콘텐츠는 서버 오류의 대체 데이터처럼 합쳐서 실제 글 수나 반응 수를 만들지
  않는다.

## 6. 데이터 소유권

| 데이터 | 게스트 | 로그인 사용자 | 원본 |
| --- | --- | --- | --- |
| 공개 커뮤니티 글·댓글 | 읽기 | 읽기 | Supabase |
| 새 글·댓글 | 로그인 전 임시 초안 | 생성·수정·삭제 | Supabase |
| 공감·저장·팔로우·신고 | 로그인 요구 | 생성·해제 | Supabase |
| 이전 로컬 글·댓글 | 읽기·삭제 | 성공 후 서버 이관 | 이관 전 localStorage |
| 시작 콘텐츠 | 읽기 전용 | 읽기 전용 | 코드 fixture |
| 최근 본 주제 | 현재 브라우저 | 현재 브라우저 | localStorage |
| 내 기술·저장 공고 등 커리어 상태 | 현재 브라우저 | 서버 동기화 캐시 | Supabase + local cache |
| 작성 중 커뮤니티 초안 | 현재 탭 | 현재 탭 | sessionStorage |

최근 본 주제와 임시 초안은 공개 콘텐츠나 계정 활동이 아니므로 서버 이전 대상이
아니다. 시작 콘텐츠의 기존 로컬 반응 값은 읽지 않으며 개인정보 삭제 화면에서만
legacy key 정리를 계속 지원한다.

## 7. 웹 아키텍처

### 7.1 임시 초안

`community-draft` 모듈은 다음 versioned payload만 다룬다.

```ts
type CommunityDraft = {
  version: 1;
  category: CommunityCategory;
  title: string;
  body: string;
  tags: string[];
  savedAt: string;
};
```

- key: `ejik-fit:community-draft`
- 저장소: `sessionStorage`
- 읽을 때 기존 커뮤니티 validation과 동일한 길이·category·tag 규칙을 적용한다.
- composer를 취소하면 삭제한다.
- 로그인 성공 뒤 `/?compose=resume`에서 composer를 다시 열고 값을 채운다.
- 자동 게시하지 않는다. 사용자가 내용을 다시 확인하고 게시 버튼을 눌러야 한다.
- 서버 생성 성공 뒤에만 초안을 삭제한다.

### 7.2 인증 복귀

모든 커뮤니티 로그인 링크는 `safeAuthNextPath`를 통과한 same-origin 상대 경로만
사용한다. 홈 composer는 `/?compose=resume`, 상세 action은 현재
`/posts/{uuid}`를 `next`로 전달한다. 이메일 확인 callback과 비밀번호 로그인은
동일한 `next`를 보존한다.

로그인 화면의 혜택 목록에는 `글·댓글·저장 활동을 여러 기기에서 이어보기`를
추가한다. 인증 callback 오류가 발생해도 session 초안은 유지한다.

### 7.3 전역 legacy migration

현재 홈 hook 안에 결합된 migration 시작 책임을 인증된 앱 셸의 독립 hook으로
옮긴다. hook은 viewer ID마다 한 번 실행하고 다음 상태를 반환한다.

```ts
type CommunityMigrationState = {
  status: "idle" | "migrating" | "complete" | "partial" | "error";
  migratedPostIds: string[];
  failedPostIds: string[];
};
```

글 upsert, 댓글 upsert, 해당 글의 공감·저장 복원에 모두 성공한 게시물만
localStorage와 legacy interaction state에서 제거한다. 중간 실패, 새로고침, 다른
탭의 중복 실행에서도 `(author_id, client_origin_id)` unique contract로 중복을
만들지 않는다.

### 7.4 서버 store 계약

기존 `CommunityStore`에 다음 동작을 추가한다.

```ts
type CommunityCursor = {
  createdAt: string;
  id: string;
};

type CommunityPage<T> = {
  items: T[];
  nextCursor: CommunityCursor | null;
};

updatePost(
  authorId: string,
  postId: string,
  input: CreateCommunityPostInput,
): Promise<CommunityPost>;

updateComment(
  authorId: string,
  commentId: string,
  body: string,
): Promise<CommunityComment>;

listPostPage(options: {
  authorId?: string;
  before?: CommunityCursor;
  limit?: number;
}): Promise<CommunityPage<CommunityPost>>;

listCommentPage(options: {
  postId: string;
  before?: CommunityCursor;
  limit?: number;
}): Promise<CommunityPage<CommunityComment>>;

searchPosts(options: {
  query: string;
  before?: CommunityCursor;
  limit?: number;
}): Promise<CommunityPage<CommunityPost>>;
```

페이지는 `(created_at DESC, id DESC)` 순서를 사용한다. 기본·최대 크기는 글 20/50,
댓글 30/50, 검색 20/50이다. 마지막 행으로 다음 cursor를 만들며 다음 결과가 없으면
`null`을 반환한다.

수정 query는 소유자 ID와 콘텐츠 ID를 모두 제한하고 허용된 콘텐츠 column만
전송한다. update 결과가 한 행이 아니면 권한 또는 존재하지 않는 콘텐츠 오류로
처리한다.

### 7.5 서버 검색

검색 문자열은 앞뒤 공백을 제거하고 2~80자로 제한한다. untrusted 문자열을
PostgREST filter 문법에 직접 연결하지 않는다. 새 PostgreSQL RPC는 parameterized
query로 `title`, `body`, `category`, `tags`를 대소문자 구분 없이 검색하고 공개
post column과 공개 profile nickname만 반환한다.

RPC는 `SECURITY INVOKER`, 빈 `search_path`, anon/authenticated 실행 grant를
사용한다. PostgreSQL에서는 사용 가능한 경우 `pg_trgm` index를 만들고, extension을
사용할 수 없는 테스트 DB와 preview에서도 bounded `ILIKE` 검색은 동일하게
동작한다. 이메일, membership row, `client_origin_id`는 반환하지 않는다.

## 8. 화면 구성

### 홈

1. 실제 서버 글
2. `더 보기` 버튼
3. 서버 글이 없을 때 정직한 빈 상태와 로그인 글쓰기 CTA
4. 별도 `이직핏 커뮤니티 가이드` 읽기 전용 영역
5. 로그인하지 않은 기존 사용자의 `이전 브라우저 글` 영역

시작 콘텐츠는 서버 글 배열에 합치지 않고 실제 글 수, 팔로잉, 저장함에 포함하지
않는다. 시작 콘텐츠 상세에서는 공감·댓글·저장·팔로우 composer를 제거한다.

### 상세

- 서버 글은 본문, 작성자, 생성·수정 시각, 실제 집계와 서버 댓글을 표시한다.
- 소유자 글에는 `수정`, `삭제`; 다른 사용자의 글에는 `신고`를 표시한다.
- 댓글 소유자는 inline 수정과 삭제를 사용할 수 있다.
- 수정 폼은 취소 시 원래 값을 복원하고 실패 시 사용자의 편집 값을 유지한다.
- 댓글은 최신 30개를 먼저 표시하고 `이전 댓글 더 보기`로 이어서 불러온다.

### 검색

- 커뮤니티 검색은 서버 RPC 결과를 기본으로 사용한다.
- 같은 검색어의 시작 콘텐츠는 `가이드 콘텐츠` 하위 영역으로 분리한다.
- 이전 로컬 글은 현재 브라우저에 실제로 존재할 때만 `이전 브라우저 글` 영역에
  표시한다.
- 서버 실패를 0건으로 표현하지 않고 실패 상태와 재시도를 표시한다.

### 내 글·저장함·팔로잉

- `내 글`은 서버의 현재 계정 글을 기본으로 페이지 단위 조회한다.
- migration에 실패한 이전 로컬 글만 별도 복구 영역에 남긴다.
- 저장함은 서버 저장 membership으로 서버 글을 복원한다.
- 팔로잉은 서버 author follow membership과 서버 글만 사용한다.
- 시작 콘텐츠와 fixture author는 이 세 화면에서 제거한다.

## 9. 오류·동시성 처리

- 각 mutation key로 같은 글·댓글 action의 중복 제출을 막는다.
- 생성·수정·삭제는 서버 확인 전 UI 원본을 제거하지 않는다.
- 공감·저장·팔로우는 현재의 bounded optimistic update를 유지하되 실패하면 이전
  membership과 count로 되돌리고 한 번만 읽을 수 있는 오류를 알린다.
- 페이지 요청은 request sequence와 viewer ID를 함께 확인해 느린 이전 응답이 새
  계정 상태를 덮지 못하게 한다.
- 수정 중 다른 곳에서 삭제된 콘텐츠는 `이미 삭제되었거나 접근할 수 없습니다`로
  처리하고 목록에서 재조회한다.
- migration과 일반 feed loading은 독립 상태로 관리해 migration 실패가 공개 글
  읽기를 막지 않는다.

## 10. 보안·개인정보

- 게스트 insert/update/delete는 RLS와 grant 양쪽에서 계속 거부한다.
- 모든 update는 소유자 column predicate와 RLS를 동시에 통과해야 한다.
- public query는 명시적 column 목록만 사용하고 이메일·private membership·신고
  처리 상태를 노출하지 않는다.
- 검색 RPC는 dynamic SQL을 사용하지 않고 limit과 cursor를 함수 내부에서 제한한다.
- session draft는 계정 데이터가 아니며 다른 탭·기기로 동기화하지 않는다고
  composer에 명시한다.
- 개인정보 안내와 계정 export는 서버 커뮤니티와 session draft의 차이를 설명한다.
- 실제 사용자인 것처럼 보이게 하는 seed 계정·가짜 DB 게시물은 만들지 않는다.

## 11. 접근성·반응형

- composer 복귀, 수정, 삭제 confirmation 뒤 원래 trigger로 focus를 복원한다.
- 오류와 migration 상태는 `role=status` 또는 `role=alert`로 중복 없이 알린다.
- `더 보기`는 실제 남은 수를 모르면 `글 더 보기`처럼 추측 없는 이름을 사용한다.
- 메뉴·편집·삭제·로그인 action은 44px 이상의 터치 영역을 유지한다.
- 390px에서 composer, owner menu, inline comment editor가 가로로 넘치지 않는다.
- reduced motion에서는 dialog와 list insertion animation을 생략한다.

## 12. 성능

- 최초 홈 요청은 서버 글 20개와 공개 profile 필드만 읽는다.
- private membership 조회는 현재 화면 post/author ID로 제한하고 병렬 실행한다.
- 페이지 결과는 기존 목록에 dedupe하며 전체 목록을 매 mutation마다 다시 읽지 않는다.
- search는 250ms debounce가 아니라 명시적 제출 또는 URL query 변경으로만 실행한다.
- realtime subscription과 무한 스크롤은 도입하지 않는다.
- 실제 DB 조회와 시작 콘텐츠 JS가 같은 초기 bundle을 키우지 않도록 가이드 영역은
  서버 정적 데이터 또는 필요 시 로드되는 작은 모듈로 유지한다.

## 13. 검증 전략

### 데이터와 보안

- owner update 성공, 타인·anon update 거부
- 검색 RPC의 공개 column, parameter binding, limit/cursor, 빈 query 거부
- cursor tie에서 중복·누락 없는 페이지
- migration의 성공 후 삭제, 부분 실패 보존, 재실행 idempotency

### 웹 단위·통합

- 게스트 submit이 로컬 게시물을 만들지 않고 초안 저장 후 로그인으로 이동
- 로그인 복귀가 초안을 복원하지만 자동 게시하지 않음
- 서버 성공 뒤 초안 삭제와 피드 반영
- 글·댓글 수정의 성공, 실패 값 보존, 취소 복원, owner 제어
- 실제 글/가이드/이전 로컬 글의 영역 분리
- 홈·검색·내 글·저장함·팔로잉에서 fixture membership 제거

### 브라우저

- 게스트 작성 → 로그인 이동 → 인증된 복귀 → 초안 확인 → DB 게시 → 새로고침 유지
- 다른 브라우저 context에서 로그인 후 같은 게시물 확인
- 글 수정 → 댓글 생성·수정 → 공감·저장 → 내 글·저장함 확인 → 삭제
- 1440px와 390px에서 overflow 0, action target 44px 이상, console error 0

실제 이메일 확인은 자동화된 CI 계정을 새로 생성하지 않는다. CI는 주입한 test
session/store fixture로 인증 경계를 검증하고, 운영 smoke는 읽기와 로그인 화면까지만
수행해 공개 콘텐츠를 오염시키지 않는다.

## 14. 배포와 완료 조건

코드 완료 조건:

1. backend migration/security test, web unit test, lint, production build가 통과한다.
2. product E2E와 별도 production performance budget이 통과한다.
3. `npm audit` high 이상이 0건이다.
4. migration offline SQL과 운영 적용 workflow가 통과한다.
5. `main`과 `origin/main` SHA가 일치하고 GitHub Actions가 성공한다.

운영 완료 조건:

1. canonical Web URL이 인증되지 않은 새 브라우저에서 HTTP 200을 반환한다.
2. Vercel deployment protection이 Production public traffic을 막지 않는다.
3. Supabase Site URL과 Redirect URL이 canonical Web URL의 `/auth/callback`을 허용한다.
4. 홈과 로그인 화면, API `/health`, 공개 커뮤니티 read가 정상 응답한다.
5. 실제 게시물 0건이면 정직한 빈 상태가 표시되고 시작 콘텐츠를 실제 사용자 글로
   계산하지 않는다.

Vercel 계정 권한이 없는 환경에서는 코드와 CI 완료 뒤 운영 완료 조건을 검증해
차단 항목으로 보고한다. 임의 도메인이나 보호 설정을 추측해 변경하지 않는다.

## 15. 이어서 처리할 독립 기능

커뮤니티 완료 후 다음 순서로 별도 설계·구현한다.

1. 신고 운영 큐, moderator 역할, 처리 이력과 사용자 차단
2. 계정 첫 로그인 onboarding과 이메일 확인 복귀 안내 강화
3. 기술 입력의 canonical catalog autocomplete와 controlled custom fallback
4. 운영 알림·수집 장애 상태와 공개 deployment smoke 자동화
5. 충분한 데이터가 쌓인 뒤 커뮤니티 정렬·추천과 선택적 realtime

프로필 기반 자동 공고 매칭은 사용자가 별도로 범위를 승인하기 전까지 구현하지
않는다.

## 16. 구현 상태 (2026-07-23)

### 완료된 범위

- 게스트 글쓰기는 검증된 `sessionStorage` 초안만 만들고 로그인 복귀 뒤 명시적인
  게시 확인을 요구한다. 서버 생성 성공 전에는 초안을 삭제하지 않는다.
- 앱 셸이 로그인 사용자별 legacy 이관을 한 번 실행한다. 글과 연결 댓글의 서버
  쓰기가 모두 성공한 항목만 로컬 원본을 삭제하며, 부분 실패 항목은 복구 영역과
  재시도 경로에 남긴다.
- 커뮤니티 store는 `(created_at DESC, id DESC)` 커서 페이지, 소유자 제한 글·댓글
  수정, parameter-bound 공개 검색 RPC를 사용한다.
- 홈·검색·내 글·저장함·팔로잉은 실제 서버 글과 membership을 기준으로 동작한다.
  시작 콘텐츠는 읽기 전용 가이드로 분리되어 실제 개수와 상호작용에 포함되지
  않는다.
- 글·댓글 생성·수정·삭제, 공감·저장·팔로우·신고와 계정 데이터 export/delete의
  Supabase 경계 및 RLS 보안 검증이 마련되어 있다.
- 로컬 Supabase 호환 브라우저 픽스처가 익명·타 사용자 쓰기를 차단하면서 게시,
  새로고침, 두 번째 브라우저 확인, 글 수정, 댓글 생성·수정·삭제, 서버 검색, 글
  삭제까지 한 여정으로 검증한다.
- `npm run smoke:public`은 쿠키 없이 홈·개인정보·검색·안전한 404를 확인하고
  `DEPLOYMENT_NOT_FOUND`, Vercel Authentication 보호 화면, 외부 로그인 redirect를
  실패로 분류한다.

### 의도적으로 연기한 범위

- moderator 역할, 신고 운영 콘솔, 처리 이력과 사용자 차단
- 이미지·문서 등 게시물 첨부 파일
- realtime 피드·댓글·알림 subscription
- 사용자 간 직접 메시지(DM)
- 개인 프로필을 이용한 자동 공고 매칭

이 항목들은 각각 별도의 권한, 보존 기간, 남용 방지 및 개인정보 동의 설계가
필요하므로 이번 커뮤니티 영속성 완료 범위에 포함하지 않는다.
