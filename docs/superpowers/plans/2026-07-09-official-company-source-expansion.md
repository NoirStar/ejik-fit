# Official Company Source Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first official company source expansion so Naver, Kakao, and LINE Careers jobs can be seeded, crawled, and surfaced through the existing postings pipeline.

**Architecture:** Reuse the existing `Company` + `CareerSource` model as the first operational catalog instead of adding a separate registry table before the needed fields are proven. Add three list-style JSON connector families that parse official public endpoints into `ParsedOpening`, then route those source types through the existing crawler and ingestion flow. Keep Greeting sources unchanged and extend the seed catalog in a backward-compatible way.

**Tech Stack:** Python 3.13, SQLAlchemy ORM, Alembic, pytest, httpx crawler, BeautifulSoup for text extraction, existing `ParsedOpening` ingestion contract.

## Global Constraints

- Official source expansion follows `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`.
- CloakBrowser or browser rendering may only be used for public JavaScript rendering and public network response discovery.
- CAPTCHA solving, login bypass, Cloudflare or bot-protection bypass, session impersonation, and access-control bypass are out of scope.
- CAPTCHA, security checks, authentication screens, 401, 403, and similar blocks must leave the source in `review` rather than pretending the source has zero jobs.
- Existing Greeting sources stay active and must not be regressed.
- A single failed listing must not close existing postings.
- Every production behavior change starts with a failing test.
- Do not keep a local dev server running after verification.

---

## File Structure

- `packages/backend/src/ejikfit/models.py`: add source type enum values for `NAVER_JSON`, `KAKAO_JSON`, and `LINE_GATSBY`.
- `packages/backend/alembic/versions/20260709_0005_source_connector_types.py`: add PostgreSQL enum values for the three connector families.
- `packages/backend/src/ejikfit/seed_data.py`: upgrade the seed tuple into a mixed official source catalog while preserving `INITIAL_GREETING_SOURCES`.
- `packages/backend/src/ejikfit/connectors/naver.py`: parse Naver official `loadJobList.do` JSON.
- `packages/backend/src/ejikfit/connectors/kakao.py`: parse Kakao official `public/api/job-list` JSON.
- `packages/backend/src/ejikfit/connectors/line_gatsby.py`: parse LINE Careers Gatsby `page-data/jobs/page-data.json`.
- `packages/backend/src/ejikfit/crawler.py`: route the three new source types through a shared list-JSON ingestion path and include source labels in crawl summaries.
- `packages/backend/tests/test_seed_data.py`: prove the seed catalog contains existing Greeting sources plus Naver/Kakao/LINE official sources.
- `packages/backend/tests/test_models.py`: prove source namespaces remain stable.
- `packages/backend/tests/test_migration_offline.py`: prove the Alembic SQL contains the new source type enum values.
- `packages/backend/tests/test_naver_connector.py`: prove Naver JSON maps to `ParsedOpening`.
- `packages/backend/tests/test_kakao_connector.py`: prove Kakao JSON maps to `ParsedOpening`.
- `packages/backend/tests/test_line_gatsby_connector.py`: prove LINE Gatsby JSON maps to `ParsedOpening`.
- `packages/backend/tests/test_crawler.py`: prove `run_all_sources` summaries show company/source labels and still continue after a source failure.

---

### Task 1: Source Type Enum And Seed Catalog

**Files:**
- Modify: `packages/backend/src/ejikfit/models.py`
- Modify: `packages/backend/src/ejikfit/seed_data.py`
- Create: `packages/backend/alembic/versions/20260709_0005_source_connector_types.py`
- Modify: `packages/backend/tests/test_seed_data.py`
- Modify: `packages/backend/tests/test_models.py`
- Modify: `packages/backend/tests/test_migration_offline.py`

**Interfaces:**
- Consumes: existing `SeedSource(name: str, slug: str, base_url: str)` and `seed_sources(session: Session) -> int`.
- Produces: `INITIAL_SOURCE_CATALOG: tuple[SeedSource, ...]`, `INITIAL_GREETING_SOURCES: tuple[SeedSource, ...]`, and `SeedSource.source_type: SourceType`.

- [ ] **Step 1: Write the failing seed catalog test**

Replace `packages/backend/tests/test_seed_data.py` with:

