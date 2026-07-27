# Home Feed and Source Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 데이터만 사용하는 자동 홈 피드와 자연스러운 `일반` 글쓰기, 안전하게 복원되는 채용 원문, 선명한 기업 로고를 한 번의 배포 가능한 변경으로 완성한다.

**Architecture:** 변경은 커뮤니티 신뢰성, 공고 본문, 로고, 홈 피드의 네 트랙으로 분리해 각각 테스트와 커밋을 갖는다. 홈은 서버가 만든 초기 source queue를 렌더링하고 client pager가 append-only ledger를 관리하며, 공고 다음 페이지는 동일 출처 Next route handler를 통해 가져온다. 공고 API는 HTML을 안전한 텍스트와 제한된 이미지 목록으로 구조화하고 웹은 원본 HTML을 직접 렌더링하지 않는다.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2, TypeScript 5.8, Vitest 3.2, Testing Library, Playwright 1.61, Python 3.12, FastAPI, Pydantic, SQLAlchemy 2, Alembic, BeautifulSoup 4, pytest 8.4.

## Global Constraints

- 새 런타임 의존성을 추가하지 않는다.
- `design.md`의 modern-minimal 시스템, Pretendard, 기존 OKLCH 토큰, 4px 간격을 유지한다.
- 320px, 375px, 414px, 768px와 데스크톱에서 가로 스크롤이 없어야 한다.
- 버튼과 터치 제어는 최소 44×44 CSS px, 모든 키보드 포커스는 즉시 보여야 한다.
- 홈 첫 공고 요청은 20개, 커뮤니티 첫 요청은 10개, 표시 페이지는 10개, 다음 공고 요청은 최대 20개다.
- `scroll` 이벤트를 사용하지 않고 `IntersectionObserver`의 `rootMargin: "800px 0px"`를 사용한다.
- `dangerouslySetInnerHTML`을 추가하지 않는다.
- 공고 이미지는 HTTPS이며 공고 URL과 hostname이 같을 때만 최대 3개를 허용한다.
- DB 제약조건 migration을 웹의 `일반` 작성 UI보다 먼저 배포할 수 있어야 한다.
- 설계서에 명시된 8개 가짜 콘텐츠 전용 파일 외에는 운영 파일을 삭제하지 않는다.
- 모든 사용자 문구는 자연스러운 한국어로 작성한다.

---

### Task 1: 서버 커뮤니티 `일반` 카테고리와 migration

**Files:**
- Create: `packages/backend/alembic/versions/20260727_0025_community_general_category.py`
- Modify: `packages/backend/src/ejikfit/models.py:360-375`
- Test: `packages/backend/tests/test_models.py:105-175`
- Test: `packages/backend/tests/test_migration_offline.py:1-75`

**Interfaces:**
- Consumes: 기존 `community_posts` 테이블과 `ck_community_posts_category` 제약조건.
- Produces: `category IN ('일반', '커리어 질문', '커리어 고민', '면접 후기')`를 허용하는 DB와 동일한 SQLAlchemy metadata.

- [ ] **Step 1: `일반`을 저장하고 migration SQL을 확인하는 실패 테스트 작성**

```python
def test_server_community_post_accepts_general_category() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    author_id = uuid.uuid4()
    post_id = uuid.uuid4()

    with Session(engine) as session:
        session.add(UserProfile(user_id=author_id, nickname="작성자"))
        session.add(
            models.CommunityPost(
                id=post_id,
                author_id=author_id,
                category="일반",
                title="그냥 나누는 이야기",
                body="질문이나 후기가 아니어도 작성할 수 있습니다.",
                tags=[],
            )
        )
        session.commit()
        saved = session.get(models.CommunityPost, post_id)
        assert saved is not None
        assert saved.category == "일반"
```

`test_offline_migration_includes_conditional_pgroonga_index`에는 다음 검증을 추가한다.

```python
assert "'일반', '커리어 질문', '커리어 고민', '면접 후기'" in sql
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_models.py::test_server_community_post_accepts_general_category \
  packages/backend/tests/test_migration_offline.py -q
```

Expected: `일반` 행이 `ck_community_posts_category`를 위반하거나 migration SQL 검증이 실패한다.

- [ ] **Step 3: metadata와 가역 migration 구현**

`models.py` 제약조건을 다음으로 교체한다.

```python
CheckConstraint(
    "category IN ('일반', '커리어 질문', '커리어 고민', '면접 후기')",
    name="ck_community_posts_category",
),
```

새 migration은 다음 public contract를 구현한다.

```python
revision: str = "20260727_0025"
down_revision: str | None = "20260723_0024"

NEW_CATEGORY_CHECK = (
    "category IN ('일반', '커리어 질문', '커리어 고민', '면접 후기')"
)
OLD_CATEGORY_CHECK = (
    "category IN ('커리어 질문', '커리어 고민', '면접 후기')"
)

def _replace_category_constraint(expression: str) -> None:
    with op.batch_alter_table("community_posts") as batch:
        batch.drop_constraint("ck_community_posts_category", type_="check")
        batch.create_check_constraint("ck_community_posts_category", expression)

def upgrade() -> None:
    _replace_category_constraint(NEW_CATEGORY_CHECK)

def downgrade() -> None:
    op.execute(
        "UPDATE community_posts SET category = '커리어 질문' WHERE category = '일반'"
    )
    _replace_category_constraint(OLD_CATEGORY_CHECK)
```

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 1 Step 2의 명령.  
Expected: `2 passed` 이상, failure 0.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/models.py \
  packages/backend/alembic/versions/20260727_0025_community_general_category.py \
  packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py
git commit -m "feat: allow general community posts"
```

### Task 2: 웹 `일반` 계약·기본값·편집 UI

**Files:**
- Modify: `apps/web/src/lib/community-contract.ts:1-6`
- Modify: `apps/web/src/lib/local-community-posts.ts:15-24`
- Modify: `apps/web/src/features/community/community-migration.ts:122-132`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx:110-125,1290-1360`
- Test: `apps/web/src/lib/local-community-posts.test.ts`
- Test: `apps/web/src/features/community/community-draft.test.ts`
- Test: `apps/web/src/features/community/community-migration.test.ts`
- Test: `apps/web/src/features/community/server-post-editor.test.tsx`
- Test: `apps/web/src/features/home-feed/home-feed.test.tsx`

**Interfaces:**
- Consumes: Task 1의 DB 허용 값.
- Produces: `COMMUNITY_CATEGORIES`, `LocalCommunityPostCategory`, composer/editor가 공유하는 네 값과 기본값 `일반`.

- [ ] **Step 1: 계약과 기본값 실패 테스트 작성**

