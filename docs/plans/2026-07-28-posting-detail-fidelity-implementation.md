# 채용 공고 상세 본문 신뢰도 복구 구현 계획

> **실행 지침:** 이 계획은 `executing-plans` 절차로 순서대로 실행한다. 모든 기능과 버그 수정은 실패 테스트를 먼저 확인한 뒤 최소 구현으로 통과시킨다.

**목표:** 목록 메타데이터만 저장된 공고를 공식 상세 본문으로 교체하고, 상세 실패가 정상 데이터를 훼손하지 않으며, 희소 공고가 다시 저장되지 않도록 품질 게이트와 운영 감사를 추가한다.

**구조:** 기존 목록 커넥터는 공고 발견과 필터링을 유지한다. 새 `official_detail` 디스패처가 소스별 공식 상세 요청을 만들고 전용 파서에 응답을 전달한다. 상세 필수 소스는 공통 품질 게이트를 통과한 `ParsedOpening`만 savepoint 안에서 저장한다. 웹은 복구 전 희소 데이터를 원문으로 오인하지 않도록 안전 상태를 표시한다.

**기술 스택:** Python 3.12, FastAPI, SQLAlchemy, BeautifulSoup/lxml, httpx, pytest, Next.js 16, React 19, TypeScript, Vitest, GitHub Actions.

---

## Task 1: 공통 상세 품질 계약 추가

**파일**

- 수정: `packages/backend/src/ejikfit/posting_content.py`
- 수정: `packages/backend/tests/test_posting_content.py`

### 1. 실패 테스트 작성

다음 계약을 테스트한다.

```python
def test_substantive_posting_content_accepts_verified_text() -> None:
    assert has_substantive_posting_content("", "가" * 120, "https://example.com/jobs/1")


def test_substantive_posting_content_rejects_listing_metadata() -> None:
    assert not has_substantive_posting_content(
        "", "Tech Frontend NAVER WEBTOON", "https://example.com/jobs/1"
    )


def test_substantive_posting_content_accepts_official_image_body() -> None:
    assert has_substantive_posting_content(
        '<img src="/jobs/1/body.png">', "", "https://example.com/jobs/1"
    )


def test_substantive_posting_content_rejects_decorative_logo() -> None:
    assert not has_substantive_posting_content(
        '<img class="company-logo" src="/assets/logo.svg" width="64" height="64">',
        "",
        "https://example.com/jobs/1",
    )


def test_require_substantive_posting_content_raises_for_sparse_detail() -> None:
    with pytest.raises(ValueError, match="detail content is sparse"):
        require_substantive_posting_content(...)
```

### 2. 실패 확인

실행:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin packages/backend/tests/test_posting_content.py -q
```

예상: 새 함수 import 실패.

### 3. 최소 구현

`posting_content.py`에 다음을 추가한다.

- `MIN_SUBSTANTIVE_DESCRIPTION_CHARS = 120`
- `has_substantive_posting_content(description_html, description_text, source_url)`
- `require_substantive_posting_content(...)`

텍스트는 공백을 정규화한 길이를 사용한다. 텍스트가 기준보다 짧으면 기존 `posting_description_images`가 허용한 공식 동일 호스트 설명 이미지가 있을 때만 정상으로 본다. `posting_description_images`에는 파일명·class·alt의 logo/favicon/icon 표식과 명시된 작은 크기를 거르는 보수적인 장식 이미지 판정을 추가한다. 크기 속성이 없는 실제 채용 포스터는 유지한다. 오류 메시지에는 공고 본문 전체를 넣지 않는다.

### 4. 통과 확인

Task 1 테스트를 다시 실행해 통과시킨다.

### 5. 커밋

```bash
git add packages/backend/src/ejikfit/posting_content.py \
  packages/backend/tests/test_posting_content.py