```python
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit.models import Base, CareerSource, Company, SourceType
from ejikfit.seed_data import (
    INITIAL_GREETING_SOURCES,
    INITIAL_SOURCE_CATALOG,
    seed_sources,
)


def test_initial_sources_include_existing_greeting_pages_and_official_json_sources() -> None:
    greeting_slugs = {item.slug for item in INITIAL_GREETING_SOURCES}
    catalog_by_slug = {item.slug: item for item in INITIAL_SOURCE_CATALOG}

    assert {
        "kakaopay",
        "kakaomobility",
        "hyundai-autoever",
        "nextsecurities",
        "s2w",
    } <= greeting_slugs
    assert len(INITIAL_GREETING_SOURCES) == 15
    assert all(item.source_type == SourceType.GREETING for item in INITIAL_GREETING_SOURCES)

    assert catalog_by_slug["naver"].source_type == SourceType.NAVER_JSON
    assert catalog_by_slug["kakao"].source_type == SourceType.KAKAO_JSON
    assert catalog_by_slug["line-plus"].source_type == SourceType.LINE_GATSBY
    assert len({item.slug for item in INITIAL_SOURCE_CATALOG}) == len(INITIAL_SOURCE_CATALOG)
    assert len({item.base_url for item in INITIAL_SOURCE_CATALOG}) == len(INITIAL_SOURCE_CATALOG)
    assert all(item.base_url.startswith("https://") for item in INITIAL_SOURCE_CATALOG)


def test_seeding_sources_is_idempotent_and_persists_catalog_source_types() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        assert seed_sources(session) == len(INITIAL_SOURCE_CATALOG)
        assert seed_sources(session) == 0
        assert len(session.scalars(select(Company)).all()) == len(INITIAL_SOURCE_CATALOG)

        sources = session.scalars(select(CareerSource)).all()
        assert len(sources) == len(INITIAL_SOURCE_CATALOG)
        actual_types = {source.company.slug: source.source_type for source in sources}
        assert actual_types["naver"] == SourceType.NAVER_JSON
        assert actual_types["kakao"] == SourceType.KAKAO_JSON
        assert actual_types["line-plus"] == SourceType.LINE_GATSBY
```

- [ ] **Step 2: Write the failing model namespace test**

Append to `packages/backend/tests/test_models.py`:

```python
def test_official_json_source_namespaces_are_stable() -> None:
    assert SourceType.NAVER_JSON.value == "naver_json"
    assert SourceType.KAKAO_JSON.value == "kakao_json"
    assert SourceType.LINE_GATSBY.value == "line_gatsby"
```

- [ ] **Step 3: Write the failing offline migration test**

Append these assertions inside `test_offline_migration_includes_conditional_pgroonga_index` in `packages/backend/tests/test_migration_offline.py`:

```python
    assert "NAVER_JSON" in sql
    assert "KAKAO_JSON" in sql
    assert "LINE_GATSBY" in sql
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_seed_data.py \
  packages/backend/tests/test_models.py::test_official_json_source_namespaces_are_stable \
  packages/backend/tests/test_migration_offline.py -q
```

Expected: FAIL because `INITIAL_SOURCE_CATALOG`, the three `SourceType` members, and the migration do not exist.

- [ ] **Step 5: Add source type enum values**

Modify `packages/backend/src/ejikfit/models.py`:

```python
class SourceType(str, enum.Enum):
    GREETING = "greeting"
    JSON_LD = "json_ld"
    NAVER_JSON = "naver_json"
    KAKAO_JSON = "kakao_json"
    LINE_GATSBY = "line_gatsby"
```

- [ ] **Step 6: Add the Alembic enum migration**

Create `packages/backend/alembic/versions/20260709_0005_source_connector_types.py`:

```python
"""add official source connector enum values

Revision ID: 20260709_0005
Revises: 20260706_0004
Create Date: 2026-07-09
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260709_0005"
down_revision: str | None = "20260706_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'NAVER_JSON'")
        op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'KAKAO_JSON'")
        op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'LINE_GATSBY'")


def downgrade() -> None:
    pass
```

- [ ] **Step 7: Upgrade seed catalog**

Modify `packages/backend/src/ejikfit/seed_data.py` so `SeedSource` includes `source_type` and `homepage_url`, create `INITIAL_SOURCE_CATALOG`, derive `INITIAL_GREETING_SOURCES`, and seed each source with its own type:

