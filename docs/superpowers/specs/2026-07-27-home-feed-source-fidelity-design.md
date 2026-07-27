<!-- Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 -->

# 홈 연속 피드와 채용 원문 신뢰성 개선 설계

작성일: 2026-07-27  
상태: 사용자 승인안을 문서화한 구현 전 설계  
대상 브랜치: `fix/home-feed-source-fidelity`

## 1. 배경

홈은 커뮤니티 글, 공식 채용공고, 시장 신호를 한곳에서 보여 주지만 현재 구현은 실제 연속 피드가
아니다. 서버에서 공고 40개를 받아도 모델에서 2개만 남기며, 시장 카드 2개와 현재 커뮤니티 글을
합친 뒤 끝난다. 커뮤니티 다음 페이지가 있을 때만 수동 `더 보기` 버튼이 나타난다.

공고 상세와 기업 로고도 데이터가 없어서가 아니라 원본 형식을 제대로 해석하지 못하는 문제가
확인됐다.

- LIG넥스원 상세 본문은 두 줄짜리 텍스트와 1128×4486 공고 이미지로 구성되지만 화면은 텍스트만
  렌더링한다.
- KRAFTON Greenhouse 본문은 HTML 엔티티로 한 번 더 감싸져 있어 현재 1회 파싱 뒤 HTML 태그가
  문자로 노출된다.
- 쿠팡 로고는 16×16 파비콘을 확대한다. 현재 등록 로고 193개 중 41개는 한 변이 64px 미만이고,
  LIG넥스원·SK AX·kt cloud는 회사 식별 매핑이 없다.
- 홈과 검색에는 실제 회원 글이 아닌 커뮤니티 가이드 예시가 섞여 있다.
- 커뮤니티 글 종류는 UI와 DB 모두 `커리어 질문`, `커리어 고민`, `면접 후기`만 허용한다.

## 2. 사용자와 화면의 역할

주 사용자는 국내 기술직 구직자다. 홈의 한 가지 역할은 사용자가 다음 행동을 고르게 하는 것이다.

- 커뮤니티 글을 읽거나 작성한다.
- 관심 있는 공식 공고를 열거나 저장한다.
- 시장에서 반복되는 기술을 보고 스킬맵으로 이동한다.

화면의 톤은 잠긴 `design.md`에 따라 `modern-minimal`과 실용적인 데이터 화면을 유지한다. Pretendard,
보라색 브랜드 토큰, 4px 간격 체계를 그대로 쓰며 별도 테마나 장식 카드를 추가하지 않는다.

## 3. 목표

1. 홈 첫 화면을 서버 렌더링하고, 이후 실제 데이터가 끝날 때까지 자동으로 이어지는 피드를 만든다.
2. 이미 표시된 카드의 순서와 스크롤 위치를 다음 페이지 로드 때문에 바꾸지 않는다.
3. 가이드 예시를 모든 운영 노출면에서 제거하고 실제 DB 글과 공식 공고만 보여 준다.
4. `일반` 글 종류를 첫 번째 기본값으로 추가한다.
5. 이중 인코딩 HTML과 이미지형 공고를 기존 저장 데이터에도 즉시 적용되도록 API 경계에서
   정상화한다.
6. 작은 로고를 확대하지 않고, 확인된 누락 회사에는 공식 원본을 연결한다.
7. 저사양 PC와 모바일에서도 스크롤 처리 때문에 메인 스레드가 지속해서 바빠지지 않게 한다.

## 4. 비목표

- 이미지형 공고 전체를 OCR로 검색 가능한 텍스트로 만드는 작업은 포함하지 않는다.
- 모든 저해상도 회사 로고를 이번 배치에서 새 원본으로 다시 조사하지 않는다. 대신 저해상도 확대를
  차단하고 선명한 이니셜로 대체한다.
- 홈 탭의 제품 의미 자체를 재설계하거나 새로운 추천 알고리즘을 만들지 않는다.
- 수집 기업 목록을 추가하는 작업은 이 설계와 분리한다.
- 원본 HTML을 브라우저에 직접 주입하지 않는다.

## 5. 홈 피드 설계

### 5.1 첫 화면

- 서버는 공고 요약 20개, 커뮤니티 글 10개, 시장 인사이트 최대 2개를 병렬로 가져온다.
- 첫 10개 카드의 순서를 서버에서 확정해 HTML로 렌더링한다. 커뮤니티 글이 hydration 뒤에 위로
  끼어드는 현상을 허용하지 않는다.