git commit -m "feat: add substantive posting content contract"
```

## Task 2: 네이버 계열 상세 파서와 요청 디스패처 구현

**파일**

- 수정: `packages/backend/src/ejikfit/connectors/naver.py`
- 생성: `packages/backend/src/ejikfit/connectors/official_detail.py`
- 수정: `packages/backend/tests/test_naver_connector.py`
- 생성: `packages/backend/tests/test_official_detail.py`

### 1. 실패 테스트 작성

`test_naver_connector.py`에 실제 구조를 축소한 fixture를 추가한다.

```html
<input name="annoId" value="30005224">
<h4 class="card_title">[네이버웹툰] 프런트엔드 개발자</h4>
<div class="detail_wrap">
  <div class="detail_box">
    <h4 class="detail_title">필요 역량</h4>
    <p class="detail_text"></p>
    <div>React, TypeScript, Next.js와 Node.js 경험</div>
  </div>
  <div class="detail_box">
    <h4 class="detail_title">우대 사항</h4>
    <div>Docker와 Kubernetes 경험</div>
  </div>
</div>
```

다음을 검증한다.

- 빈 `.detail_text`가 있어도 형제 요소 전체가 본문에 포함된다.
- 제목과 `annoId`가 목록 공고와 일치한다.
- `description_html`에 상세 섹션만 남는다.
- `description_text`가 120자 이상이며 React/TypeScript를 포함한다.
- 다른 ID, 다른 제목, 빈 상세, 120자 미만 상세는 `ValueError`다.

`test_official_detail.py`에서는 두 네이버 connector family가 `opening.url` GET 요청과 네이버 파서를 선택하는지 확인한다.

### 2. 실패 확인

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_naver_connector.py \
  packages/backend/tests/test_official_detail.py -q
```

예상: `parse_naver_detail_opening`, `official_detail_request`, `parse_official_detail` 부재로 실패.

### 3. 최소 구현

`naver.py`에 `parse_naver_detail_opening(html, detail_url, listing_opening)`을 추가한다.

- `.card_title`, `input[name=annoId]`, `.detail_wrap .detail_box`를 검증한다.
- 각 `.detail_box` 전체를 직렬화해 빈 `detail_text` 뒤의 형제 본문을 보존한다.
- `structured_plain_text`와 Task 1 품질 게이트를 호출한다.
- 목록에서 이미 확인한 고용형태·경력·기간·URL은 `dataclasses.replace`로 보존한다.

`official_detail.py`에 다음을 둔다.

```python
@dataclass(frozen=True)
class OfficialDetailRequest:
    url: str
    method: str = "GET"
    json_body: object | None = None
    headers: Mapping[str, str] | None = None


def official_detail_request(
    connector_family: str | None,
    listing_url: str,
    opening: ParsedOpening,
) -> OfficialDetailRequest | None: ...


def parse_official_detail(
    raw: str,
    response_url: str,
    connector_family: str | None,
    listing_url: str,
    opening: ParsedOpening,
) -> ParsedOpening: ...
```

처음에는 네이버 두 family만 디스패치한다. 이후 Task에서 다른 공식 소스를 추가한다.

### 4. 통과 확인 및 커밋

```bash
git add packages/backend/src/ejikfit/connectors/naver.py \
  packages/backend/src/ejikfit/connectors/official_detail.py \
  packages/backend/tests/test_naver_connector.py \
  packages/backend/tests/test_official_detail.py
git commit -m "feat: parse official NAVER job details"
```

## Task 3: 크롤러 상세 수집과 공고별 원자성 보장

**파일**

- 수정: `packages/backend/src/ejikfit/crawler.py`
- 수정: `packages/backend/tests/test_crawler.py`

### 1. 실패 통합 테스트 작성

두 개의 네이버 목록 공고를 반환하는 fetcher를 만든다.

- 첫 상세 응답은 120자 이상의 정상 본문이다.
- 둘째 상세 응답은 목록과 다른 ID 또는 희소 본문이다.
- DB에는 둘째 공고의 이전 정상 본문이 미리 존재한다.