```python
@dataclass(frozen=True)
class SeedSource:
    name: str
    slug: str
    base_url: str
    source_type: SourceType = SourceType.GREETING
    homepage_url: str | None = None


INITIAL_SOURCE_CATALOG = (
    SeedSource("DeepAuto.ai", "deepauto-ai", "https://deepauto-ai.career.greetinghr.com/ko"),
    SeedSource("NHN KCP", "nhn-kcp", "https://kcp.career.greetinghr.com/ko"),
    SeedSource("Sionic AI", "sionic-ai", "https://sionicai.career.greetinghr.com/ko"),
    SeedSource("EXEM", "exem", "https://ex-em.career.greetinghr.com/ko"),
    SeedSource("AFI 뒤끝", "afi-thebackend", "https://thebackend.career.greetinghr.com/ko"),
    SeedSource("뉴빌리티", "neubility", "https://neubility.career.greetinghr.com/ko"),
    SeedSource("비트센싱", "bitsensing", "https://bitsensing.career.greetinghr.com/ko"),
    SeedSource("오누이", "onuii", "https://onuii.career.greetinghr.com/ko"),
    SeedSource("로앤컴퍼니", "lawcompany", "https://lawcompany.career.greetinghr.com/ko"),
    SeedSource("슈퍼센트", "supercent", "https://supercent.career.greetinghr.com/ko"),
    SeedSource("카카오페이", "kakaopay", "https://kakaopay.career.greetinghr.com/ko"),
    SeedSource("카카오모빌리티", "kakaomobility", "https://kakaomobility.career.greetinghr.com/ko"),
    SeedSource("넥스트증권", "nextsecurities", "https://nextsecurities.career.greetinghr.com/ko"),
    SeedSource("현대오토에버", "hyundai-autoever", "https://hyundai-autoever.career.greetinghr.com/ko"),
    SeedSource("S2W", "s2w", "https://s2w.career.greetinghr.com/ko"),
    SeedSource(
        "네이버",
        "naver",
        "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
        SourceType.NAVER_JSON,
        "https://www.navercorp.com",
    ),
    SeedSource(
        "카카오",
        "kakao",
        "https://careers.kakao.com/public/api/job-list?lang=ko&skillSet=&page=1&company=KAKAO&part=TECHNOLOGY&employeeType=&keyword=",
        SourceType.KAKAO_JSON,
        "https://www.kakaocorp.com",
    ),
    SeedSource(
        "LINE Plus",
        "line-plus",
        "https://careers.linecorp.com/page-data/jobs/page-data.json",
        SourceType.LINE_GATSBY,
        "https://linepluscorp.com",
    ),
)

INITIAL_GREETING_SOURCES = tuple(
    item for item in INITIAL_SOURCE_CATALOG if item.source_type == SourceType.GREETING
)
```

Use the existing 15 Greeting entries exactly as they are today where the ellipsis is shown above. In `seed_sources`, iterate `INITIAL_SOURCE_CATALOG`, set `Company.homepage_url` when the value exists and the company has no homepage, and create `CareerSource(source_type=item.source_type, status=SourceStatus.ALLOWED)`.

- [ ] **Step 8: Run tests to verify green**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_seed_data.py \
  packages/backend/tests/test_models.py::test_official_json_source_namespaces_are_stable \
  packages/backend/tests/test_migration_offline.py -q
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/backend/src/ejikfit/models.py \
  packages/backend/src/ejikfit/seed_data.py \
  packages/backend/alembic/versions/20260709_0005_source_connector_types.py \
  packages/backend/tests/test_seed_data.py \
  packages/backend/tests/test_models.py \
  packages/backend/tests/test_migration_offline.py
git commit -m "feat: add official source catalog types"
```

---

### Task 2: Naver Official JSON Connector

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/naver.py`
- Create: `packages/backend/tests/test_naver_connector.py`

**Interfaces:**
- Consumes: `ParsedOpening` from `ejikfit.connectors.types`.
- Produces: `parse_naver_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]`.

- [ ] **Step 1: Write the failing parser test**

Create `packages/backend/tests/test_naver_connector.py`:

```python
import json

from ejikfit.connectors.naver import parse_naver_openings


def test_parse_naver_openings_maps_public_job_list_json() -> None:
    payload = {
        "result": True,
        "list": [
            {
                "annoId": 1001,
                "annoSubject": "Backend Engineer - Search Platform",
                "jobDetailLink": "https://recruit.navercorp.com/rcrt/view.do?annoId=1001",
                "entTypeCdNm": "경력",
                "empTypeCdNm": "정규",
                "classCdNm": "Tech",
                "subJobCdNm": "Backend",
                "annoKeyword": "Java, Spring, Kubernetes",
                "sysCompanyCdNm": "NAVER",
                "staYmdTime": "2026.07.01 10:00",
                "endYmdTime": "2026.07.31 18:00",
            },
            {
                "annoId": 1002,
                "annoSubject": "",
            },
        ],
    }

    openings = parse_naver_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "1001"
    assert opening.title == "Backend Engineer - Search Platform"
    assert opening.url == "https://recruit.navercorp.com/rcrt/view.do?annoId=1001"
    assert opening.status == "open"
    assert opening.employment_type == "정규"
    assert opening.career_type == "experienced"
    assert opening.description_text == "Tech Backend Java, Spring, Kubernetes NAVER"
    assert opening.opens_at is not None
    assert opening.closes_at is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_naver_connector.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'ejikfit.connectors.naver'`.

- [ ] **Step 3: Implement parser**

Create `packages/backend/src/ejikfit/connectors/naver.py` with helpers for JSON loading, Korean datetime parsing using `%Y.%m.%d %H:%M`, career type mapping (`신입`, `경력`, mixed), unique text joining, and `parse_naver_openings(raw_json, listing_url)`.

- [ ] **Step 4: Run test to verify green**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_naver_connector.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/ejikfit/connectors/naver.py \
  packages/backend/tests/test_naver_connector.py
git commit -m "feat: parse naver official jobs"
```

---

### Task 3: Kakao Official JSON Connector

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/kakao.py`
- Create: `packages/backend/tests/test_kakao_connector.py`

**Interfaces:**
- Consumes: `ParsedOpening`.
- Produces: `parse_kakao_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]`.

- [ ] **Step 1: Write the failing parser test**

Create `packages/backend/tests/test_kakao_connector.py`:

```python
import json

from ejikfit.connectors.kakao import parse_kakao_openings


def test_parse_kakao_openings_maps_public_job_list_json() -> None:
    payload = {
        "jobList": [
            {
                "realId": "P-14476",
                "jobOfferTitle": "Backend Engineer (Spring)",
                "introduction": "<p>카카오 플랫폼 서버 개발</p>",
                "workContentDesc": "<p>Java와 Spring 기반 API 개발</p>",
                "qualification": "<p>Kubernetes 운영 경험</p>",
                "companyName": "KAKAO",
                "locationName": "경기 성남",
                "employeeTypeName": "정규직",
                "skillSetList": ["Java", "Spring", "Kubernetes"],
                "closeFlag": False,
                "statusCode": "PROGRESS",
                "regDate": "2026-07-01 09:00:00",
                "endDate": "2026-07-31 23:59:00",
            },
            {
                "realId": "P-closed",
                "jobOfferTitle": "Closed",
                "closeFlag": True,
                "statusCode": "END",
            },
        ],
    }

    openings = parse_kakao_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://careers.kakao.com/public/api/job-list?lang=ko",
    )

    assert len(openings) == 2
    opening = openings[0]
    assert opening.external_id == "P-14476"
    assert opening.url == "https://careers.kakao.com/jobs/P-14476"
    assert opening.title == "Backend Engineer (Spring)"
    assert opening.status == "open"
    assert opening.location == "경기 성남"
    assert opening.employment_type == "정규직"
    assert opening.career_type is None
    assert "Java와 Spring 기반 API 개발" in opening.description_text
    assert "Java Spring Kubernetes" in opening.description_text
    assert openings[1].status == "closed"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_kakao_connector.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'ejikfit.connectors.kakao'`.

- [ ] **Step 3: Implement parser**

Create `packages/backend/src/ejikfit/connectors/kakao.py` with JSON loading, URL construction as `https://careers.kakao.com/jobs/{realId}`, HTML-to-text normalization via BeautifulSoup, datetime parsing for `%Y-%m-%d %H:%M:%S`, and closed/open mapping from `closeFlag` plus `statusCode`.

- [ ] **Step 4: Run test to verify green**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_kakao_connector.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/ejikfit/connectors/kakao.py \
  packages/backend/tests/test_kakao_connector.py
git commit -m "feat: parse kakao official jobs"
```

---

### Task 4: LINE Gatsby Connector

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/line_gatsby.py`
- Create: `packages/backend/tests/test_line_gatsby_connector.py`

**Interfaces:**
- Consumes: `ParsedOpening`.
- Produces: `parse_line_gatsby_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]`.