- 기본 추천 피드는 커뮤니티 1개와 공고 2개의 가중 라운드로빈을 사용한다.
- 시장 카드는 첫 페이지의 두 고정 지점에만 삽입하며 다음 페이지에서 반복하지 않는다.
- 한 소스가 부족하면 남아 있는 실제 소스가 빈 자리를 채운다. 현재처럼 커뮤니티 글이 1개뿐이어도
  공고로 피드가 계속 이어진다.

### 5.2 다음 페이지

- `IntersectionObserver` sentinel을 피드 끝 800px 전에 감지한다.
- `scroll` 이벤트 리스너는 사용하지 않는다.
- 한 페이지는 최대 10개 카드다. 관찰자가 여러 번 호출돼도 동시에 요청은 하나만 실행한다.
- 이미 서버에서 받은 항목이 남아 있으면 네트워크 요청 없이 다음 10개를 공개한다.
- 로컬 버퍼가 비면 같은 출처의 다음 커뮤니티 cursor와 공고 offset을 요청한다.
- 공고 요청은 브라우저에서 백엔드 주소를 직접 노출하지 않고 동일 출처 Next.js route handler를
  거친다. route handler는 `limit`, `offset`, `career_type`을 검증하고 기존 `getPostings`를 호출한다.
- 각 탭은 별도의 표시 순서 ledger를 가진다. 기본 추천 탭에서는 다음 결과가 항상 아래에 추가되고,
  이미 표시된 ID는 재배치하거나 중복 추가하지 않는다.
- 사용자가 새 글을 작성한 경우만 해당 글을 피드 맨 위에 넣는다. 삭제된 글은 ledger에서도 제거한다.

### 5.3 탭 동작

- `추천`: 커뮤니티·공고·첫 페이지 시장 신호를 혼합한다.
- `팔로잉`: 기존 following 전용 커뮤니티 cursor를 자동으로 이어 읽는다.
- `최신`: 커뮤니티 `createdAt`과 공고 `first_seen_at`을 기준으로 커뮤니티·공고를 정렬한다. 날짜가
  없는 항목은 뒤에 두고 시장 카드는 포함하지 않는다.
- `인기`: 현재 커뮤니티 반응 점수 의미를 유지한다. 공고와 시장 카드는 포함하지 않는다.
- 탭 전환은 각 탭에서 이미 불러온 항목 ledger를 유지한다. 페이지의 물리적인 스크롤 위치는
  브라우저 문서 하나를 공유한다.

### 5.4 상태와 접근성

- 로딩 중에는 작은 상태 문구만 표시하고 카드 모양 skeleton을 반복하지 않는다.
- 오류가 발생하면 자동 재시도를 반복하지 않고 `다시 불러오기` 버튼을 제공한다.
- 두 소스가 모두 끝나면 `새로 확인할 내용은 여기까지예요.`를 한 번 표시한다.
- 상태 문구는 `aria-live="polite"`, 오류는 `role="alert"`를 사용한다.
- sentinel은 포커스를 받지 않는다. 재시도 버튼은 최소 44×44px이고 키보드 포커스를 표시한다.
- 피드 카드는 `content-visibility: auto`와 보수적인 `contain-intrinsic-size`를 사용해 화면 밖 카드의
  렌더 비용을 줄인다.
- reduced-motion에서는 로딩 상태에 공간 이동 애니메이션을 사용하지 않는다.

## 6. 예시 커뮤니티 콘텐츠 제거

- 홈의 `StarterCommunityGuide`를 제거한다.
- 검색 snapshot에 `MOCK_SOCIAL_ITEMS`를 넣지 않는다. 로그인 여부와 관계없이 실제 Supabase 공개 글
  검색만 사용한다.
- `/posts/[id]`는 로컬 글 ID와 서버 UUID만 처리한다. 이전 예시 slug는 404가 된다.
- 최근 주제와 보관함은 기존 브라우저 저장소에 남은 `source: "mock"` 항목을 읽을 때 조용히
  폐기한다.
- 실제 `면접 후기`는 별도 가짜 카드 타입이 아니라 일반 서버 커뮤니티 글의 카테고리로 유지한다.

삭제할 운영 예시 파일은 다음과 같다.