검증:

```python
assert result.discovered == 2
assert result.ingested == 1
assert result.failed == 1
assert first.description_text.startswith("## 필요 역량")
assert second.description_text == previous_good_text
assert second.status == PostingStatus.OPEN
assert source.last_error_code == "partial_detail_failure"
```

추가 테스트로 모든 상세가 성공하면 소스가 성공 상태가 되고 기술 근거가 새 본문으로 교체되는지 확인한다.

### 2. 실패 확인

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin packages/backend/tests/test_crawler.py \
  -k 'naver and detail' -q
```

예상: 상세 URL을 요청하지 않고 목록 메타데이터를 저장해 실패.

### 3. 최소 구현

일반 목록 루프에서 `official_detail_request` 결과가 있으면 다음 순서로 처리한다.

1. 소스 지연 규칙 적용
2. `HttpFetcher.fetch`에 method/body/headers 전달
3. `parse_official_detail` 호출
4. 품질 게이트 통과 확인
5. `session.begin_nested()` savepoint 안에서 `ingest_opening` 호출

네트워크 요청 중에는 DB savepoint를 열지 않는다. 공고 하나의 저장 실패 시 외부 `session.rollback()`으로 이전 성공 공고까지 취소하지 말고 해당 savepoint만 롤백한다.

일반 상세 필수 소스의 오류 코드는 `partial_detail_failure`로 기록한다. `seen_external_ids`에는 목록에서 확인된 ID를 유지해 상세 일시 실패가 기존 공고를 마감하지 않게 한다. 전체 상세가 실패해도 소스 성공 시각을 갱신하지 않는다.

동일한 savepoint 규칙을 `PUBLIC_JSON_DETAIL` 루프에도 적용해 Task 4 두나무가 일부 성공을 보존하게 한다.

### 4. 회귀 확인

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin packages/backend/tests/test_crawler.py -q
```

### 5. 커밋

```bash
git add packages/backend/src/ejikfit/crawler.py \
  packages/backend/tests/test_crawler.py
git commit -m "feat: hydrate and atomically ingest official job details"
```

## Task 4: LINE과 두나무 상세 본문 복구

**파일**

- 수정: `packages/backend/src/ejikfit/connectors/line_gatsby.py`
- 수정: `packages/backend/src/ejikfit/connectors/public_json_detail.py`
- 수정: `packages/backend/src/ejikfit/connectors/official_detail.py`
- 수정: `packages/backend/src/ejikfit/crawler.py`
- 수정: `packages/backend/tests/test_line_gatsby_connector.py`
- 수정: `packages/backend/tests/test_public_json_detail.py`
- 수정: `packages/backend/tests/test_official_detail.py`
- 수정: `packages/backend/tests/test_crawler.py`

### 1. LINE 실패 테스트

공식 형태인 `result.data.strapiJobs` fixture에 `strapiId`, `title`, `content` HTML을 둔다. 다음을 검증한다.

- 상세 URL은 `https://careers.linecorp.com/page-data/ko/jobs/{id}/page-data.json`이다.
- `content`의 Team/Position, Responsibilities, Qualifications가 보존된다.
- 목록 ID/제목과 다르면 실패한다.
- 120자 미만 content는 실패한다.

### 2. 두나무 실패 테스트

- `_dunamu_api_refs`의 `detail_url`이 목록 API가 아니라 `https://careers.dunamu.com/detail/{id}`인지 검증한다.
- JSON 목록 뒤 상세 HTML `.detailView_information`을 파싱해 Python, Kafka, Kubernetes를 포함하는지 검증한다.
- HTTP 차단 시 browser renderer로 같은 공식 상세 URL을 한 번 대체 요청하는 crawler 테스트를 추가한다.
- 상세 실패 시 이전 본문이 보존되는지 확인한다.