- [ ] **Step 1: Write the failing parser test**

Create `packages/backend/tests/test_line_gatsby_connector.py`:

```python
import json

from ejikfit.connectors.line_gatsby import parse_line_gatsby_openings


def test_parse_line_gatsby_openings_maps_public_page_data() -> None:
    payload = {
        "result": {
            "data": {
                "allStrapiJobs": {
                    "edges": [
                        {
                            "node": {
                                "strapiId": 2100,
                                "title": "Server Engineer, Messaging Platform",
                                "publish": True,
                                "is_public": True,
                                "is_filters_public": True,
                                "employment_type": [{"name": "Full-time"}],
                                "job_unit": [{"name": "Engineering"}],
                                "job_fields": [{"name": "Backend"}],
                                "companies": [{"name": "LINE Plus"}],
                                "cities": [{"name": "Seoul"}],
                                "regions": [{"name": "Korea"}],
                                "start_date": "2026-07-01",
                                "end_date": "2026-08-01",
                                "until_filled": False,
                            }
                        },
                        {
                            "node": {
                                "strapiId": 2200,
                                "title": "Private",
                                "publish": False,
                                "is_public": False,
                                "is_filters_public": False,
                            }
                        },
                    ]
                }
            }
        }
    }

    openings = parse_line_gatsby_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://careers.linecorp.com/page-data/jobs/page-data.json",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "2100"
    assert opening.url == "https://careers.linecorp.com/ko/jobs/2100"
    assert opening.title == "Server Engineer, Messaging Platform"
    assert opening.status == "open"
    assert opening.employment_type == "Full-time"
    assert opening.location == "Seoul, Korea"
    assert opening.description_text == "Engineering Backend LINE Plus Seoul Korea"
    assert opening.opens_at is not None
    assert opening.closes_at is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_line_gatsby_connector.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'ejikfit.connectors.line_gatsby'`.

- [ ] **Step 3: Implement parser**

Create `packages/backend/src/ejikfit/connectors/line_gatsby.py` with Gatsby edge traversal, public job filtering, URL construction as `https://careers.linecorp.com/ko/jobs/{strapiId}`, ISO date parsing, and field/company/location text joining.

- [ ] **Step 4: Run test to verify green**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_line_gatsby_connector.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/ejikfit/connectors/line_gatsby.py \
  packages/backend/tests/test_line_gatsby_connector.py
git commit -m "feat: parse line careers jobs"
```

---

### Task 5: Crawler Routing And Source-Labeled Summary

**Files:**
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Consumes: `parse_naver_openings`, `parse_kakao_openings`, `parse_line_gatsby_openings`.
- Produces: crawler support for `SourceType.NAVER_JSON`, `SourceType.KAKAO_JSON`, and `SourceType.LINE_GATSBY`; `run_all_sources()` results include `source_label`.

- [ ] **Step 1: Write the failing summary label test**

Replace `test_crawl_all_continues_after_one_source_failure` in `packages/backend/tests/test_crawler.py` with:

```python
def test_crawl_all_continues_after_one_source_failure_and_preserves_labels(monkeypatch) -> None:
    monkeypatch.setattr(
        crawler,
        "_allowed_sources",
        lambda: [
            crawler.SourceRunTarget("first", "네이버 / naver_json"),
            crawler.SourceRunTarget("second", "카카오 / kakao_json"),
        ],
    )

    def fake_run(source_id: str) -> dict[str, int]:
        if source_id == "first":
            return {
                "discovered": 0,
                "ingested": 0,
                "failed": 1,
                "closed": 0,
            }
        return {
            "discovered": 2,
            "ingested": 2,
            "failed": 0,
            "closed": 0,
        }

    monkeypatch.setattr(crawler, "run_source_by_id", fake_run)

    report = crawler.run_all_sources()

    assert report["sources"] == 2
    assert report["failed"] == 1
    assert report["ingested"] == 2
    assert [item["source_id"] for item in report["results"]] == ["first", "second"]
    assert [item["source_label"] for item in report["results"]] == [
        "네이버 / naver_json",
        "카카오 / kakao_json",
    ]
    assert "| 네이버 / naver_json | 0 | 0 | 1 | 0 |" in crawler.render_crawl_summary(report)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py::test_crawl_all_continues_after_one_source_failure_and_preserves_labels -q