```ts
expect(COMMUNITY_CATEGORIES).toEqual([
  "일반",
  "커리어 질문",
  "커리어 고민",
  "면접 후기",
]);
expect(DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY).toBe("일반");

const result = createLocalCommunityPost(
  { title: "그냥 쓰는 글", body: "종류를 고르지 않은 글입니다.", tags: [] },
  { id: "local-general", createdAt: "2026-07-27T00:00:00.000Z", storage },
);
expect(result.post?.category).toBe("일반");
```

HomeFeed 테스트에는 composer를 열고 다음을 검증한다.

```ts
expect(screen.getByRole("radio", { name: "일반" })).toBeChecked();
expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
  "일반",
  "커리어 질문",
  "커리어 고민",
  "면접 후기",
]);
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  src/lib/local-community-posts.test.ts \
  src/features/community/community-draft.test.ts \
  src/features/community/community-migration.test.ts \
  src/features/community/server-post-editor.test.tsx \
  src/features/home-feed/home-feed.test.tsx
```

Expected: `일반`이 계약에 없고 기본값이 `커리어 질문`이라 실패한다.

- [ ] **Step 3: 하나의 순서와 기본값 구현**

```ts
export const COMMUNITY_CATEGORIES = [
  "일반",
  "커리어 질문",
  "커리어 고민",
  "면접 후기",
] as const;
```

`local-community-posts.ts`는 별도 배열을 복제하지 않는다.

```ts
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
} from "./community-contract";

export const LOCAL_COMMUNITY_POST_CATEGORIES = COMMUNITY_CATEGORIES;
export type LocalCommunityPostCategory = CommunityCategory;
export const DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY = "일반" as const;
```

`normalizePost` 반환값은 category가 없을 때도 기본값을 기록한다.

```ts
category: normalizeCategory(value.category) ?? DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY,
```

레거시 서버 이전도 같은 기본값을 사용한다.

```ts
category: localPost.category ?? DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY,
```

Home composer 옵션은 `COMMUNITY_CATEGORIES`로 만들고 `EMPTY_DRAFT.category`는 기본 상수를 쓴다.

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 2 Step 2의 명령.  
Expected: 지정 test files 모두 pass.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/lib/community-contract.ts apps/web/src/lib/local-community-posts.ts \
  apps/web/src/lib/local-community-posts.test.ts \
  apps/web/src/features/community/community-draft.test.ts \
  apps/web/src/features/community/community-migration.ts \
  apps/web/src/features/community/community-migration.test.ts \
  apps/web/src/features/community/server-post-editor.test.tsx \
  apps/web/src/features/home-feed/home-feed.tsx \
  apps/web/src/features/home-feed/home-feed.test.tsx
git commit -m "feat: add general community post type"
```

### Task 3: 운영 가이드·가짜 커뮤니티 콘텐츠 제거

**Files:**
- Modify: `apps/web/src/app/search/page.tsx`
- Modify: `apps/web/src/app/posts/[id]/page.tsx`
- Modify: `apps/web/src/features/home-feed/model.ts`
- Modify: `apps/web/src/features/home-feed/types.ts`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/feed-order.ts`
- Modify: `apps/web/src/features/search/model.ts`
- Modify: `apps/web/src/features/search/search-results.tsx`
- Modify: `apps/web/src/features/saved-library/model.ts`
- Modify: `apps/web/src/lib/recent-community-topics.ts`
- Modify: `apps/web/src/app/posts/[id]/post-detail.module.css`
- Test: `apps/web/src/app/page.test.tsx`
- Test: `apps/web/src/app/search/page.test.tsx`
- Test: `apps/web/src/app/posts/[id]/page.test.tsx`
- Test: `apps/web/src/features/home-feed/model.test.ts`
- Test: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Test: `apps/web/src/features/home-feed/feed-order.test.ts`
- Test: `apps/web/src/features/search/model.test.ts`
- Test: `apps/web/src/features/search/search-results.test.tsx`
- Test: `apps/web/src/features/saved-library/model.test.ts`
- Test: `apps/web/src/lib/recent-community-topics.test.ts`
- Modify: `apps/web/e2e/post-detail.e2e.ts`
- Delete: `apps/web/src/features/home-feed/starter-community-guide.tsx`
- Delete: `apps/web/src/features/home-feed/starter-community-guide.test.tsx`
- Delete: `apps/web/src/features/home-feed/mock-community.ts`
- Delete: `apps/web/src/features/home-feed/mock-post-details.ts`
- Delete: `apps/web/src/features/home-feed/mock-post-details.test.ts`
- Delete: `apps/web/src/features/home-feed/post-detail-view.tsx`
- Delete: `apps/web/src/features/home-feed/post-detail-actions.tsx`
- Delete: `apps/web/src/features/home-feed/post-detail-actions.test.tsx`

**Interfaces:**
- Consumes: 실제 `CommunityPostFeedItem`과 Supabase community search.
- Produces: 홈·검색·상세·최근 주제에 `source: "mock"`가 없는 운영 경로. 로컬 ID와 서버 UUID 이외의 `/posts/[id]`는 404.

- [ ] **Step 1: 실제 콘텐츠만 남는 실패 테스트 작성**

```ts
render(<HomeFeed snapshot={buildSnapshot()} />);
expect(screen.queryByRole("region", { name: "이직핏 커뮤니티 가이드" }))
  .not.toBeInTheDocument();
expect(screen.queryByText("읽기 전용 커뮤니티 예시")).not.toBeInTheDocument();
```

검색 page mock 인수와 예시 slug도 검증한다.

```ts
expect(buildSearchSnapshot).toHaveBeenCalledWith(
  expect.objectContaining({ communityItems: [] }),
);
await PostPage({ params: Promise.resolve({ id: "career-move-3y-backend" }) });
expect(notFound).toHaveBeenCalledOnce();
```

최근 주제 정규화는 다음을 검증한다.

```ts
expect(normalizeRecentCommunityTopics([
  mockTopic,
  { ...mockTopic, postId: "local-real", source: "local" },
])).toEqual([expect.objectContaining({ postId: "local-real" })]);
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  src/app/page.test.tsx src/app/search/page.test.tsx \
  'src/app/posts/[id]/page.test.tsx' \
  src/features/home-feed/model.test.ts src/features/home-feed/home-feed.test.tsx \
  src/features/home-feed/feed-order.test.ts src/features/search/model.test.ts \
  src/features/search/search-results.test.tsx src/features/saved-library/model.test.ts \
  src/lib/recent-community-topics.test.ts
```

Expected: 가이드 region과 mock search/detail 기대 때문에 실패한다.

- [ ] **Step 3: runtime mock import와 타입 분기 제거**

`PostPage`의 끝은 다음처럼 실제 ID만 허용한다.

```tsx
export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  if (isLocalCommunityPostId(id)) return <LocalPostDetail postId={id} />;
  if (isCommunityUuid(id)) return <ServerPostDetail postId={id} />;
  notFound();
}
```