- `apps/web/src/features/home-feed/starter-community-guide.tsx`
- `apps/web/src/features/home-feed/starter-community-guide.test.tsx`
- `apps/web/src/features/home-feed/mock-community.ts`
- `apps/web/src/features/home-feed/mock-post-details.ts`
- `apps/web/src/features/home-feed/mock-post-details.test.ts`
- `apps/web/src/features/home-feed/post-detail-view.tsx`
- `apps/web/src/features/home-feed/post-detail-actions.tsx`
- `apps/web/src/features/home-feed/post-detail-actions.test.tsx`

공유 CSS인 `post-detail.module.css`와 `post-detail-actions.module.css`는 실제 로컬/서버 상세가 사용하므로
삭제하지 않는다. 이 목록 외의 운영 파일은 구현 중 추가 승인 없이 삭제하지 않는다.

## 7. `일반` 글 종류

허용 순서는 다음으로 고정한다.

1. `일반`
2. `커리어 질문`
3. `커리어 고민`
4. `면접 후기`

- 새 글과 새 임시저장의 기본값은 `일반`이다.
- 기존 글과 임시저장의 카테고리는 변경하지 않는다.
- 레거시 로컬 글에 카테고리가 없을 때만 `일반`으로 해석한다.
- 서버 계약, mapper, editor, 검색, 로컬 저장 계약을 같은 상수에서 검증한다.
- Alembic `20260727_0025_community_general_category.py`에서
  `ck_community_posts_category`를 네 값으로 다시 만든다.
- PostgreSQL과 SQLite batch migration 양쪽을 테스트한다.
- 배포 순서는 DB 제약조건 확장 후 웹에서 `일반` 작성을 노출하는 순서다.

## 8. 공고 본문 신뢰성

### 8.1 이중 인코딩 HTML

`structured_plain_text`는 최대 두 번만 디코딩한다.

1. 현재와 같이 숨김 태그를 제거하고 HTML을 파싱한다.
2. 파싱 결과에 인코딩된 block tag가 실제로 남아 있을 때만 한 번 더 HTML로 파싱한다.
3. `h1`~`h6`, `li`, `br`, block 경계 보존 규칙을 다시 적용한다.
4. 일반적인 비교식 `a < b`나 문자로 의도된 꺾쇠는 HTML로 오인하지 않는다.

API detail에서 이 함수를 호출하므로 기존 KRAFTON DB 행도 배포 직후 정상 표시된다. Greenhouse
connector도 같은 함수로 `description_text`를 생성해 이후 수집과 검색·스킬 근거가 다시 오염되지
않게 한다.

### 8.2 이미지형 공고

Posting detail 응답에 다음 구조를 추가한다.

```text
description_images: [{ url, alt }]
```

- 저장된 `description_html`의 `src`, `data-src`, `data-original`을 검사한다.
- 상대 URL은 공고 원문 URL 기준으로 해석한다.
- HTTPS이면서 공고 원문과 hostname이 같은 URL만 허용한다.
- `data:`, `blob:`, 사용자정보가 포함된 URL, 다른 hostname은 거부한다.
- 본문 텍스트가 600자 미만이고 유효 이미지가 있을 때만 최대 3개를 반환한다. 장식 이미지가 많은
  일반 HTML 공고를 중복 렌더링하지 않기 위한 조건이다.
- 중복 URL은 제거한다.
- 원문 alt가 의미 있으면 사용하고, 없으면 `채용 공고 상세 내용 이미지 N`을 사용한다.

웹은 정규화된 텍스트 다음에 `공고 세부 내용은 기업이 이미지로 제공했습니다.`라는 설명과 이미지를
표시한다. 이미지는 `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`를 사용하고
원본 비율을 유지한다. 이미지가 실패해도 텍스트와 `공고 원문 보기` 링크는 남는다. 원본 HTML은
렌더링하지 않는다.

## 9. 기업 로고 품질

### 9.1 확인된 교체·추가

- 쿠팡: About Coupang 공식 SVG로 교체한다.
- LIG넥스원: 공식 CI 이미지와 alias를 추가한다.
- SK AX: 공식 SVG와 alias를 추가한다.
- kt cloud: 공식 SVG와 alias를 추가한다.

회사 slug가 있으면 회사명 추측보다 slug 매핑을 먼저 사용한다. 이름 alias와 출처 hostname은
fallback으로만 사용한다.