### 3. 실패 확인

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_line_gatsby_connector.py \
  packages/backend/tests/test_public_json_detail.py \
  packages/backend/tests/test_official_detail.py \
  packages/backend/tests/test_crawler.py \
  -k 'line or dunamu' -q
```

### 4. 최소 구현

- `parse_line_gatsby_detail_opening`을 추가하고 `official_detail`에 LINE 요청/파서 디스패치를 등록한다.
- 두나무 API ref의 상세 URL을 공식 공개 상세 페이지로 바꾼다.
- `_fetch_public_json_detail`은 두나무 JSON 목록을 상세 응답으로 재사용하지 않는다.
- 두나무 상세 HTTP가 명시적으로 차단될 때만 전달된 browser renderer를 fallback으로 사용한다.
- 기존 `_dunamu_opening`에 Task 1 품질 게이트를 적용한다.

### 5. 통과 확인 및 커밋

```bash
git add packages/backend/src/ejikfit/connectors/line_gatsby.py \
  packages/backend/src/ejikfit/connectors/public_json_detail.py \
  packages/backend/src/ejikfit/connectors/official_detail.py \
  packages/backend/src/ejikfit/crawler.py \
  packages/backend/tests/test_line_gatsby_connector.py \
  packages/backend/tests/test_public_json_detail.py \
  packages/backend/tests/test_official_detail.py \
  packages/backend/tests/test_crawler.py
git commit -m "feat: recover LINE and Dunamu job details"
```

## Task 5: 기업별 공식 상세 API/HTML 파서 구현

**파일**

- 생성: `packages/backend/src/ejikfit/connectors/enterprise_detail.py`
- 수정: `packages/backend/src/ejikfit/connectors/official_detail.py`
- 생성: `packages/backend/tests/test_enterprise_detail_connector.py`
- 수정: `packages/backend/tests/test_official_detail.py`
- 수정: `packages/backend/tests/test_crawler.py`

### 1. 요청 생성 실패 테스트

목록 `ParsedOpening`에서 다음 공식 요청이 정확히 만들어지는지 확인한다.

| 기업 | 공식 상세 요청 |
| --- | --- |
| CJ OliveNetworks | 목록이 제공한 `recruit.cj.net/.../detail.fo` GET |
| 현대자동차 | `https://talent.hyundai.com/api/rec/AP-HM-FO-02800` GET, `hgrCd=1`, `lang=en`, 목록 ID의 `recuYy/recuType/recuCls`, `X-HKMC-SERVICE: HM` |
| LG CNS/LG유플러스 | `https://api.careers.lg.com/rmk/job/retrieveJobNoticesDetail` POST, `{"jobNoticeId": id}` |
| 한화시스템 | `https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/get-rcrt` POST, `{"rtSeq": id, "hidnKey": null, "langCd": "ko"}` |
| 스마일게이트 | `https://careers.smilegate.com/api/apply/announce/guest/{id}?type=finalSelect` GET |

URL host, scheme, ID 형식을 검증해 임의 URL 요청을 막는다.

### 2. 파서 실패 테스트

`test_enterprise_detail_connector.py`에 각 공식 응답을 축소한 fixture를 둔다.

- CJ: `.detail-wrap .detail-list`만 보존하고 개인정보 약관/푸터는 제외한다.
- 현대차: `data.applyInfo`의 `aboutTeamNtc`, `privJdDtl`, `privMustReq`, `prefReq`, `etc`를 제목 있는 섹션으로 만든다.
- LG: `data.jobNoticesDetail.jobNoticesDetail`과 `recList[].detailContext/requiredItem/preferredItem`을 역할별 섹션으로 만든다.
- 한화: `data.item.unitDt[].ruDtlJob`, 공통 자격, 전형, 지원 방법을 섹션으로 만든다.
- 스마일게이트: HTML entity로 인코딩된 `description`과 `workInfo`, `qualificationDesc`, `abilityDesc`, `specialDesc`를 중복 없이 섹션으로 만든다.