검색 snapshot은 두 경로 모두 실제 초기 예시를 비운다.

```ts
communityItems: [],
```

`HomeFeedSnapshot`에서 `starterGuideItems`를 제거하고 HomeFeed의
`<StarterCommunityGuide items={snapshot.starterGuideItems} />` 렌더를 삭제한다. `FeedItem`은
`CommunityPostFeedItem | MarketInsightFeedItem | RecommendedJobFeedItem`만 허용하고,
`CommunityPostFeedItem.source`는 `"local" | "server"`로 제한한다.

최근 주제 validator는 다음 source만 받는다.

```ts
export type RecentCommunityTopic = {
  postId: string;
  title: string;
  topicLabel: string;
  source: "local" | "server";
  viewedAt: string;
};

if (value.source !== "local" && value.source !== "server") return null;
```

가짜 타입에만 의존하던 import와 CSS `.mockBadge`를 제거한 뒤 명시된 8개 파일을 삭제한다.

- [ ] **Step 4: 집중 테스트와 TypeScript 통과 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  src/app/page.test.tsx src/app/search/page.test.tsx \
  'src/app/posts/[id]/page.test.tsx' \
  src/features/home-feed src/features/search src/features/saved-library/model.test.ts \
  src/lib/recent-community-topics.test.ts
npm run lint
```

Expected: tests pass, TypeScript error 0, 삭제 파일 import 0.

- [ ] **Step 5: 커밋**

```bash
git add -A apps/web/src apps/web/e2e/post-detail.e2e.ts
git commit -m "refactor: remove mock community content"
```

### Task 4: KRAFTON 이중 인코딩 HTML 정상화

**Files:**
- Modify: `packages/backend/src/ejikfit/html_text.py`
- Modify: `packages/backend/src/ejikfit/connectors/lever_greenhouse.py:145-180`
- Test: `packages/backend/tests/test_html_text.py`
- Test: `packages/backend/tests/test_lever_greenhouse_connector.py`

**Interfaces:**
- Consumes: raw/escaped HTML string과 fallback text.
- Produces: `structured_plain_text(html, fallback) -> str`, HTML tag 문자가 노출되지 않는 Greenhouse `description_text`.

- [ ] **Step 1: KRAFTON 형식과 비교식 회귀 테스트 작성**

```python
def test_structured_plain_text_reparses_encoded_block_html() -> None:
    html = (
        "&lt;div class=&quot;content-intro&quot;&gt;"
        "&lt;h4&gt;우리 팀을 소개합니다&lt;/h4&gt;"
        "&lt;ul&gt;&lt;li&gt;게임 서버 개발&lt;/li&gt;&lt;/ul&gt;"
        "&lt;script&gt;alert(1)&lt;/script&gt;&lt;/div&gt;"
    )
    result = structured_plain_text(html)
    assert result == "### 우리 팀을 소개합니다\n• 게임 서버 개발"
    assert "<h4>" not in result
    assert "alert" not in result

def test_structured_plain_text_keeps_literal_comparison_text() -> None:
    assert structured_plain_text("<p>지연 시간은 a &lt; b 조건입니다.</p>") == (
        "지연 시간은 a < b 조건입니다."
    )
```

Greenhouse fixture에는 encoded `<h4>`/`<li>` content를 넣고 opening text에 marker가 남는지 검증한다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_html_text.py \
  packages/backend/tests/test_lever_greenhouse_connector.py -q
```

Expected: 결과에 `<h4>`와 `<li>` 문자가 남아 실패한다.

- [ ] **Step 3: block tag가 인코딩된 경우에만 최대 두 번 해제**

```python
import html as html_module

_ENCODED_BLOCK_TAG = re.compile(
    r"&lt;/?(?:address|article|aside|blockquote|div|h[1-6]|li|ol|p|section|table|td|th|tr|ul|br)\b",
    re.IGNORECASE,
)

def _unwrap_encoded_html(value: str) -> str:
    current = value
    for _ in range(2):
        if _ENCODED_BLOCK_TAG.search(current) is None:
            break
        decoded = html_module.unescape(current)
        if decoded == current:
            break
        current = decoded
    return current
```

`structured_plain_text`의 첫 BeautifulSoup 입력은 `_unwrap_encoded_html(html)`로 바꾼다.
Greenhouse description은 `_html_text` 대신 같은 중앙 helper를 쓴다.

```python
content = structured_plain_text(_text(item.get("content")) or "")
values.append(content)
return _unique_join(values)
```

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 4 Step 2의 명령.  
Expected: all pass.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/html_text.py \
  packages/backend/src/ejikfit/connectors/lever_greenhouse.py \
  packages/backend/tests/test_html_text.py \
  packages/backend/tests/test_lever_greenhouse_connector.py
git commit -m "fix: normalize escaped greenhouse descriptions"
```

### Task 5: 안전한 이미지형 공고 API

**Files:**
- Create: `packages/backend/src/ejikfit/posting_content.py`
- Create: `packages/backend/tests/test_posting_content.py`
- Modify: `packages/backend/src/ejikfit/api/schemas.py:20-45`
- Modify: `packages/backend/src/ejikfit/api/postings.py:80-125`
- Test: `packages/backend/tests/test_postings_api.py`

**Interfaces:**
- Consumes: `description_html`, 정규화된 `description_text`, 공고 `source_url`.
- Produces: `posting_description_images(...) -> list[dict[str, str]]`와 API `description_images: [{url, alt}]`.

- [ ] **Step 1: URL 정책과 API 응답 실패 테스트 작성**

```python
def test_extracts_sparse_same_host_description_images() -> None:
    html = """
      <p>상시 채용입니다.</p>
      <img data-src="/upload/full.png" alt="">
      <img src="https://tracker.example/pixel.png">
      <img src="/upload/full.png">
    """
    assert posting_description_images(
        html,
        "상시 채용입니다.",
        "https://ligdna.recruiter.co.kr/app/jobnotice/view?id=1",
    ) == [{
        "url": "https://ligdna.recruiter.co.kr/upload/full.png",
        "alt": "채용 공고 상세 내용 이미지 1",
    }]

def test_skips_images_for_text_rich_posting() -> None:
    assert posting_description_images(
        '<img src="/detail.png">',
        "가" * 600,
        "https://example.com/jobs/1",
    ) == []
```

API test의 expected detail에 `description_images`를 추가한다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_posting_content.py \
  packages/backend/tests/test_postings_api.py -q
```

Expected: module 또는 schema field가 없어 실패한다.

- [ ] **Step 3: extractor와 Pydantic field 구현**