### 9.2 품질 하한선

- SVG는 기존 proxy 안전 검사를 통과할 때 사용한다.
- raster가 실제 표시 크기와 최대 2배 device pixel ratio를 충족하지 못하면 확대하지 않는다.
- 부족한 raster는 로딩 후 선명한 이니셜 mark로 교체한다.
- 이미지 실패도 동일한 이니셜 fallback을 사용한다.
- 공식 wordmark는 비율을 유지하며 임의 색상 변경, 찌그러뜨림, 잘라내기를 하지 않는다.
- `onLoad` 검사는 상태를 한 번만 바꾸며 재요청 loop를 만들지 않는다.

현재 누락 세 회사와 쿠팡에 대한 회귀 테스트, 작은 raster fallback 테스트, proxy SVG 안전 테스트를
추가한다.

## 10. 오류 처리와 보안

- 홈 공고 route는 정수 범위 밖 offset/limit과 허용하지 않는 `career_type`을 400으로 거부한다.
- 다음 페이지 응답은 기존 posting contract로 다시 검증한다.
- 요청 취소는 `AbortController`로 처리하며 탭 전환이나 unmount 뒤 상태를 갱신하지 않는다.
- 이미지 URL 파싱 실패는 공고 detail 전체 실패가 아니라 빈 `description_images`로 처리한다.
- HTML script/style/noscript/template은 디코딩 단계마다 제거한다.
- 로고와 공고 이미지 어디에도 `dangerouslySetInnerHTML`을 사용하지 않는다.

## 11. 성능 예산

- 첫 홈 공고 요청: 최대 20개 요약.
- 커뮤니티 첫 요청: 최대 10개.
- 피드 페이지: 최대 10개 카드.
- 공고 다음 페이지 API: 최대 20개 요약.
- 공고 상세 이미지: 첫 화면 eager 요청 0개, viewport 근처에서만 lazy 요청.
- scroll handler: 0개.
- 한 피드 source당 동시 다음 페이지 요청: 최대 1개.
- 중복 ID 렌더: 0개.

## 12. 테스트와 검증

### 12.1 웹 단위·통합 테스트

- 첫 10개가 서버 HTML에 있고 hydration 후 순서가 같다.
- observer가 남은 로컬 항목을 먼저 공개하고 필요한 경우에만 네트워크를 호출한다.
- observer 연속 호출 중 요청이 하나만 발생한다.
- 다음 페이지는 기존 ID 아래에만 추가되고 중복되지 않는다.
- 오류, 재시도, 종료 상태와 aria 속성이 정확하다.
- 가이드가 홈·검색에 없고 예시 slug가 404다.
- `일반`이 첫 옵션·기본값이며 기존 draft는 보존된다.
- LIG형 image detail이 안전한 이미지와 텍스트를 함께 렌더링한다.
- 다른 hostname과 비 HTTPS 이미지가 계약에서 거부된다.
- 쿠팡 SVG와 세 회사 alias가 선택된다.
- 저해상도 raster와 실패 이미지는 이니셜로 전환된다.

### 12.2 백엔드 테스트

- 이중 이스케이프 KRAFTON HTML이 heading/list 구조로 정상화되고 태그 문자가 남지 않는다.
- 정상 HTML 결과는 바뀌지 않는다.
- 비교식과 숨김 script/style은 안전하게 처리된다.
- 같은 hostname 이미지 추출, 상대 URL, 중복 제거, 최대 개수 제한을 검증한다.
- posting detail schema가 `description_images`를 반환한다.
- `일반` category model과 upgrade/downgrade migration을 검증한다.

### 12.3 브라우저·성능 검증

- 320, 375, 414, 768px와 데스크톱에서 가로 스크롤이 없다.
- 키보드만으로 탭, 카드 링크, 재시도 버튼을 사용할 수 있다.
- 모바일 저속 네트워크에서 중복 요청과 layout 상단 점프가 없다.
- Chromium performance smoke에서 observer idle 상태에 지속적인 main-thread 작업이 없다.
- LIG넥스원과 KRAFTON 운영 공고를 실제 응답으로 확인한다.

전체 검증은 웹 Vitest, TypeScript lint/typecheck, Next production build, 백엔드 pytest, 선택 Playwright
smoke 순으로 수행한다.

## 13. 배포와 데이터 갱신