모든 파서는 목록 ID와 제목을 응답의 공식 값과 비교하고, 정제 본문 120자 이상을 요구한다. `description_text`에 `<p>`, `&lt;table` 같은 태그 문자열이 남지 않는지 검증한다.

### 3. 실패 확인

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_enterprise_detail_connector.py \
  packages/backend/tests/test_official_detail.py -q
```

### 4. 최소 구현

`enterprise_detail.py`에 요청/파서 함수를 추가하고 `official_detail.py`가 connector family와 검증된 공식 host로 디스패치한다. `enterprise_json` 전체를 상세 필수로 만들지 않고 위 공식 host에만 적용해 다른 기업 커넥터를 깨지 않는다.

현대차 상세 요청은 목록 요청으로 받은 httpx cookie jar를 재사용하고 다음 헤더를 보낸다.

```python
{
    "Accept": "application/json, text/plain, */*",
    "Referer": opening.url,
    "X-HKMC-SERVICE": "HM",
    "X-HKMC-TOKEN": "null",
}
```

### 5. 크롤러 통합 테스트와 커밋

각 요청 방식 중 GET, JSON POST, custom-header GET을 대표하는 통합 테스트를 추가해 fetcher 호출과 저장 결과를 검증한다.

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_enterprise_detail_connector.py \
  packages/backend/tests/test_official_detail.py \
  packages/backend/tests/test_crawler.py -q
```

```bash
git add packages/backend/src/ejikfit/connectors/enterprise_detail.py \
  packages/backend/src/ejikfit/connectors/official_detail.py \
  packages/backend/tests/test_enterprise_detail_connector.py \
  packages/backend/tests/test_official_detail.py \
  packages/backend/tests/test_crawler.py
git commit -m "feat: parse official enterprise job details"
```

## Task 6: KT 본문 포함과 기아 상세 API 복구

**파일**

- 수정: `packages/backend/src/ejikfit/connectors/next_data.py`
- 수정: `packages/backend/src/ejikfit/connectors/enterprise_json.py`
- 수정: `packages/backend/src/ejikfit/connectors/browser_public.py`
- 수정: `packages/backend/src/ejikfit/connectors/official_detail.py`
- 수정: `packages/backend/src/ejikfit/seed_data.py`
- 수정: `packages/backend/tests/test_enterprise_json_connector.py`
- 수정: `packages/backend/tests/test_browser_public_connector.py`
- 수정: `packages/backend/tests/test_official_detail.py`
- 수정: `packages/backend/tests/test_seed_data.py`

### 1. KT 실패 테스트

- seed URL이 `isContainsContents=1`인지 확인한다.
- `_kt_recruit_payload`이 `contents`를 `descriptionHtml`로 전달하는지 확인한다.
- generic static payload parser가 `descriptionHtml`을 `description_html`에 보존하고 `structured_plain_text`로 `description_text`를 만든다.
- 텍스트형 KT AI 공고와 동일 호스트 이미지형 공고가 품질 계약을 통과한다.
- 필터용 company/jobGroup 메타데이터는 유지하되 본문으로 오인되지 않는다.

### 2. 기아 실패 테스트

공식 응답 `data.applyInfo` fixture로 다음을 확인한다.

- 요청 URL: `https://career.kia.com/api/rec/AP-KM-FO-02800`
- query: `hgrCd=2`, `lang=ko`, 목록 ID의 세 부분
- headers: `X-HKMC-SERVICE: KM`, `X-HKMC-TOKEN: null`, 공식 상세 Referer
- 응답의 `aboutTeamNtc`, `privJdDtl`, `privMustReq`, `prefReq`, `etc`를 파싱한다.
- 기술 직군 여부는 상세 본문을 확보한 뒤 다시 확인한다.