```python
from urllib.parse import urljoin, urlsplit, urlunsplit
from bs4 import BeautifulSoup

MAX_DESCRIPTION_IMAGES = 3
SPARSE_DESCRIPTION_LIMIT = 600

def posting_description_images(
    description_html: str,
    description_text: str,
    source_url: str,
) -> list[dict[str, str]]:
    if len(description_text.strip()) >= SPARSE_DESCRIPTION_LIMIT:
        return []
    source = urlsplit(source_url)
    if source.scheme != "https" or not source.hostname:
        return []

    images: list[dict[str, str]] = []
    seen: set[str] = set()
    soup = BeautifulSoup(description_html, "lxml")
    for image in soup.find_all("img"):
        raw = next(
            (
                str(image.get(name)).strip()
                for name in ("src", "data-src", "data-original")
                if image.get(name) and str(image.get(name)).strip()
            ),
            "",
        )
        candidate = urlsplit(urljoin(source_url, raw))
        if (
            candidate.scheme != "https"
            or candidate.hostname != source.hostname
            or candidate.username is not None
            or candidate.password is not None
        ):
            continue
        url = urlunsplit((candidate.scheme, candidate.netloc, candidate.path, candidate.query, ""))
        if url in seen:
            continue
        seen.add(url)
        raw_alt = str(image.get("alt") or "").strip()
        alt = raw_alt[:200] or f"채용 공고 상세 내용 이미지 {len(images) + 1}"
        images.append({"url": url, "alt": alt})
        if len(images) == MAX_DESCRIPTION_IMAGES:
            break
    return images
```

Schema와 detail mapper는 다음을 추가한다.

```python
from pydantic import BaseModel, Field

class PostingDescriptionImage(BaseModel):
    url: str
    alt: str

class PostingDetail(PostingSummary):
    description_html: str
    description_text: str
    description_images: list[PostingDescriptionImage] = Field(default_factory=list)
```

```python
description_text = structured_plain_text(posting.description_html, posting.description_text)
return {
    **_summary(posting),
    "description_html": posting.description_html,
    "description_text": description_text,
    "description_images": posting_description_images(
        posting.description_html, description_text, posting.url
    ),
    "opens_at": posting.opens_at,
    "closes_at": posting.closes_at,
    "skills": sorted(skill.skill for skill in confirmed),
    "skill_details": [
        {
            "skill": skill.skill,
            "category": skill.category,
            "requirement_type": skill.requirement_type,
            "evidence_text": skill.evidence_text,
            "confidence": skill.confidence,
            "match_reason": skill.match_reason,
        }
        for skill in confirmed
    ],
}
```

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 5 Step 2의 명령.  
Expected: all pass.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/posting_content.py \
  packages/backend/src/ejikfit/api/schemas.py packages/backend/src/ejikfit/api/postings.py \
  packages/backend/tests/test_posting_content.py packages/backend/tests/test_postings_api.py
git commit -m "feat: expose safe posting description images"
```

### Task 6: 이미지형 공고 웹 렌더링

**Files:**
- Create: `apps/web/src/features/jobs/job-description-images.tsx`
- Create: `apps/web/src/features/jobs/job-description-images.test.tsx`
- Modify: `apps/web/src/lib/types.ts:31-40`
- Modify: `apps/web/src/lib/posting-contract.ts:145-170`
- Modify: `apps/web/src/lib/posting-contract.test.ts`
- Modify: `apps/web/src/features/jobs/job-detail-view.tsx:235-255`
- Modify: `apps/web/src/app/jobs/[id]/job-detail.module.css`
- Test: `apps/web/src/app/jobs/[id]/page.test.tsx`
- Modify: `apps/web/e2e/job-detail.e2e.ts`

**Interfaces:**
- Consumes: Task 5의 `description_images` 배열.
- Produces: `<JobDescriptionImages images={...} />`, 실패 이미지만 숨기고 텍스트·원문 링크는 유지하는 상세 화면.

- [ ] **Step 1: contract와 렌더링 실패 테스트 작성**

```ts
expect(normalizePostingDetail({
  ...detailFixture,
  description_images: [{
    url: "https://ligdna.recruiter.co.kr/upload/full.png",
    alt: "채용 공고 상세 내용 이미지 1",
  }],
}).description_images).toEqual([
  {
    url: "https://ligdna.recruiter.co.kr/upload/full.png",
    alt: "채용 공고 상세 내용 이미지 1",
  },
]);
```

```tsx
render(<JobDescriptionImages images={images} />);
const image = screen.getByRole("img", { name: "채용 공고 상세 내용 이미지 1" });
expect(image).toHaveAttribute("loading", "lazy");
expect(image).toHaveAttribute("decoding", "async");
expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
fireEvent.error(image);
expect(screen.queryByRole("img")).not.toBeInTheDocument();
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  src/lib/posting-contract.test.ts \
  src/features/jobs/job-description-images.test.tsx \
  'src/app/jobs/[id]/page.test.tsx'
```

Expected: `description_images` 타입·normalizer·component가 없어 실패한다.

- [ ] **Step 3: strict contract와 lazy component 구현**

```ts
export type PostingDescriptionImage = { url: string; alt: string };

export type PostingDetail = PostingSummary & {
  description_html: string;
  description_text: string;
  description_images: PostingDescriptionImage[];
  opens_at: string | null;
  closes_at: string | null;
  skills: string[];
  skill_details?: SkillDetail[];
};
```

`posting-contract.ts`는 배열과 각 필드를 명시적으로 검사한다.

```ts
function descriptionImages(value: unknown): PostingDescriptionImage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError("Invalid description_images");
  return value.map((item) => {
    if (!isRecord(item)) throw new TypeError("Invalid description image");
    return {
      url: validatedHttpUrl(item.url, "description image url"),
      alt: stringField(item, "alt", true),
    };
  });
}
```

`normalizePostingDetail`은 `description_images: descriptionImages(value.description_images)`를 반환한다.

```tsx
"use client";