```

Expected: FAIL because `_allowed_sources` and `SourceRunTarget` do not exist.

- [ ] **Step 3: Write the failing connector routing test**

Append to `packages/backend/tests/test_crawler.py`:

```python
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ejikfit.models import Base, CareerSource, Company, JobPosting, SourceStatus, SourceType
from ejikfit.storage import MemorySnapshotStore


class StaticFetcher:
    def __init__(self, text: str) -> None:
        self.text = text

    async def fetch(self, url: str):
        return crawler.FetchedPage(url=url, text=self.text, status_code=200, headers={})


def test_crawl_source_routes_naver_json_into_ingestion() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        company = Company(name="네이버", slug="naver")
        session.add(company)
        session.flush()
        source = CareerSource(
            company_id=company.id,
            base_url="https://recruit.navercorp.com/rcrt/loadJobList.do?lang=ko",
            source_type=SourceType.NAVER_JSON,
            status=SourceStatus.ALLOWED,
        )
        session.add(source)
        session.commit()

        result = asyncio.run(
            crawler.crawl_source(
                session=session,
                source=source,
                fetcher=StaticFetcher(
                    '{"list":[{"annoId":1001,"annoSubject":"Backend Engineer","jobDetailLink":"https://recruit.navercorp.com/rcrt/view.do?annoId=1001"}]}'
                ),
                store=MemorySnapshotStore(),
                now=datetime(2026, 7, 9, tzinfo=timezone.utc),
                request_delay_seconds=0,
            )
        )

        postings = session.scalars(select(JobPosting)).all()
        assert result.discovered == 1
        assert result.ingested == 1
        assert postings[0].external_id == "1001"
        assert postings[0].title == "Backend Engineer"
```

- [ ] **Step 4: Run test to verify it fails**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py::test_crawl_source_routes_naver_json_into_ingestion -q
```

Expected: FAIL because `SourceType.NAVER_JSON` is not routed in `crawl_source`.

- [ ] **Step 5: Implement source targets and list-JSON routing**

Modify `packages/backend/src/ejikfit/crawler.py`:

```python
from ejikfit.connectors.kakao import parse_kakao_openings
from ejikfit.connectors.line_gatsby import parse_line_gatsby_openings
from ejikfit.connectors.naver import parse_naver_openings
```

Add:

```python
@dataclass(frozen=True)
class SourceRunTarget:
    source_id: str
    label: str
```

Add:

```python
def _parse_list_json_openings(source_type: SourceType, text: str, url: str):
    if source_type == SourceType.NAVER_JSON:
        return parse_naver_openings(text, url)
    if source_type == SourceType.KAKAO_JSON:
        return parse_kakao_openings(text, url)
    if source_type == SourceType.LINE_GATSBY:
        return parse_line_gatsby_openings(text, url)
    raise ValueError(f"unsupported list-json source type: {source_type.value}")
```

In `crawl_source`, add a branch for the three source types that parses openings from the listing response and calls `ingest_opening` for each opening with `listing.text`.

Replace `_allowed_source_ids()` with `_allowed_sources() -> list[SourceRunTarget]` that selects `CareerSource`, joined company data, and creates labels as `"{source.company.name} / {source.source_type.value}"`.

Update `run_all_sources()` to iterate targets, call `run_source_by_id(target.source_id)`, and append `source_label=target.label`.

Update `render_crawl_summary()` to display `source_label` when present and fall back to `source_id`.

- [ ] **Step 6: Run crawler tests to verify green**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_crawler.py
git commit -m "feat: crawl official json sources"
```

---

### Task 6: Full Verification, Push, And Remote Crawl

**Files:**
- Verify-only unless verification exposes a bug in files touched by Tasks 1-5.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: pushed `main` branch and a GitHub Actions crawl run that exercises the expanded source catalog.

- [ ] **Step 1: Run backend tests**

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -q
```

Expected: PASS.

- [ ] **Step 2: Run whitespace diff check**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 3: Check working tree scope**

```bash
git status --short
```

Expected: only tracked implementation files are staged or committed; `.agents/` remains untracked and is not included in commits.

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 5: Trigger remote crawl**

```bash
gh workflow run crawl.yml --ref main
```

Expected: a new workflow dispatch run is created.

- [ ] **Step 6: Watch remote crawl**

```bash
gh run list --workflow crawl.yml --limit 1
gh run watch <run-id> --exit-status
```

Expected: workflow completes successfully. If a public official endpoint changed, capture the error, keep the affected source in `review` when the crawler sees access blocking, and fix parser shape with a failing fixture test first.