### 3. 실패 확인과 최소 구현

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_enterprise_json_connector.py \
  packages/backend/tests/test_browser_public_connector.py \
  packages/backend/tests/test_official_detail.py \
  packages/backend/tests/test_seed_data.py -q
```

`next_data.py`에는 허용된 HTML 설명 키만 처리하는 `DESCRIPTION_HTML_KEYS`를 추가한다. HTML은 렌더하지 않고 정제 텍스트만 사용자에게 전달한다.

기아 파서는 현대차의 필드 구조를 공유할 수 있는 작은 내부 helper를 사용하되 회사별 ID/host/header 검증은 분리한다.

### 4. 통과 확인 및 커밋

```bash
git add packages/backend/src/ejikfit/connectors/next_data.py \
  packages/backend/src/ejikfit/connectors/enterprise_json.py \
  packages/backend/src/ejikfit/connectors/browser_public.py \
  packages/backend/src/ejikfit/connectors/official_detail.py \
  packages/backend/src/ejikfit/seed_data.py \
  packages/backend/tests/test_enterprise_json_connector.py \
  packages/backend/tests/test_browser_public_connector.py \
  packages/backend/tests/test_official_detail.py \
  packages/backend/tests/test_seed_data.py
git commit -m "feat: recover KT and Kia posting bodies"
```

## Task 7: 공식 본문에서 빠지는 기술 사전 보완

**파일**

- 수정: `packages/backend/src/ejikfit/skill_catalog.py`
- 수정: `packages/backend/tests/test_skill_catalog.py`
- 수정: `packages/backend/tests/test_skill_extraction.py`

### 1. 실패 테스트 작성

네이버웹툰 공식 문장을 근거로 Electron과 WebGL을 검증한다.

```python
text = "웹 기술(Electron) 기반 데스크톱 뷰어와 Canvas, WebGL 렌더링을 개발합니다."
```

- Electron은 데스크톱/웹 문맥에서만 확정한다.
- `electron microscopy` 같은 물리·과학 문맥은 확정하지 않는다.
- WebGL은 명시적 토큰으로 확정한다.
- 두 기술 모두 category, kind, domains 메타데이터가 있다.

### 2. 실패 확인 및 최소 구현

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin \
  packages/backend/tests/test_skill_catalog.py \
  packages/backend/tests/test_skill_extraction.py -q
```

Electron은 `electron.js` distinct alias와 데스크톱/웹/JavaScript 문맥을 요구하는 contextual `electron` alias를 사용한다. WebGL은 distinct alias로 추가한다. 기술 사전의 위험 별칭 golden registry도 함께 갱신한다.

### 3. 통과 확인 및 커밋

```bash
git add packages/backend/src/ejikfit/skill_catalog.py \
  packages/backend/tests/test_skill_catalog.py \
  packages/backend/tests/test_skill_extraction.py
git commit -m "feat: recognize Electron and WebGL evidence"
```

## Task 8: 운영 소스 모니터에 본문 품질 감사 추가

**파일**

- 수정: `packages/backend/src/ejikfit/source_monitor.py`
- 수정: `packages/backend/tests/test_source_monitor.py`
- 수정: `.github/workflows/crawl.yml`

### 1. 실패 테스트 작성

DB fixture에 다음 공개 공고를 만든다.

- 120자 이상 텍스트형
- 짧은 텍스트 + 공식 동일 호스트 설명 이미지형
- 120자 미만이며 이미지가 없는 희소형
- 정상 본문이지만 확정 기술 0개

소스별/전체 결과가 다음 필드를 제공하는지 확인한다.

```text
substantive_open_postings
image_only_open_postings
sparse_open_postings
zero_skill_open_postings
sparse_examples (최대 3개 ID)
```

Markdown에는 전체 희소 공고 수와 희소 공고가 있는 상위 소스 표가 포함돼야 하며 본문 전문은 포함하지 않는다.