1. DB migration을 먼저 적용한다.
2. 백엔드 API와 connector를 배포한다.
3. KRAFTON source-specific crawl을 dry-run으로 확인한 뒤 실제 재수집해 저장 텍스트와 스킬 근거를
   갱신한다.
4. 웹을 배포한다.
5. 운영 홈, LIG넥스원 상세, KRAFTON 상세, 쿠팡·LIG넥스원·SK AX·kt cloud 로고를 확인한다.

API 경계 정상화 덕분에 KRAFTON 화면 표시는 재수집 전에도 고쳐진다. 재수집은 검색과 스킬 근거의
저장 텍스트까지 바로잡기 위해 수행한다. LIG넥스원 이미지는 기존 `description_html`에 URL이 있으므로
DB 재수집 없이도 표시할 수 있다.

## 14. 예상 파일 영향

### 새 파일

- `apps/web/src/app/api/home-feed/postings/route.ts`
- `apps/web/src/app/api/home-feed/postings/route.test.ts`
- `apps/web/src/features/home-feed/feed-pagination.ts`
- `apps/web/src/features/home-feed/feed-pagination.test.ts`
- `apps/web/src/features/home-feed/use-home-feed-pagination.ts`
- `apps/web/src/features/home-feed/use-home-feed-pagination.test.tsx`
- `apps/web/src/features/jobs/job-description-images.tsx`
- `apps/web/src/features/jobs/job-description-images.test.tsx`
- `packages/backend/src/ejikfit/posting_content.py`
- `packages/backend/tests/test_posting_content.py`
- `packages/backend/alembic/versions/20260727_0025_community_general_category.py`

### 주요 수정 파일

- `.hallmark/preflight.json`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/page.test.tsx`
- `apps/web/src/app/search/page.tsx`
- `apps/web/src/app/posts/[id]/page.tsx`
- `apps/web/src/app/posts/[id]/page.test.tsx`
- `apps/web/src/app/jobs/[id]/page.test.tsx`
- `apps/web/src/features/home-feed/home-feed.tsx`
- `apps/web/src/features/home-feed/home-feed.module.css`
- `apps/web/src/features/home-feed/home-feed.test.tsx`
- `apps/web/src/features/home-feed/home-feed.styles.test.ts`
- `apps/web/src/features/home-feed/model.ts`
- `apps/web/src/features/home-feed/model.test.ts`
- `apps/web/src/features/home-feed/types.ts`
- `apps/web/src/features/home-feed/feed-order.ts`
- `apps/web/src/features/home-feed/feed-order.test.ts`
- `apps/web/src/features/home-feed/company-identity.ts`
- `apps/web/src/features/home-feed/company-identity.test.ts`
- `apps/web/src/features/home-feed/company-mark.tsx`
- `apps/web/src/features/home-feed/company-mark.test.tsx`
- `apps/web/src/features/home-feed/company-mark.module.css`
- `apps/web/src/app/company-logo-assets/[logoKey]/route.ts`
- `apps/web/src/app/company-logo-assets/[logoKey]/route.test.ts`
- `apps/web/src/features/jobs/job-detail-view.tsx`
- `apps/web/src/app/jobs/[id]/job-detail.module.css`
- `apps/web/src/lib/types.ts`
- `apps/web/src/lib/posting-contract.ts`
- `apps/web/src/lib/posting-contract.test.ts`
- `apps/web/src/lib/community-contract.ts`
- `apps/web/src/lib/local-community-posts.ts`
- `apps/web/src/features/community/community-draft.ts`
- `apps/web/src/features/community/community-migration.ts`
- `apps/web/src/features/community/server-post-editor.tsx`
- `apps/web/src/features/search/model.ts`
- `apps/web/src/features/search/search-results.tsx`
- `apps/web/src/features/saved-library/model.ts`
- `apps/web/src/lib/recent-community-topics.ts`
- `packages/backend/src/ejikfit/html_text.py`
- `packages/backend/src/ejikfit/connectors/lever_greenhouse.py`
- `packages/backend/src/ejikfit/api/postings.py`
- `packages/backend/src/ejikfit/api/schemas.py`
- `packages/backend/src/ejikfit/models.py`
- 관련 웹·백엔드 회귀 테스트

구현 계획에서 각 파일을 작은 TDD 단계로 나누며, 이 설계와 무관한 리팩터링은 하지 않는다.