export function JobDescriptionImages({ images }: {
  images: PostingDescriptionImage[];
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const visible = images.filter((image) => !failed.has(image.url));
  if (visible.length === 0) return null;
  return (
    <section aria-label="기업이 제공한 공고 상세 이미지" className={styles.sourceImages}>
      <p>공고 세부 내용은 기업이 이미지로 제공했습니다.</p>
      {visible.map((image) => (
        <img
          alt={image.alt}
          decoding="async"
          fetchPriority="low"
          key={image.url}
          loading="lazy"
          onError={() => setFailed((current) => new Set(current).add(image.url))}
          referrerPolicy="no-referrer"
          src={image.url}
        />
      ))}
    </section>
  );
}
```

이미지는 `display:block; width:100%; height:auto; min-height:min(80vh,40rem); object-fit:contain`으로
원본 비율을 유지하며 컨테이너 밖으로 넘치지 않게 한다.

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 6 Step 2의 명령.  
Expected: all pass.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/posting-contract.ts \
  apps/web/src/lib/posting-contract.test.ts \
  apps/web/src/features/jobs/job-description-images.tsx \
  apps/web/src/features/jobs/job-description-images.test.tsx \
  apps/web/src/features/jobs/job-detail-view.tsx \
  'apps/web/src/app/jobs/[id]/job-detail.module.css' \
  'apps/web/src/app/jobs/[id]/page.test.tsx' apps/web/e2e/job-detail.e2e.ts
git commit -m "feat: render image-based job descriptions"
```

### Task 7: 쿠팡·LIG넥스원·SK AX·kt cloud 공식 로고 연결

**Files:**
- Modify: `apps/web/src/app/company-logo-assets/[logoKey]/route.ts`
- Modify: `apps/web/src/features/home-feed/company-identity.ts`
- Modify: `apps/web/src/features/home-feed/company-mark.tsx`
- Modify: CompanyMark 호출부 중 `company_slug`를 이미 가진 파일들
- Test: `apps/web/src/app/company-logo-assets/[logoKey]/route.test.ts`
- Test: `apps/web/src/features/home-feed/company-identity.test.ts`

**Interfaces:**
- Consumes: `companyName`, official `sourceUrl`, optional `companySlug`.
- Produces: `companyIdentity(companyName, sourceUrl, companySlug?)`와 공식 proxy keys `coupang`, `lig-nex1`, `sk-ax`, `kt-cloud`.

- [ ] **Step 1: 네 회사 source/identity 실패 테스트 작성**

```ts
it.each([
  ["쿠팡", "coupang", "https://www.coupang.jobs/kr/jobs/1", "coupang"],
  ["LIG넥스원", "lig-nex1", "https://ligdna.recruiter.co.kr/app/jobnotice/view?id=1", "lig-nex1"],
  ["SK AX", "sk-ax", "https://www.skax.co.kr/recruit/1", "sk-ax"],
  ["kt cloud", "kt-cloud", "https://www.ktcloud.com/careers/1", "kt-cloud"],
])("uses official %s identity", (name, slug, sourceUrl, key) => {
  expect(companyIdentity(name, sourceUrl, slug)).toMatchObject({
    kind: "logo",
    src: `/company-logo-assets/${key}`,
  });
});
```

Route test는 각 key가 다음 원본을 fetch하는지 확인한다.

```ts
const expected = {
  coupang: "https://www.aboutcoupang.com/wp-content/themes/aboutcp/assets/images/logo.svg",
  "lig-nex1": "https://www.ligdefenseaerospace.com/res/img/img_ci-logo_m.jpg",
  "sk-ax": "https://www.skax.co.kr/wp-content/uploads/logo-1.svg",
  "kt-cloud": "https://www.ktcloud.com/static/img/common/svg/ico_logo_black.svg",
};
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  'src/app/company-logo-assets/[logoKey]/route.test.ts' \
  src/features/home-feed/company-identity.test.ts
```

Expected: 세 key가 없고 쿠팡이 favicon URL을 사용해 실패한다.

- [ ] **Step 3: official map, alias, slug 우선 lookup 구현**

`VerifiedLogo`에 `slugs?: string[]`를 추가하고 lookup을 다음 순서로 바꾼다.

```ts
export function companyIdentity(
  companyName: string,
  sourceUrl?: string,
  companySlug?: string,
): CompanyIdentity {
  const normalizedName = normalize(companyName);
  const normalizedSlug = companySlug ? normalize(companySlug) : "";
  const verified = VERIFIED_LOGOS.find((logo) => {
    if (!hasTrustedSource(sourceUrl, logo.hosts)) return false;
    const slugMatch = normalizedSlug && logo.slugs?.some(
      (slug) => normalize(slug) === normalizedSlug,
    );
    const aliasMatch = logo.aliases.some(
      (alias) => normalize(alias) === normalizedName,
    );
    return Boolean(slugMatch || aliasMatch);
  });
  const initials = initialsFor(companyName);
  if (verified) {
    return {
      kind: "logo",
      src: verified.src,
      alt: `${verified.displayName} 로고`,
      initials,
      ...(verified.surface ? { surface: verified.surface } : {}),
    };
  }
  return {
    kind: "initials",
    initials,
    alt: companyName.trim() || "회사",
  };
}
```

`CompanyMarkProps`에 `companySlug?: string`을 추가하고 slug를 가진 job/detail/company call site에서
전달한다. 출처 hostname 검증은 유지한다.

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 7 Step 2의 명령.  
Expected: all pass.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/company-logo-assets/[logoKey]/route.ts \
  apps/web/src/app/company-logo-assets/[logoKey]/route.test.ts \
  apps/web/src/features/home-feed/company-identity.ts \
  apps/web/src/features/home-feed/company-identity.test.ts \
  apps/web/src/features/home-feed/company-mark.tsx \
  apps/web/src/features/jobs apps/web/src/features/home-feed/home-feed.tsx \
  apps/web/src/features/companies apps/web/src/features/search \
  apps/web/src/features/saved-library apps/web/src/features/hiring-calendar \
  apps/web/src/features/market apps/web/src/features/notifications
git commit -m "fix: use official company logo assets"
```

### Task 8: 저해상도 로고 확대 방지

**Files:**
- Modify: `apps/web/src/features/home-feed/company-mark.tsx`
- Modify: `apps/web/src/features/home-feed/company-mark.module.css`
- Test: `apps/web/src/features/home-feed/company-mark.test.tsx`

**Interfaces:**
- Consumes: loaded `<img>` natural dimensions, mark CSS size, `window.devicePixelRatio`.
- Produces: `hasEnoughLogoPixels(...) -> boolean`; 품질이 모자라거나 실패한 이미지는 동일한 initials fallback.

- [ ] **Step 1: 16px favicon과 wide SVG 판정 실패 테스트 작성**

```ts
expect(hasEnoughLogoPixels({
  naturalWidth: 16,
  naturalHeight: 16,
  boxSize: 56,
  devicePixelRatio: 2,
})).toBe(false);

expect(hasEnoughLogoPixels({
  naturalWidth: 117,
  naturalHeight: 27,
  boxSize: 56,
  devicePixelRatio: 2,
})).toBe(true);
```

Component test에서는 `naturalWidth=16`, `naturalHeight=16`인 load event 뒤 image가 사라지고 initials가
나오는지 검증한다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd apps/web && npm test -- --run src/features/home-feed/company-mark.test.tsx
```

Expected: helper가 없고 저해상도 load가 그대로 남아 실패한다.

- [ ] **Step 3: 실제 contain 크기 기준 품질 판정 구현**

```ts
export function hasEnoughLogoPixels({
  naturalWidth,
  naturalHeight,
  boxSize,
  devicePixelRatio,
}: {
  naturalWidth: number;
  naturalHeight: number;
  boxSize: number;
  devicePixelRatio: number;
}) {
  if (naturalWidth <= 0 || naturalHeight <= 0 || boxSize <= 0) return false;
  const ratio = naturalWidth / naturalHeight;
  const drawnWidth = ratio >= 1 ? boxSize : boxSize * ratio;
  const drawnHeight = ratio >= 1 ? boxSize / ratio : boxSize;
  const scale = Math.min(Math.max(devicePixelRatio, 1), 2);
  return naturalWidth >= drawnWidth * scale && naturalHeight >= drawnHeight * scale;
}
```

`onLoad`와 hydration 이전 complete 검사 모두 이 helper를 `boxSize: size * 0.76`으로 호출한다. 실패
상태는 `failedSrc` 하나로 관리해 같은 URL을 반복 로드하지 않는다. CSS는 공식 wordmark를 자르거나
색을 바꾸지 않는다.

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 8 Step 2의 명령.  
Expected: all pass.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/features/home-feed/company-mark.tsx \
  apps/web/src/features/home-feed/company-mark.module.css \
  apps/web/src/features/home-feed/company-mark.test.tsx
git commit -m "fix: prevent blurry company logo upscaling"
```

### Task 9: 홈 source queue와 10개 page pure model

**Files:**
- Create: `apps/web/src/features/home-feed/feed-pagination.ts`
- Create: `apps/web/src/features/home-feed/feed-pagination.test.ts`
- Modify: `apps/web/src/features/home-feed/model.ts`
- Modify: `apps/web/src/features/home-feed/model.test.ts`
- Modify: `apps/web/src/features/home-feed/types.ts`

**Interfaces:**
- Consumes: community items, all initial jobs, first-page market insights.
- Produces: `interleaveHomeSources`, `takeUniqueFeedPage`, `postingSummaryToFeedItem`, initial 20-job snapshot with true `postingCount` total.

- [ ] **Step 1: interleave·page·중복 제거 실패 테스트 작성**

```ts
const queue = interleaveHomeSources({
  community: [community("c1"), community("c2"), community("c3")],
  jobs: [job("j1"), job("j2"), job("j3"), job("j4"), job("j5")],
  insights: [market("m1"), market("m2")],
});
expect(queue.map(({ id }) => id)).toEqual([
  "c1", "j1", "m1", "j2", "c2", "j3", "j4", "m2", "c3", "j5",
]);

const page = takeUniqueFeedPage(
  [job("j1"), job("j1"), job("j2")],
  new Set(["j0"]),
  2,
);
expect(page.items.map(({ id }) => id)).toEqual(["j1", "j2"]);
expect(page.remaining).toEqual([]);
```

Model test는 25개 posting fixture에서 `recommendedJobs`가 25개이고 `postingCount`가 response total인지
검증한다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  src/features/home-feed/feed-pagination.test.ts \
  src/features/home-feed/model.test.ts
```

Expected: 새 pure functions가 없고 `buildJobs().slice(0, 2)` 때문에 실패한다.

- [ ] **Step 3: pure queue와 재사용 가능한 posting mapper 구현**

```ts
export const HOME_FEED_PAGE_SIZE = 10;

export function interleaveHomeSources({ community, jobs, insights = [] }: {
  community: CommunityPostFeedItem[];
  jobs: RecommendedJobFeedItem[];
  insights?: MarketInsightFeedItem[];
}): FeedItem[] {
  const real: FeedItem[] = [];
  let communityIndex = 0;
  let jobIndex = 0;
  while (communityIndex < community.length || jobIndex < jobs.length) {
    if (communityIndex < community.length) real.push(community[communityIndex++]);
    for (let count = 0; count < 2 && jobIndex < jobs.length; count += 1) {
      real.push(jobs[jobIndex++]);
    }
    if (communityIndex >= community.length) {
      while (jobIndex < jobs.length) real.push(jobs[jobIndex++]);
    }
    if (jobIndex >= jobs.length) {
      while (communityIndex < community.length) real.push(community[communityIndex++]);
    }
  }
  const result = [...real];
  if (insights[0]) result.splice(Math.min(2, result.length), 0, insights[0]);
  if (insights[1]) result.splice(Math.min(7, result.length), 0, insights[1]);
  return result;
}

export function takeUniqueFeedPage(
  queue: FeedItem[],
  seen: ReadonlySet<string>,
  limit = HOME_FEED_PAGE_SIZE,
) {
  const items: FeedItem[] = [];
  const remaining: FeedItem[] = [];
  const pageSeen = new Set(seen);
  for (const item of queue) {
    if (pageSeen.has(item.id)) continue;
    if (items.length < limit) {
      items.push(item);
      pageSeen.add(item.id);
    } else {
      remaining.push(item);
    }
  }
  return { items, remaining };
}
```

`buildJobs`의 `.slice(0, 2)`를 제거하고 mapper를 export한다.

```ts
export function postingSummaryToFeedItem(
  posting: PostingSummary,
  ownedSkills: string[],
  evidence?: SkillGraphEvidence,
): RecommendedJobFeedItem {
  const owned = new Set(ownedSkills.map(normalize));
  const required = posting.required_skills ?? evidence?.required ?? [];
  const preferred = posting.preferred_skills ?? evidence?.preferred ?? [];
  return {
    id: `job-${posting.id}`,
    postingId: posting.id,
    type: "recommended_job",
    companyName: posting.company_name,
    ...(posting.company_slug
      ? {
          companySlug: posting.company_slug,
          companyHref: `/companies/${encodeURIComponent(posting.company_slug)}`,
        }
      : {}),
    title: posting.title,
    location: posting.location ?? "근무지 미기재",
    careerLabel: formatCareer(posting.career_type),
    employmentLabel: formatEmployment(posting.employment_type),
    sourceUrl: posting.source_url,
    firstSeenAt: posting.first_seen_at ?? null,
    verifiedLabel: formatVerifiedDate(posting.last_verified_at),
    matchedRequiredSkills: required.filter((skill) => owned.has(normalize(skill))),
    missingRequiredSkills: required.filter((skill) => !owned.has(normalize(skill))),
    matchedPreferredSkills: preferred.filter((skill) => owned.has(normalize(skill))),
    href: `/jobs/${encodeURIComponent(posting.id)}`,
    source: "api",
  };
}
```

`RecommendedJobFeedItem`에는 `companySlug?: string`과 `firstSeenAt: string | null`을 추가한다.
`buildJobs`는 위 mapper를 모든 posting에 적용하고 fit score로 정렬하되 `.slice(0, 2)`를 사용하지
않는다. `postingCount`는 `postings?.total ?? 0`을 사용한다.

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 9 Step 2의 명령.  
Expected: all pass.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/features/home-feed/feed-pagination.ts \
  apps/web/src/features/home-feed/feed-pagination.test.ts \
  apps/web/src/features/home-feed/model.ts apps/web/src/features/home-feed/model.test.ts \
  apps/web/src/features/home-feed/types.ts
git commit -m "refactor: model paged mixed home feed"
```

### Task 10: 동일 출처 홈 공고 page route와 community page 반환

**Files:**
- Create: `apps/web/src/app/api/home-feed/postings/route.ts`
- Create: `apps/web/src/app/api/home-feed/postings/route.test.ts`
- Modify: `apps/web/src/features/community/use-community-feed.ts`
- Test: `apps/web/src/features/community/use-community-feed.test.tsx`

**Interfaces:**
- Consumes: `getPostings({ limit, offset, career_type })`, community store cursor methods.
- Produces: `GET /api/home-feed/postings`, `CommunityFeedController.loadMore(): Promise<CommunityPage<CommunityPost> | null>`.

- [ ] **Step 1: route validation과 page 반환 실패 테스트 작성**

```ts
expect((await GET(new Request("http://localhost/api/home-feed/postings?offset=-1"))).status)
  .toBe(400);
expect((await GET(new Request("http://localhost/api/home-feed/postings?limit=21"))).status)
  .toBe(400);
expect((await GET(new Request(
  "http://localhost/api/home-feed/postings?career_type=unknown",
))).status).toBe(400);
```

Valid test:

```ts
const response = await GET(new Request(
  "http://localhost/api/home-feed/postings?offset=20&limit=20&career_type=experienced",
));
expect(response.status).toBe(200);
expect(getPostings).toHaveBeenCalledWith({
  offset: 20,
  limit: 20,
  career_type: "experienced",
});
```

Hook test는 `const page = await result.current.loadMore()`가 store page와 같음을 검증한다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  src/app/api/home-feed/postings/route.test.ts \
  src/features/community/use-community-feed.test.tsx
```

Expected: route가 없고 `loadMore()`가 `undefined`를 반환해 실패한다.

- [ ] **Step 3: bounded route와 controller return 구현**

```ts
const CAREER_TYPES = new Set(["new_comer", "experienced", "mixed"]);

function integerParam(params: URLSearchParams, name: string, fallback: number) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const offset = integerParam(params, "offset", 0);
  const limit = integerParam(params, "limit", 20);
  const careerType = params.get("career_type");
  if (
    offset === null || offset < 0 || offset > 10_000 ||
    limit === null || limit < 1 || limit > 20 ||
    (careerType !== null && !CAREER_TYPES.has(careerType))
  ) {
    return Response.json({ error: "잘못된 피드 요청입니다." }, { status: 400 });
  }
  try {
    return Response.json(await getPostings({
      offset,
      limit,
      ...(careerType ? { career_type: careerType } : {}),
    }), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json(
      { error: "공고를 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
```

`loadMore`의 모든 early/error return은 `null`, 성공 끝은 `return page`로 바꾸고 controller type을
`Promise<CommunityPage<CommunityPost> | null>`로 갱신한다. 기존 호출자는 반환값을 무시해도 된다.

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: Task 10 Step 2의 명령.  
Expected: all pass.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/api/home-feed/postings/route.ts \
  apps/web/src/app/api/home-feed/postings/route.test.ts \
  apps/web/src/features/community/use-community-feed.ts \
  apps/web/src/features/community/use-community-feed.test.tsx
git commit -m "feat: add home feed page sources"
```

### Task 11: append-only pager, observer, 상태 UI와 저사양 최적화

**Files:**
- Create: `apps/web/src/features/home-feed/use-home-feed-pagination.ts`
- Create: `apps/web/src/features/home-feed/use-home-feed-pagination.test.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/page.test.tsx`
- Modify: `apps/web/src/features/community/server-community-feed.ts`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.module.css`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.styles.test.ts`
- Modify: `apps/web/src/features/home-feed/feed-order.ts`
- Modify: `apps/web/src/features/home-feed/feed-order.test.ts`
- Modify: `apps/web/e2e/home-feed-stability.e2e.ts`
- Modify: `apps/web/e2e/service-ui-foundation.e2e.ts`

**Interfaces:**
- Consumes: Task 9 pure queue, Task 10 page sources, `snapshot.recommendedJobs`, `snapshot.marketInsights`, active tab.
- Produces: `useHomeFeedPagination(...)` controller와 non-focusable observer sentinel.

- [ ] **Step 1: pager와 observer 실패 테스트 작성**

Hook contract:

```ts
type HomeFeedPaginationController = {
  items: FeedItem[];
  loading: boolean;
  error: string;
  complete: boolean;
  loadNext(tab: FeedTab): Promise<void>;
  retry(tab: FeedTab): Promise<void>;
  prepend(item: CommunityPostFeedItem): void;
  remove(itemId: string): void;
};
```

Hook test scenarios:

```ts
expect(result.current.items).toHaveLength(10);
await act(() => result.current.loadNext("recommended"));
expect(loadJobs).not.toHaveBeenCalled(); // initial buffer first
expect(result.current.items).toHaveLength(20);

await act(() => Promise.all([
  result.current.loadNext("recommended"),
  result.current.loadNext("recommended"),
]));
expect(loadJobs).toHaveBeenCalledTimes(1);
expect(new Set(result.current.items.map(({ id }) => id)).size)
  .toBe(result.current.items.length);
```

HomeFeed test는 mocked IntersectionObserver의 options와 callback을 검증한다.

```ts
expect(observerOptions).toEqual({ root: null, rootMargin: "800px 0px", threshold: 0 });
observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], observer);
await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(20));
expect(screen.queryByRole("button", { name: "커뮤니티 글 더 보기" }))
  .not.toBeInTheDocument();
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  src/features/home-feed/use-home-feed-pagination.test.tsx \
  src/features/home-feed/home-feed.test.tsx \
  src/features/home-feed/home-feed.styles.test.ts \
  src/features/home-feed/feed-order.test.ts src/app/page.test.tsx