### 2. 실패 확인 및 최소 구현

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin packages/backend/tests/test_source_monitor.py -q
```

`source_monitor.py`가 공개 공고의 ID, source_id, URL, 설명 HTML/텍스트를 읽고 Task 1의 동일 판정을 사용하게 한다. 1,800건 수준의 운영 감사이므로 한 번의 select 후 Python 집계로 충분하며 사용자 요청 경로에는 실행하지 않는다.

workflow dispatch와 schedule의 crawl 뒤에 `ejikfit source-monitor --format markdown` 결과를 `GITHUB_STEP_SUMMARY`에 남긴다. 기존 `crawl-all` summary와 중복 출력하지 않도록 선택 수집일 때만 별도 단계를 추가한다.

### 3. 통과 확인 및 커밋

```bash
git add packages/backend/src/ejikfit/source_monitor.py \
  packages/backend/tests/test_source_monitor.py .github/workflows/crawl.yml
git commit -m "feat: audit sparse production postings"
```

## Task 9: 희소 공고 안전 화면과 네이버웹툰 공식 SVG 로고

**파일**

- 수정: `apps/web/src/features/jobs/job-detail-model.ts`
- 수정: `apps/web/src/features/jobs/job-detail-view.tsx`
- 수정: `apps/web/src/features/jobs/job-description.tsx`
- 수정: `apps/web/src/app/jobs/[id]/page.test.tsx`
- 수정: `apps/web/src/features/jobs/job-detail-model.test.ts`
- 수정: `apps/web/src/app/company-logo-assets/[logoKey]/route.ts`
- 수정: `apps/web/src/app/company-logo-assets/[logoKey]/route.test.ts`
- 수정: `apps/web/src/features/home-feed/company-mark.test.tsx`
- 필요 시 수정: `apps/web/src/features/home-feed/company-identity.test.ts`

### 1. 희소 상태 실패 테스트

43자 네이버웹툰 메타데이터와 이미지 0개를 전달한다.

- `공고 원문`, `제공된 공고 원문`이라고 표시하지 않는다.
- `상세 내용 수집을 점검 중입니다. 지원 요건은 공식 공고에서 확인해 주세요.`가 보인다.
- 공식 공고 링크는 유지한다.
- 120자 이상 본문과 이미지형 공고는 기존 `공고 원문` 경험을 유지한다.

공통 helper `hasSubstantivePostingDetail(text, images)`는 백엔드와 같은 120자 기준을 사용한다.

### 2. 로고 실패 테스트

- `naver-webtoon` 프록시가 `https://recruit.webtoonscorp.com/share/tmplat/webtoon/img/logo_2025.svg`만 요청한다.
- SVG content type과 주간 cache header를 유지한다.
- 자연 크기 151×45인 SVG가 56px CompanyMark에서 DPR 2 기준을 통과해 이니셜 `네`로 대체되지 않는다.

### 3. 실패 확인 및 최소 구현

```bash
cd apps/web
npm test -- --run \
  src/app/jobs/'[id]'/page.test.tsx \
  src/features/jobs/job-detail-model.test.ts \
  src/app/company-logo-assets/'[logoKey]'/route.test.ts \
  src/features/home-feed/company-mark.test.tsx
```

상세 본문이 희소하면 원문 body를 렌더하지 않고 점검 안내를 표시한다. 이 처리는 공식 링크와 기술 요건 섹션을 제거하지 않는다.

로고 URL만 공식 SVG로 교체하고 저해상도 보호 로직 자체는 약화하지 않는다.

### 4. 통과 확인 및 커밋