```

Expected: pager와 observer가 없고 수동 더 보기 버튼이 남아 실패한다.

- [ ] **Step 3: initial queue와 source loader를 가진 pager 구현**

`useHomeFeedPagination`은 다음 상태를 소유한다.

```ts
type PagerState = {
  visible: FeedItem[];
  buffer: FeedItem[];
  seenIds: Set<string>;
  jobOffset: number;
  jobTotal: number;
  loading: boolean;
  error: string;
  sourceEnded: { community: boolean; jobs: boolean };
};
```

초기화는 `interleaveHomeSources`와 `takeUniqueFeedPage(..., 10)`를 사용한다. `loadNext`는 ref 기반
in-flight guard를 먼저 확인하고, buffer가 있으면 네트워크 없이 다음 page를 append한다. buffer가
비었으면 active tab에 필요한 source만 `Promise.allSettled`로 요청한다. 새 page는 중복을 제거해
아래에만 append하고, 하나라도 실패하면 `error`를 저장해 observer 자동 재호출을 막는다. `retry`만
error를 비우고 같은 offset/cursor를 재시도한다. job fetch는 `AbortController.signal`을 사용하며
unmount에서 abort한다.

공고 response mapping은 Task 9의 함수를 사용한다.

```ts
const response = await fetch(
  `/api/home-feed/postings?${params.toString()}`,
  { signal, headers: { Accept: "application/json" } },
);
if (!response.ok) throw new Error("공고를 불러오지 못했습니다.");
const page = normalizePostingList(await response.json());
return {
  items: page.items.map((posting) =>
    postingSummaryToFeedItem(posting, ownedSkills)
  ),
  total: page.total,
};
```

- [ ] **Step 4: HomeFeed에 observer와 상태 UI 연결**

`page.tsx`는 `getPostings({ limit: 20 })`, `loadInitialCommunityFeed(10)`을 호출한다. HomeFeed는 기존
`visibleItems` useMemo와 수동 pagination block을 pager controller로 교체한다.

```tsx
const sentinelRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const node = sentinelRef.current;
  if (!node || pager.complete || pager.error) return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) void pager.loadNext(activeTab);
    },
    { root: null, rootMargin: "800px 0px", threshold: 0 },
  );
  observer.observe(node);
  return () => observer.disconnect();
}, [activeTab, pager.complete, pager.error, pager.loadNext]);
```

```tsx
<div aria-hidden="true" className={styles.feedSentinel} ref={sentinelRef} />
{pager.loading && <p aria-live="polite" className={styles.feedStatus}>새 글을 불러오는 중…</p>}
{pager.error && (
  <div className={styles.feedPagination}>
    <p role="alert">{pager.error}</p>
    <button onClick={() => void pager.retry(activeTab)} type="button">다시 불러오기</button>
  </div>
)}
{pager.complete && (
  <p aria-live="polite" className={styles.feedStatus}>새로 확인할 내용은 여기까지예요.</p>
)}
```

카드 CSS에 다음을 추가한다.

```css
.socialCard,
.jobCard,
.marketCard {
  content-visibility: auto;
  contain-intrinsic-size: auto 15rem;
}

.feedSentinel {
  width: 100%;
  height: 1px;
  pointer-events: none;
}
```

새 글 생성 성공 시 `pager.prepend(serverCommunityPostToFeedItem(post))`, 삭제 성공 시
`pager.remove(postId)`를 호출한다. live community map으로 같은 ID의 reaction/save metric을 최신 객체로
치환한다.

- [ ] **Step 5: 집중 테스트와 browser regression 통과 확인**

Run:

```bash
cd apps/web && npm test -- --run \
  src/features/home-feed/use-home-feed-pagination.test.tsx \
  src/features/home-feed/home-feed.test.tsx \
  src/features/home-feed/home-feed.styles.test.ts \
  src/features/home-feed/feed-order.test.ts src/app/page.test.tsx
npm run lint
npm run test:e2e -- --grep "home feed|compact"
```

Expected: unit/integration pass, TypeScript error 0, 선택 Playwright pass.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/page.test.tsx \
  apps/web/src/features/community/server-community-feed.ts \
  apps/web/src/features/home-feed/use-home-feed-pagination.ts \
  apps/web/src/features/home-feed/use-home-feed-pagination.test.tsx \
  apps/web/src/features/home-feed/home-feed.tsx \
  apps/web/src/features/home-feed/home-feed.module.css \
  apps/web/src/features/home-feed/home-feed.test.tsx \
  apps/web/src/features/home-feed/home-feed.styles.test.ts \
  apps/web/src/features/home-feed/feed-order.ts \
  apps/web/src/features/home-feed/feed-order.test.ts \
  apps/web/e2e/home-feed-stability.e2e.ts apps/web/e2e/service-ui-foundation.e2e.ts
git commit -m "feat: add stable infinite home feed"
```