```bash
git add apps/web/src/features/jobs/job-detail-model.ts \
  apps/web/src/features/jobs/job-detail-view.tsx \
  apps/web/src/features/jobs/job-description.tsx \
  apps/web/src/app/jobs/'[id]'/page.test.tsx \
  apps/web/src/features/jobs/job-detail-model.test.ts \
  apps/web/src/app/company-logo-assets/'[logoKey]'/route.ts \
  apps/web/src/app/company-logo-assets/'[logoKey]'/route.test.ts \
  apps/web/src/features/home-feed/company-mark.test.tsx \
  apps/web/src/features/home-feed/company-identity.test.ts
git commit -m "fix: show trustworthy sparse posting and logo states"
```

## Task 10: 전체 회귀 검증과 문서 일치 확인

**파일**

- 필요 시 수정: `docs/plans/2026-07-28-posting-detail-fidelity-design.md`
- 필요 시 수정: `docs/plans/2026-07-28-posting-detail-fidelity-implementation.md`

### 1. 백엔드 전체 테스트

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest \
  -p pytest_asyncio.plugin packages/backend/tests -q
```

예상: 512개 기존 테스트와 새 테스트 모두 통과.

### 2. 웹 전체 테스트·타입·빌드

```bash
cd apps/web
npm test -- --run
npm run lint
npm run build
```

### 3. 정적 점검

```bash
git diff --check
git status --short
git log --oneline origin/main..HEAD
```

설계와 달라진 구현이 있으면 이유와 최종 계약을 문서에 반영한다. 테스트를 약화하거나 결함 fixture를 삭제해 통과시키지 않는다.

### 4. 검증 커밋

문서나 후속 수정이 있을 때만 커밋한다.

```bash
git add <검증 중 수정한 파일>
git commit -m "docs: align posting fidelity rollout"
```

## Task 11: 리뷰, 원격 병합, 재수집과 운영 검증

### 1. 변경 범위 리뷰

`requesting-code-review`와 `verification-before-completion` 절차로 다음을 집중 검토한다.

- 공식 host/ID 검증 누락과 SSRF 가능성
- HTML entity 중복 인코딩 또는 태그 노출
- 일부 상세 실패 시 savepoint와 공고 마감 처리
- 이미지형 공고 오판
- 불필요한 브라우저 렌더링과 요청 폭증
- 기존 정상 커넥터 회귀

### 2. 브랜치 게시와 CI

의도한 커밋만 원격 브랜치에 push하고 PR을 연다. CI의 backend, web, E2E, build를 모두 확인한다. 실패 시 로그의 첫 실제 원인을 수정하고 전체 관련 검증을 다시 실행한다.

### 3. 병합과 선택 재수집

CI와 리뷰가 통과하면 main에 병합한다. GitHub Actions `crawl.yml`을 다음 회사 slug로 수동 실행한다.

```text
naver,naver-cloud,naver-webtoon,kream,snow,naver-labs,line-plus,dunamu,
cj-olivenetworks,hanwha-systems,hyundai-motor,lg-cns,lg-uplus,
smilegate,kt,kt-cloud,kia
```

채용 마감으로 136건 기준선이 줄어들 수 있으므로 실행 시점 공고를 기준으로 감사한다.

### 4. 운영 smoke 검사

다음을 운영 API와 웹에서 확인한다.

- 기준 네이버웹툰 공고 본문 2,000자 이상
- React, TypeScript, Next.js, Node.js, Docker, Kubernetes 기술 근거
- HTML 태그가 일반 텍스트로 노출되지 않음
- 네이버웹툰 공식 SVG 로고가 이니셜 대신 표시됨
- 대상 소스 `sparse_open_postings == 0`, 또는 공식 이미지형/마감/비기술 사유가 기록됨
- 상세 실패 소스가 이전 정상 본문을 유지함
- 페이지 응답 시간에 외부 채용 사이트 호출이 추가되지 않음

### 5. 완료 기록

최종 커밋, PR, main 병합 커밋, workflow run, 운영 API 표본과 남은 예외를 사용자에게 보고한다. 검증되지 않은 공고를 정상이라고 추정하지 않는다.