### Task 12: 전체 회귀, production build, 운영 데이터 확인 준비

**Files:**
- Modify only if verification exposes a scoped defect: files already listed in Tasks 1-11.
- Test: entire `packages/backend/tests`
- Test: entire `apps/web/src`
- Test: selected Playwright E2E and performance suite.

**Interfaces:**
- Consumes: Tasks 1-11 commits.
- Produces: clean branch, full verification evidence, deploy/migration/crawl commands ready for remote integration.

- [ ] **Step 1: 정적 검사와 전체 단위 테스트**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest \
  -p pytest_asyncio.plugin packages/backend/tests -q
cd apps/web && npm test -- --run --reporter=dot
npm run lint
```

Expected: backend 503개 이상 pass, web 1059개 이상 pass, TypeScript error 0.

- [ ] **Step 2: production build**

Run:

```bash
cd apps/web && npm run build
```

Expected: Next.js production build exit 0; route `/api/home-feed/postings`가 route manifest에 포함된다.

- [ ] **Step 3: 선택 E2E와 성능 검증**

Run:

```bash
cd apps/web && npm run test:e2e -- \
  e2e/home-feed-stability.e2e.ts \
  e2e/job-detail.e2e.ts \
  e2e/post-detail.e2e.ts \
  e2e/global-search.e2e.ts \
  e2e/service-ui-foundation.e2e.ts
npm run test:performance -- e2e/performance-budget.e2e.ts
```

Expected: 지정 E2E와 performance budget pass; 320/375/414/768 관련 assertion failure 0.

- [ ] **Step 4: diff와 보안 불변식 검사**

Run:

```bash
git diff origin/main...HEAD --check
rg -n "dangerouslySetInnerHTML|addEventListener\([\"']scroll" \
  apps/web/src/features/home-feed apps/web/src/features/jobs
rg -n "StarterCommunityGuide|MOCK_SOCIAL_ITEMS|MOCK_POST_DETAILS" apps/web/src
git status --short
```

Expected: diff whitespace error 0, 새 dangerous HTML/scroll listener 0, mock runtime symbol 0, worktree clean after commits.

- [ ] **Step 5: release 전 dry-run 명령 확인**

Run:

```bash
/root/work/ejik-fit/.venv/bin/alembic -c packages/backend/alembic.ini upgrade head --sql >/tmp/ejikfit-0025.sql
/root/work/ejik-fit/.venv/bin/ejikfit preview-source --company-slug krafton
```

Expected: migration SQL 생성 exit 0, KRAFTON preview가 공고를 파싱하고 DB write 0.

- [ ] **Step 6: 최종 커밋은 검증 과정에서 실제 수정이 있을 때만 생성**

```bash
git add -A -- apps/web packages/backend
git commit -m "test: harden feed and source fidelity regressions"
```

검증 수정이 없다면 빈 커밋을 만들지 않는다. 이후 `verification-before-completion` 절차로 결과를 다시
확인하고, remote push/PR 또는 main 병합은 저장소의 현재 보호 규칙을 확인한 뒤 수행한다.
