# 이직핏 기반·수직 슬라이스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub 원격 저장소에서 재현 가능한 개발 환경을 만들고, 공식 그리팅 채용 페이지의 공고가 수집·버전 관리·검색 색인되어 이직핏 웹 목록과 상세 화면에 표시되는 첫 번째 수직 슬라이스를 완성한다.

**Architecture:** Next.js 웹은 FastAPI의 읽기 API만 호출한다. Python 백엔드 패키지는 SQLAlchemy 데이터 모델, 그리팅·JSON-LD 커넥터, 스냅샷 저장, 중복·변경 감지, Meilisearch 색인을 제공하고 API와 Celery 워커가 같은 패키지를 서로 다른 프로세스로 실행한다. PostgreSQL이 기준 데이터 저장소이며 Redis, Meilisearch, MinIO는 각각 작업 큐, 한국어 검색, 원문 스냅샷 저장을 담당한다.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, SQLAlchemy 2, Alembic, Celery, Redis, HTTPX, BeautifulSoup, PostgreSQL 17, Meilisearch, MinIO, Next.js 16.2, React 19, TypeScript, Vitest, Pytest, Docker Compose

## Global Constraints

- GitHub 원격 저장소 `NoirStar/ejik-fit`을 유일한 소스 오브 트루스로 사용한다.
- Python은 3.12, Next.js는 16.2를 사용한다.
- 공개된 공식 채용 페이지, JSON-LD, SSR 데이터만 수집한다.
- 로그인, 인증, CAPTCHA, 접근 통제를 우회하지 않는다.
- HTTP와 구조화 데이터를 우선하며 Playwright는 이 계획에서 도입하지 않는다.
- CloakBrowser, 사용자 계정, 개인화, AI 자유 형식 추출, 관계 그래프 UI는 이 계획 범위에서 제외한다.
- 수집 실패는 기존 정상 공고를 삭제하거나 즉시 마감시키지 않는다.
- 공고 화면에는 공식 출처 URL과 마지막 확인 시각을 표시한다.
- 각 작업은 테스트 실패 확인 → 최소 구현 → 테스트 통과 → 커밋 순서로 수행한다.

---

## File Map

```text
.github/workflows/ci.yml                   # Python·웹 테스트와 빌드 CI
.env.example                               # 비밀값 없는 개발 환경 변수 예제
.gitignore                                 # Python, Node, 환경 파일, 로컬 데이터 제외
Makefile                                   # 개발·테스트·마이그레이션·시드 명령
compose.yaml                               # PostgreSQL, Redis, Meilisearch, MinIO, API, worker, web
README.md                                  # 체크아웃부터 수직 슬라이스 검증까지
apps/api/Dockerfile                        # FastAPI 실행 이미지
apps/worker/Dockerfile                     # Celery worker 실행 이미지
apps/web/package.json                      # Next.js 의존성과 명령
apps/web/src/app/layout.tsx                # 공통 문서 레이아웃
apps/web/src/app/page.tsx                  # 공고 검색·목록
apps/web/src/app/jobs/[id]/page.tsx        # 공고 상세
apps/web/src/app/globals.css               # 첫 수직 슬라이스 최소 스타일
apps/web/src/components/job-card.tsx       # 목록 카드
apps/web/src/components/source-meta.tsx    # 출처·확인 시각 표시
apps/web/src/lib/api.ts                    # FastAPI typed fetch 함수
apps/web/src/lib/types.ts                  # 웹 응답 타입
apps/web/src/components/*.test.tsx         # 표시 컴포넌트 테스트
packages/backend/pyproject.toml             # 단일 Python 배포 패키지
packages/backend/alembic.ini                # Alembic 설정
packages/backend/alembic/env.py             # 모델 메타데이터 연결
packages/backend/alembic/versions/*.py      # 최초 스키마
packages/backend/src/ejikfit/config.py      # 환경 설정
packages/backend/src/ejikfit/db.py          # engine, session, FastAPI dependency
packages/backend/src/ejikfit/models.py      # 기업·출처·스냅샷·공고·리비전
packages/backend/src/ejikfit/api/app.py     # FastAPI 앱과 라우터 조립
packages/backend/src/ejikfit/api/postings.py# 공고 목록·상세 엔드포인트
packages/backend/src/ejikfit/api/schemas.py # 공개 응답 스키마
packages/backend/src/ejikfit/connectors/types.py   # 커넥터 공통 타입
packages/backend/src/ejikfit/connectors/next_data.py# __NEXT_DATA__ 추출
packages/backend/src/ejikfit/connectors/greeting.py # 그리팅 목록·상세 파서
packages/backend/src/ejikfit/connectors/jsonld.py   # JobPosting JSON-LD 파서
packages/backend/src/ejikfit/storage.py     # S3 호환 스냅샷 저장
packages/backend/src/ejikfit/ingestion.py   # upsert, 중복·변경 감지
packages/backend/src/ejikfit/search.py      # Meilisearch 문서·색인
packages/backend/src/ejikfit/crawler.py     # 출처 단위 수집 오케스트레이션
packages/backend/src/ejikfit/worker.py      # Celery app과 task
packages/backend/src/ejikfit/seed_data.py   # 초기 공식 출처 10개
packages/backend/src/ejikfit/cli.py         # migrate 외 seed·crawl 명령
packages/backend/tests/                     # 백엔드 단위·통합 테스트
tests/fixtures/greeting/*.html              # 합성 그리팅 SSR fixture
tests/fixtures/jsonld/*.html                # 합성 JobPosting fixture
scripts/smoke.sh                            # 전체 수직 슬라이스 상태 점검
```

---

### Task 1: Python 백엔드 패키지와 API 상태 점검

**Files:**
- Create: `packages/backend/pyproject.toml`
- Create: `packages/backend/src/ejikfit/__init__.py`
- Create: `packages/backend/src/ejikfit/config.py`
- Create: `packages/backend/src/ejikfit/api/__init__.py`
- Create: `packages/backend/src/ejikfit/api/app.py`
- Create: `packages/backend/tests/test_health.py`
- Create: `apps/api/Dockerfile`

**Interfaces:**
- Produces: `ejikfit.config.Settings`, `ejikfit.api.app.create_app()`, `ejikfit.api.app.app`
- Consumes: 환경 변수 `EJIKFIT_ENV`, `DATABASE_URL`, `REDIS_URL`, `MEILI_URL`, `MEILI_MASTER_KEY`, `S3_*`

- [ ] **Step 1: 실패하는 상태 점검 테스트 작성**

```python
# packages/backend/tests/test_health.py
from fastapi.testclient import TestClient
from ejikfit.api.app import create_app


def test_health_returns_service_identity() -> None:
    response = TestClient(create_app()).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ejik-fit-api"}
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인**

Run: `python3.12 -m venv .venv && .venv/bin/pip install -e 'packages/backend[dev]' && .venv/bin/pytest packages/backend/tests/test_health.py -v`

Expected: FAIL during collection with `ModuleNotFoundError: No module named 'ejikfit.api'`.

- [ ] **Step 3: Python 패키지와 최소 API 구현**

```toml
# packages/backend/pyproject.toml
[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.build_meta"

[project]
name = "ejikfit-backend"
version = "0.1.0"
requires-python = ">=3.12,<3.13"
dependencies = [
  "alembic>=1.16,<2",
  "beautifulsoup4>=4.13,<5",
  "boto3>=1.39,<2",
  "celery[redis]>=5.5,<6",
  "fastapi>=0.116,<1",
  "httpx>=0.28,<1",
  "lxml>=6,<7",
  "meilisearch>=0.34,<1",
  "psycopg[binary]>=3.2,<4",
  "pydantic-settings>=2.10,<3",
  "sqlalchemy>=2.0.41,<3",
  "tenacity>=9,<10",
  "uvicorn[standard]>=0.35,<1",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.4,<9",
  "pytest-asyncio>=1.1,<2",
  "respx>=0.22,<1",
]

[project.scripts]
ejikfit = "ejikfit.cli:main"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
```

```python
# packages/backend/src/ejikfit/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ejikfit_env: str = "development"
    database_url: str = "postgresql+psycopg://ejikfit:ejikfit@localhost:5432/ejikfit"
    redis_url: str = "redis://localhost:6379/0"
    meili_url: str = "http://localhost:7700"
    meili_master_key: str = "local-development-key"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "ejikfit"
    s3_secret_key: str = "ejikfit-local-secret"
    s3_bucket: str = "raw-snapshots"
    crawler_user_agent: str = "EjikFitBot/0.1 (+https://github.com/NoirStar/ejik-fit)"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

```python
# packages/backend/src/ejikfit/api/app.py
from fastapi import FastAPI


def create_app() -> FastAPI:
    application = FastAPI(title="이직핏 API", version="0.1.0")

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "ejik-fit-api"}

    return application


app = create_app()
```

```dockerfile
# apps/api/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY packages/backend /app/packages/backend
RUN pip install --no-cache-dir /app/packages/backend
CMD ["uvicorn", "ejikfit.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

`__init__.py` 두 파일은 빈 파일로 생성한다.

- [ ] **Step 4: 상태 점검 테스트 통과 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_health.py -v`

Expected: `1 passed`.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend apps/api
 git commit -m "feat: bootstrap backend health API"
```

---

### Task 2: 데이터 모델과 최초 마이그레이션

**Files:**
- Create: `packages/backend/src/ejikfit/db.py`
- Create: `packages/backend/src/ejikfit/models.py`
- Create: `packages/backend/tests/test_models.py`
- Create: `packages/backend/alembic.ini`
- Create: `packages/backend/alembic/env.py`
- Create: `packages/backend/alembic/versions/20260703_0001_initial.py`

**Interfaces:**
- Produces: `Base`, `Company`, `CareerSource`, `RawSnapshot`, `JobPosting`, `JobRevision`, `get_session()`
- Produces uniqueness: `(CareerSource.id, JobPosting.external_id)` and `JobRevision.content_hash` per posting

- [ ] **Step 1: 모델 계약 테스트 작성**

```python
# packages/backend/tests/test_models.py
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from ejikfit.models import Base, CareerSource, Company, JobPosting, SourceStatus, SourceType


def test_source_and_external_id_identify_one_posting() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(name="테스트 기업", slug="test-company")
        source = CareerSource(
            company=company,
            base_url="https://example.com/careers",
            source_type=SourceType.GREETING,
            status=SourceStatus.ALLOWED,
        )
        posting = JobPosting(
            company=company,
            source=source,
            external_id="123",
            url="https://example.com/o/123",
            title="Backend Engineer",
        )
        session.add(posting)
        session.commit()

        assert posting.company.slug == "test-company"
        assert posting.source.external_id_namespace == "greeting"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_models.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'ejikfit.models'`.

- [ ] **Step 3: SQLAlchemy 모델 구현**

```python
# packages/backend/src/ejikfit/db.py
from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from ejikfit.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
```

```python
# packages/backend/src/ejikfit/models.py
import enum
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ejikfit.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SourceType(str, enum.Enum):
    GREETING = "greeting"
    JSON_LD = "json_ld"


class SourceStatus(str, enum.Enum):
    ALLOWED = "allowed"
    REVIEW = "review"
    STOPPED = "stopped"


class PostingStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    DELAYED = "delayed"


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    homepage_url: Mapped[str | None] = mapped_column(String(1000))
    sources: Mapped[list["CareerSource"]] = relationship(back_populates="company")


class CareerSource(Base):
    __tablename__ = "career_sources"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    base_url: Mapped[str] = mapped_column(String(1000), unique=True)
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType))
    status: Mapped[SourceStatus] = mapped_column(Enum(SourceStatus), default=SourceStatus.REVIEW)
    crawl_interval_minutes: Mapped[int] = mapped_column(Integer, default=360)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    company: Mapped[Company] = relationship(back_populates="sources")

    @property
    def external_id_namespace(self) -> str:
        return self.source_type.value


class RawSnapshot(Base):
    __tablename__ = "raw_snapshots"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("career_sources.id"), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    storage_key: Mapped[str] = mapped_column(String(1000))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    http_status: Mapped[int] = mapped_column(Integer)
    etag: Mapped[str | None] = mapped_column(String(500))
    last_modified: Mapped[str | None] = mapped_column(String(500))


class JobPosting(Base):
    __tablename__ = "job_postings"
    __table_args__ = (UniqueConstraint("source_id", "external_id", name="uq_posting_source_external"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("career_sources.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(1000), unique=True)
    title: Mapped[str] = mapped_column(String(500), index=True)
    status: Mapped[PostingStatus] = mapped_column(Enum(PostingStatus), default=PostingStatus.OPEN)
    description_html: Mapped[str] = mapped_column(Text, default="")
    description_text: Mapped[str] = mapped_column(Text, default="")
    employment_type: Mapped[str | None] = mapped_column(String(100))
    career_type: Mapped[str | None] = mapped_column(String(100))
    career_min: Mapped[int | None] = mapped_column(Integer)
    career_max: Mapped[int | None] = mapped_column(Integer)
    location: Mapped[str | None] = mapped_column(String(500))
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    missing_runs: Mapped[int] = mapped_column(Integer, default=0)
    company: Mapped[Company] = relationship()
    source: Mapped[CareerSource] = relationship()


class JobRevision(Base):
    __tablename__ = "job_revisions"
    __table_args__ = (UniqueConstraint("posting_id", "content_hash", name="uq_revision_posting_hash"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    posting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id"), index=True)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("raw_snapshots.id"))
    content_hash: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
```

- [ ] **Step 4: 모델 테스트와 PostgreSQL 마이그레이션 검증**

`alembic/env.py`는 `Base.metadata`와 `get_settings().database_url`을 사용한다. 최초 migration은 위 여섯 테이블, enum, 인덱스, 두 unique constraint를 정확히 생성한다.

Run: `.venv/bin/pytest packages/backend/tests/test_models.py -v`

Expected: `1 passed`.

Run after PostgreSQL starts: `.venv/bin/alembic -c packages/backend/alembic.ini upgrade head && .venv/bin/alembic -c packages/backend/alembic.ini current`

Expected: current revision `20260703_0001`.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/db.py packages/backend/src/ejikfit/models.py packages/backend/tests/test_models.py packages/backend/alembic.ini packages/backend/alembic
 git commit -m "feat: add recruitment source data model"
```

---

### Task 3: 초기 한국 기술기업 출처 레지스트리

**Files:**
- Create: `packages/backend/src/ejikfit/seed_data.py`
- Create: `packages/backend/src/ejikfit/cli.py`
- Create: `packages/backend/tests/test_seed_data.py`

**Interfaces:**
- Produces: `SeedSource`, `INITIAL_GREETING_SOURCES`, `seed_sources(session) -> int`
- Consumes: `Company`, `CareerSource`, `SourceType.GREETING`, `SourceStatus.ALLOWED`

- [ ] **Step 1: 정확히 10개 공식 출처를 요구하는 테스트 작성**

```python
# packages/backend/tests/test_seed_data.py
from ejikfit.seed_data import INITIAL_GREETING_SOURCES


def test_initial_sources_are_ten_unique_official_greeting_pages() -> None:
    assert len(INITIAL_GREETING_SOURCES) == 10
    assert len({item.slug for item in INITIAL_GREETING_SOURCES}) == 10
    assert len({item.base_url for item in INITIAL_GREETING_SOURCES}) == 10
    assert all(item.base_url.startswith("https://") for item in INITIAL_GREETING_SOURCES)
    assert all("career.greetinghr.com" in item.base_url for item in INITIAL_GREETING_SOURCES)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_seed_data.py -v`

Expected: FAIL importing `ejikfit.seed_data`.

- [ ] **Step 3: 고정 출처 데이터와 idempotent seed 구현**

```python
# packages/backend/src/ejikfit/seed_data.py
from dataclasses import dataclass
from sqlalchemy import select
from sqlalchemy.orm import Session
from ejikfit.models import CareerSource, Company, SourceStatus, SourceType


@dataclass(frozen=True)
class SeedSource:
    name: str
    slug: str
    base_url: str


INITIAL_GREETING_SOURCES = (
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
)


def seed_sources(session: Session) -> int:
    created = 0
    for item in INITIAL_GREETING_SOURCES:
        company = session.scalar(select(Company).where(Company.slug == item.slug))
        if company is None:
            company = Company(name=item.name, slug=item.slug)
            session.add(company)
            session.flush()
        source = session.scalar(select(CareerSource).where(CareerSource.base_url == item.base_url))
        if source is None:
            session.add(CareerSource(
                company_id=company.id,
                base_url=item.base_url,
                source_type=SourceType.GREETING,
                status=SourceStatus.ALLOWED,
            ))
            created += 1
    session.commit()
    return created
```

`cli.py`는 `argparse` subcommand `seed-sources`를 제공하고 `SessionLocal()`로 `seed_sources`를 호출한 뒤 `created=<n>`을 출력한다.

- [ ] **Step 4: 테스트와 idempotency 검증**

Run: `.venv/bin/pytest packages/backend/tests/test_seed_data.py -v`

Expected: `1 passed`.

Run twice against PostgreSQL: `.venv/bin/ejikfit seed-sources && .venv/bin/ejikfit seed-sources`

Expected first run: `created=10`; second run: `created=0`.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/seed_data.py packages/backend/src/ejikfit/cli.py packages/backend/tests/test_seed_data.py
 git commit -m "feat: seed initial Korean tech career sources"
```

---

### Task 4: 그리팅 SSR 목록·상세 커넥터

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/__init__.py`
- Create: `packages/backend/src/ejikfit/connectors/types.py`
- Create: `packages/backend/src/ejikfit/connectors/next_data.py`
- Create: `packages/backend/src/ejikfit/connectors/greeting.py`
- Create: `packages/backend/tests/test_greeting_connector.py`
- Create: `tests/fixtures/greeting/list.html`
- Create: `tests/fixtures/greeting/opening.html`

**Interfaces:**
- Produces: `OpeningRef(external_id, url)`, `ParsedOpening`, `extract_next_data(html)`, `discover_openings(html, page_url)`, `parse_opening(html, page_url)`
- Consumes: 공개 SSR의 `<script id="__NEXT_DATA__" type="application/json">`

- [ ] **Step 1: 합성 fixture와 실패 테스트 작성**

`list.html`의 `__NEXT_DATA__`에는 `queryKey: ["openings"]`와 두 공고 객체를 넣는다. `opening.html`에는 `queryKey[1] == "getOpeningById"`, `openingsInfo`, `groupInfo`, `jobPositionSetting`을 넣는다. 개인정보와 실제 공고 전문은 넣지 않는다.

```python
# packages/backend/tests/test_greeting_connector.py
from pathlib import Path
from ejikfit.connectors.greeting import discover_openings, parse_opening

FIXTURES = Path(__file__).parents[3] / "tests" / "fixtures" / "greeting"


def test_discovers_greeting_opening_urls() -> None:
    html = (FIXTURES / "list.html").read_text()
    refs = discover_openings(html, "https://sample.career.greetinghr.com/ko")

    assert [(ref.external_id, ref.url) for ref in refs] == [
        ("209187", "https://sample.career.greetinghr.com/ko/o/209187"),
        ("205581", "https://sample.career.greetinghr.com/ko/o/205581"),
    ]


def test_parses_greeting_opening_with_mixed_career() -> None:
    html = (FIXTURES / "opening.html").read_text()
    opening = parse_opening(html, "https://sample.career.greetinghr.com/ko/o/209187")

    assert opening.external_id == "209187"
    assert opening.title == "Backend Engineer"
    assert opening.status == "open"
    assert opening.career_type == "mixed"
    assert opening.career_min == 1
    assert opening.career_max == 3
    assert opening.employment_type == "FULL_TIME_WORKER"
    assert opening.location == "서울특별시"
    assert "Python" in opening.description_text
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_greeting_connector.py -v`

Expected: FAIL importing `ejikfit.connectors.greeting`.

- [ ] **Step 3: 공통 타입과 파서 구현**

```python
# packages/backend/src/ejikfit/connectors/types.py
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class OpeningRef:
    external_id: str
    url: str


@dataclass(frozen=True)
class ParsedOpening:
    external_id: str
    url: str
    title: str
    status: str
    description_html: str
    description_text: str
    employment_type: str | None
    career_type: str | None
    career_min: int | None
    career_max: int | None
    location: str | None
    opens_at: datetime | None
    closes_at: datetime | None
```

```python
# packages/backend/src/ejikfit/connectors/next_data.py
import json
from bs4 import BeautifulSoup


def extract_next_data(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", id="__NEXT_DATA__")
    if script is None or not script.string:
        raise ValueError("__NEXT_DATA__ script is missing")
    return json.loads(script.string)
```

`greeting.py`는 다음 규칙을 정확히 구현한다.

- 목록: `.props.pageProps.dehydratedState.queries`에서 `queryKey[0] == "openings"`인 `state.data` 배열을 찾는다.
- 상세: `queryKey[1] == "getOpeningById"`인 `state.data.data`를 찾는다.
- `openingsInfo.status == "OPEN"`이면 `open`, 아니면 `closed`.
- `jobPositionSetting.jobPositions`의 경력 유형에 `NEW_COMER`와 `EXPERIENCED`가 함께 있으면 `mixed`.
- 경력 최소·최대는 모든 경력 포지션의 값에서 각각 min/max를 계산한다.
- 위치와 고용 형태가 여러 개면 중복을 제거한 문자열을 `, `로 연결한다.
- 상세 HTML은 그대로 보존하고 `BeautifulSoup(detail, "lxml").get_text(" ", strip=True)`로 검색용 텍스트를 만든다.
- 날짜는 `datetime.fromisoformat(value.replace("Z", "+00:00"))`로 변환한다.

- [ ] **Step 4: 파서 테스트 통과 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_greeting_connector.py -v`

Expected: `2 passed`.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/connectors packages/backend/tests/test_greeting_connector.py tests/fixtures/greeting
 git commit -m "feat: parse Greeting career pages"
```

---

### Task 5: 범용 JobPosting JSON-LD 커넥터

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/jsonld.py`
- Create: `packages/backend/tests/test_jsonld_connector.py`
- Create: `tests/fixtures/jsonld/job.html`

**Interfaces:**
- Produces: `parse_jsonld_openings(html, page_url) -> list[ParsedOpening]`
- Consumes: Schema.org `JobPosting`, `identifier`, `title`, `description`, `datePosted`, `validThrough`, `employmentType`, `jobLocation`

- [ ] **Step 1: 합성 JSON-LD fixture와 실패 테스트 작성**

```html
<!-- tests/fixtures/jsonld/job.html -->
<html><head><script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "identifier": {"@type": "PropertyValue", "value": "backend-1"},
  "title": "신입 백엔드 개발자",
  "description": "<h2>자격 요건</h2><p>Python 기초</p>",
  "datePosted": "2026-07-01",
  "validThrough": "2026-07-31T23:59:59+09:00",
  "employmentType": "FULL_TIME",
  "jobLocation": {"@type": "Place", "address": {"addressLocality": "서울"}}
}
</script></head><body></body></html>
```

```python
# packages/backend/tests/test_jsonld_connector.py
from pathlib import Path
from ejikfit.connectors.jsonld import parse_jsonld_openings


def test_parses_schema_org_job_posting() -> None:
    path = Path(__file__).parents[3] / "tests" / "fixtures" / "jsonld" / "job.html"
    jobs = parse_jsonld_openings(path.read_text(), "https://example.com/jobs/backend-1")

    assert len(jobs) == 1
    assert jobs[0].external_id == "backend-1"
    assert jobs[0].title == "신입 백엔드 개발자"
    assert jobs[0].location == "서울"
    assert jobs[0].career_type == "new_comer"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_jsonld_connector.py -v`

Expected: FAIL importing `ejikfit.connectors.jsonld`.

- [ ] **Step 3: JSON-LD 파서 구현**

파서는 dict, 배열, `@graph`를 모두 순회하되 `@type`이 `JobPosting`인 객체만 처리한다. identifier가 없으면 canonical page URL의 SHA-256 앞 32자를 external ID로 사용한다. `hiringOrganization`, `applicantLocationRequirements` 같은 후속 단계 필드는 이 계획에서 추측하지 않는다. `title`에 `신입`이 포함되면 `new_comer`, `경력`이 포함되면 `experienced`, 둘 다 있으면 `mixed`, 어느 쪽도 없으면 `None`으로 둔다.

- [ ] **Step 4: JSON-LD 테스트 통과 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_jsonld_connector.py -v`

Expected: `1 passed`.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/connectors/jsonld.py packages/backend/tests/test_jsonld_connector.py tests/fixtures/jsonld
 git commit -m "feat: parse JobPosting JSON-LD"
```

---

### Task 6: 원문 스냅샷과 idempotent 공고 수집

**Files:**
- Create: `packages/backend/src/ejikfit/storage.py`
- Create: `packages/backend/src/ejikfit/ingestion.py`
- Create: `packages/backend/tests/test_ingestion.py`

**Interfaces:**
- Produces: `SnapshotStore.put(content, content_type) -> (storage_key, content_hash)`
- Produces: `ingest_opening(session, source, opening, raw_html, store, now) -> IngestionResult`
- Consumes: `ParsedOpening`, `CareerSource`, `RawSnapshot`, `JobPosting`, `JobRevision`

- [ ] **Step 1: 생성·무변경·변경 세 경우의 테스트 작성**

```python
# packages/backend/tests/test_ingestion.py
from dataclasses import replace
from datetime import datetime, timezone
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from ejikfit.connectors.types import ParsedOpening
from ejikfit.ingestion import ingest_opening
from ejikfit.models import Base, CareerSource, Company, JobRevision, SourceStatus, SourceType
from ejikfit.storage import MemorySnapshotStore


def test_ingestion_is_idempotent_and_versions_changes() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 3, tzinfo=timezone.utc)
    opening = ParsedOpening(
        external_id="1", url="https://example.com/o/1", title="Backend Engineer",
        status="open", description_html="<p>Python</p>", description_text="Python",
        employment_type="FULL_TIME", career_type="new_comer", career_min=None,
        career_max=None, location="서울", opens_at=None, closes_at=None,
    )

    with Session(engine) as session:
        company = Company(name="기업", slug="company")
        source = CareerSource(company=company, base_url="https://example.com", source_type=SourceType.JSON_LD, status=SourceStatus.ALLOWED)
        session.add(source)
        session.commit()
        store = MemorySnapshotStore()

        first = ingest_opening(session, source, opening, "raw-v1", store, now)
        same = ingest_opening(session, source, opening, "raw-v1", store, now)
        changed = ingest_opening(session, source, replace(opening, title="Backend Engineer II"), "raw-v2", store, now)

        assert first.created is True and first.revision_created is True
        assert same.created is False and same.revision_created is False
        assert changed.created is False and changed.revision_created is True
        assert len(session.scalars(select(JobRevision)).all()) == 2
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_ingestion.py -v`

Expected: FAIL importing `ejikfit.ingestion`.

- [ ] **Step 3: 저장소와 수집 서비스 구현**

```python
# packages/backend/src/ejikfit/storage.py
import hashlib
from dataclasses import dataclass, field
from typing import Protocol
import boto3


class SnapshotStore(Protocol):
    def put(self, content: bytes, content_type: str) -> tuple[str, str]: ...


@dataclass
class MemorySnapshotStore:
    objects: dict[str, bytes] = field(default_factory=dict)

    def put(self, content: bytes, content_type: str) -> tuple[str, str]:
        digest = hashlib.sha256(content).hexdigest()
        key = f"sha256/{digest[:2]}/{digest}.html"
        self.objects.setdefault(key, content)
        return key, digest


class S3SnapshotStore:
    def __init__(self, endpoint_url: str, access_key: str, secret_key: str, bucket: str) -> None:
        self.bucket = bucket
        self.client = boto3.client("s3", endpoint_url=endpoint_url, aws_access_key_id=access_key, aws_secret_access_key=secret_key)

    def put(self, content: bytes, content_type: str) -> tuple[str, str]:
        digest = hashlib.sha256(content).hexdigest()
        key = f"sha256/{digest[:2]}/{digest}.html"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type)
        return key, digest
```

`ingestion.py`는 raw HTML을 먼저 저장하고 `RawSnapshot`을 만든다. 같은 `(source_id, external_id)`가 없으면 `JobPosting`을 생성한다. 있으면 필드를 갱신하고 `missing_runs=0`, `last_seen_at=last_verified_at=now`로 바꾼다. 정규화 payload를 `json.dumps(payload, sort_keys=True, ensure_ascii=False)`한 SHA-256을 revision hash로 사용한다. 같은 hash가 이미 있으면 새 revision을 만들지 않는다.

- [ ] **Step 4: 수집 테스트 통과 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_ingestion.py -v`

Expected: `1 passed`.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/storage.py packages/backend/src/ejikfit/ingestion.py packages/backend/tests/test_ingestion.py
 git commit -m "feat: store and version job postings"
```

---

### Task 7: 안전한 출처 수집과 마감 판정

**Files:**
- Create: `packages/backend/src/ejikfit/crawler.py`
- Create: `packages/backend/src/ejikfit/worker.py`
- Create: `packages/backend/tests/test_crawler.py`
- Create: `apps/worker/Dockerfile`

**Interfaces:**
- Produces: `FetchedPage`, `HttpFetcher.fetch(url)`, `crawl_source(session, source, fetcher, store, now) -> CrawlResult`
- Produces: `reconcile_missing(session, source_id, seen_external_ids, successful_listing) -> int`
- Consumes: 그리팅 목록·상세 파서, ingestion service, Redis URL

- [ ] **Step 1: 실패 수집과 3회 연속 부재 테스트 작성**

```python
# packages/backend/tests/test_crawler.py
from ejikfit.crawler import next_missing_state
from ejikfit.models import PostingStatus


def test_failed_listing_never_advances_missing_counter() -> None:
    assert next_missing_state(2, successful_listing=False, seen=False) == (2, PostingStatus.OPEN)


def test_three_successful_absences_close_posting() -> None:
    assert next_missing_state(0, successful_listing=True, seen=False) == (1, PostingStatus.OPEN)
    assert next_missing_state(1, successful_listing=True, seen=False) == (2, PostingStatus.OPEN)
    assert next_missing_state(2, successful_listing=True, seen=False) == (3, PostingStatus.CLOSED)


def test_seen_posting_resets_counter() -> None:
    assert next_missing_state(2, successful_listing=True, seen=True) == (0, PostingStatus.OPEN)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_crawler.py -v`

Expected: FAIL importing `ejikfit.crawler`.

- [ ] **Step 3: HTTP fetcher, 오케스트레이터, Celery task 구현**

```python
# 핵심 순수 함수: packages/backend/src/ejikfit/crawler.py
def next_missing_state(current: int, successful_listing: bool, seen: bool) -> tuple[int, PostingStatus]:
    if not successful_listing:
        return current, PostingStatus.OPEN
    if seen:
        return 0, PostingStatus.OPEN
    updated = current + 1
    return updated, PostingStatus.CLOSED if updated >= 3 else PostingStatus.OPEN
```

`HttpFetcher`는 `httpx.AsyncClient(follow_redirects=True, timeout=20.0)`를 사용하고 `crawler_user_agent`를 보낸다. 한 출처의 상세 URL은 순차 처리하며 각 요청 사이 최소 1초를 둔다. 429와 5xx는 tenacity로 최대 3회 지수 backoff 재시도한다. 401, 403, CAPTCHA 문구 감지는 재시도하지 않고 출처를 검토 대상으로 기록한다.

`crawl_source`는 목록 fetch 성공 후에만 missing reconciliation을 실행한다. 상세 fetch 실패는 해당 공고의 이전 데이터를 유지한다. `CrawlResult`는 `discovered`, `ingested`, `failed`, `closed` 정수를 반환한다.

```python
# packages/backend/src/ejikfit/worker.py
from celery import Celery
from ejikfit.config import get_settings

settings = get_settings()
celery_app = Celery("ejikfit", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_track_started = True
celery_app.conf.task_serializer = "json"

@celery_app.task(name="ejikfit.crawl_source", autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=3)
def crawl_source_task(source_id: str) -> dict[str, int]:
    from ejikfit.crawler import run_source_by_id
    return run_source_by_id(source_id)
```

```dockerfile
# apps/worker/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY packages/backend /app/packages/backend
RUN pip install --no-cache-dir /app/packages/backend
CMD ["celery", "-A", "ejikfit.worker:celery_app", "worker", "--loglevel=INFO", "--concurrency=2"]
```

- [ ] **Step 4: crawler 테스트 통과 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_crawler.py -v`

Expected: `3 passed`.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/crawler.py packages/backend/src/ejikfit/worker.py packages/backend/tests/test_crawler.py apps/worker
 git commit -m "feat: crawl sources without false closures"
```

---

### Task 8: Meilisearch 색인과 공고 읽기 API

**Files:**
- Create: `packages/backend/src/ejikfit/search.py`
- Create: `packages/backend/src/ejikfit/api/schemas.py`
- Create: `packages/backend/src/ejikfit/api/postings.py`
- Modify: `packages/backend/src/ejikfit/api/app.py`
- Modify: `packages/backend/src/ejikfit/ingestion.py`
- Create: `packages/backend/tests/test_postings_api.py`

**Interfaces:**
- Produces: `posting_document(posting)`, `MeiliPostingIndex.upsert(posting)`, `GET /api/postings`, `GET /api/postings/{id}`
- Query parameters: `q`, `company`, `career_type`, `limit` where `1 <= limit <= 100`
- Response always includes `source_url` and `last_verified_at`

- [ ] **Step 1: API 응답 계약 테스트 작성**

```python
# packages/backend/tests/test_postings_api.py
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from ejikfit.api.app import create_app


class FakePostingReader:
    def list(self, q=None, company=None, career_type=None, limit=20):
        return [{
            "id": "00000000-0000-0000-0000-000000000001",
            "title": "신입 백엔드 개발자",
            "company_name": "테스트 기업",
            "career_type": "new_comer",
            "location": "서울",
            "source_url": "https://example.com/o/1",
            "last_verified_at": datetime(2026, 7, 3, tzinfo=timezone.utc),
        }]


def test_list_postings_exposes_source_and_verification_time() -> None:
    app = create_app(posting_reader=FakePostingReader())
    response = TestClient(app).get("/api/postings?career_type=new_comer")

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["source_url"] == "https://example.com/o/1"
    assert item["last_verified_at"] == "2026-07-03T00:00:00Z"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest packages/backend/tests/test_postings_api.py -v`

Expected: FAIL because `create_app` does not accept `posting_reader` and route is absent.

- [ ] **Step 3: 검색 문서, reader, API schema와 route 구현**

```python
# packages/backend/src/ejikfit/search.py
def posting_document(posting: JobPosting) -> dict:
    return {
        "id": str(posting.id),
        "title": posting.title,
        "description_text": posting.description_text,
        "company_name": posting.company.name,
        "company_slug": posting.company.slug,
        "career_type": posting.career_type,
        "employment_type": posting.employment_type,
        "location": posting.location,
        "status": posting.status.value,
        "source_url": posting.url,
        "last_verified_at": posting.last_verified_at.isoformat(),
    }
```

Meilisearch index 이름은 `job_postings`로 고정한다. searchable attributes는 `title`, `description_text`, `company_name`; filterable attributes는 `company_slug`, `career_type`, `employment_type`, `location`, `status`; sortable attribute는 `last_verified_at`이다. ingestion commit 뒤에 upsert하되 Meilisearch 실패가 PostgreSQL transaction을 rollback시키지 않도록 별도 호출하고 오류를 기록한다.

API schema는 목록용 `PostingSummary`, 상세용 `PostingDetail`, wrapper `PostingListResponse`를 정의한다. 상세 응답은 `description_html`, `description_text`, `opens_at`, `closes_at`을 추가한다. `source_url`은 `JobPosting.url`, 확인 시각은 `JobPosting.last_verified_at`에서만 가져온다.

- [ ] **Step 4: API 계약 테스트와 전체 백엔드 테스트 통과 확인**

Run: `.venv/bin/pytest packages/backend/tests -v`

Expected: all backend tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/backend/src/ejikfit/search.py packages/backend/src/ejikfit/api packages/backend/src/ejikfit/ingestion.py packages/backend/tests/test_postings_api.py
 git commit -m "feat: expose searchable job posting API"
```

---

### Task 9: Next.js 공고 목록과 상세 화면

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/vitest.setup.ts`
- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/job-card.tsx`
- Create: `apps/web/src/components/job-card.test.tsx`
- Create: `apps/web/src/components/source-meta.tsx`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/jobs/[id]/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/Dockerfile`

**Interfaces:**
- Consumes: `GET /api/postings`, `GET /api/postings/{id}`
- Produces: 검색어·신입 필터가 URL query string에 남는 공고 목록과 공식 출처 링크가 있는 상세 화면

- [ ] **Step 1: 공고 카드 표시 테스트 작성**

```tsx
// apps/web/src/components/job-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobCard } from "./job-card";

const job = {
  id: "1",
  title: "신입 백엔드 개발자",
  company_name: "테스트 기업",
  career_type: "new_comer",
  location: "서울",
  source_url: "https://example.com/o/1",
  last_verified_at: "2026-07-03T00:00:00Z",
};

describe("JobCard", () => {
  it("shows company, career and verification metadata", () => {
    render(<JobCard job={job} />);
    expect(screen.getByText("테스트 기업")).toBeInTheDocument();
    expect(screen.getByText("신입")).toBeInTheDocument();
    expect(screen.getByText(/마지막 확인/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 웹 테스트 실패 확인**

Run: `cd apps/web && npm install && npm test -- --run`

Expected: FAIL because `JobCard` is absent.

- [ ] **Step 3: 웹 타입, API client, 목록·상세 구현**

```json
// apps/web/package.json
{
  "name": "ejik-fit-web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest"
  },
  "dependencies": {
    "next": "16.2.0",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^20.19.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "jsdom": "^26.1.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

```ts
// apps/web/src/lib/types.ts
export type PostingSummary = {
  id: string;
  title: string;
  company_name: string;
  career_type: string | null;
  location: string | null;
  source_url: string;
  last_verified_at: string;
};

export type PostingDetail = PostingSummary & {
  description_html: string;
  description_text: string;
  employment_type: string | null;
  opens_at: string | null;
  closes_at: string | null;
};
```

`api.ts`는 `API_BASE_URL` 서버 환경 변수를 사용하고 fetch 실패 또는 non-2xx에서 URL과 status가 포함된 Error를 던진다. 목록 페이지는 `q`, `career_type`을 API로 전달하며 `career_type=new_comer` 체크박스를 제공한다. 상세 페이지는 구조화 필드와 안전하게 렌더링한 설명, 공식 채용 페이지 새 창 링크, 마지막 확인 시각을 제공한다. 외부 HTML은 sanitize 없이 `dangerouslySetInnerHTML`로 렌더링하지 않고 첫 단계에서는 `description_text`만 표시한다.

- [ ] **Step 4: 웹 테스트와 production build 통과 확인**

Run: `cd apps/web && npm test -- --run && npm run build`

Expected: tests PASS and Next.js build exits 0.

- [ ] **Step 5: 커밋**

```bash
git add apps/web
 git commit -m "feat: add job list and detail pages"
```

---

### Task 10: 전체 Docker 개발환경, CI, 문서와 smoke 검증

**Files:**
- Create: `.env.example`
- Create: `.gitignore`
- Create: `compose.yaml`
- Create: `Makefile`
- Create: `.github/workflows/ci.yml`
- Create: `scripts/smoke.sh`
- Create: `README.md`
- Modify: `packages/backend/src/ejikfit/cli.py`

**Interfaces:**
- Produces: `make setup`, `make up`, `make migrate`, `make seed`, `make crawl SOURCE_ID=<uuid>`, `make test`, `make smoke`
- Produces services: web `3000`, api `8000`, PostgreSQL `5432`, Redis `6379`, Meilisearch `7700`, MinIO API `9000`

- [ ] **Step 1: 실패하는 smoke script 작성**

```bash
#!/usr/bin/env bash
# scripts/smoke.sh
set -euo pipefail
curl --fail --silent http://localhost:8000/health | grep 'ejik-fit-api'
curl --fail --silent 'http://localhost:8000/api/postings?limit=1' | grep 'items'
curl --fail --silent http://localhost:3000/ | grep '이직핏'
```

Run: `bash scripts/smoke.sh`

Expected: FAIL because services are not running.

- [ ] **Step 2: Compose와 개발 명령 구현**

`compose.yaml`은 healthcheck가 있는 `postgres:17-alpine`, `redis:7.4-alpine`, `getmeili/meilisearch:v1.15`, `minio/minio`와 자체 `api`, `worker`, `web` 서비스를 정의한다. `.env.example`은 Task 1의 Settings 기본값과 같은 로컬 전용 값을 제공한다. 실제 `.env`와 MinIO/PostgreSQL volume은 git에서 제외한다.

MinIO bucket 생성은 별도 `minio-init` one-shot 서비스가 `mc mb --ignore-existing local/raw-snapshots`를 실행하도록 한다. API와 worker는 PostgreSQL, Redis, Meilisearch, MinIO healthcheck가 성공한 뒤 시작한다. web은 `API_BASE_URL=http://api:8000`을 사용한다.

- [ ] **Step 3: CI 구현**

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e 'packages/backend[dev]'
      - run: pytest packages/backend/tests -v
  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: apps/web/package-lock.json
      - run: npm ci
      - run: npm test -- --run
      - run: npm run build
```

- [ ] **Step 4: README에 재현 절차 작성**

README는 제품 한 문장, 수집 원칙, 요구 도구, 아래 명령, 서비스 URL, 초기 10개 출처, 장애 시 확인할 로그를 포함한다.

```bash
cp .env.example .env
make up
make migrate
make seed
make crawl SOURCE_ID=<seed 출력의 실제 UUID>
make smoke
make test
```

`seed-sources` 출력은 각 source UUID와 기업명을 한 줄씩 출력하도록 CLI를 확장한다. README의 `<seed 출력의 실제 UUID>`는 사용자가 seed 결과에서 복사하는 명령 인자 표기이며 미구현 항목이 아니다.

- [ ] **Step 5: 전체 수직 슬라이스 검증**

Run:

```bash
cp .env.example .env
make up
make migrate
make seed
make crawl SOURCE_ID=$(docker compose exec -T api ejikfit list-sources --first-id)
make smoke
make test
```

Expected:

- 모든 Compose 서비스가 healthy 또는 running.
- migration current revision이 `20260703_0001`.
- seed 첫 실행은 10개 출처 생성, 두 번째 실행은 0개 생성.
- 한 그리팅 출처의 공개 공고가 최소 1개 저장됨. 해당 출처에 현재 공개 공고가 0개면 다음 seed source로 순차 시도하며, 10곳 모두 0개인 경우 fixture ingestion 명령으로 수직 슬라이스를 검증하고 live 결과가 없음을 문서화한다.
- `/api/postings?limit=1` 응답에 `source_url`, `last_verified_at` 존재.
- 웹 목록과 상세에서 기업명, 제목, 공식 출처, 마지막 확인 시각 확인.
- backend tests, web tests, web production build 모두 성공.

- [ ] **Step 6: 최종 커밋**

```bash
git add .github .env.example .gitignore compose.yaml Makefile README.md scripts packages/backend/src/ejikfit/cli.py
 git commit -m "chore: add reproducible vertical slice environment"
```

---

## Plan Self-Review Record

- Spec coverage: 설계의 0단계와 1단계만 포함하며 환경, 10개 출처, 그리팅·JSON-LD, 원문 스냅샷, 중복·변경 감지, 안전한 마감, 검색, 목록·상세, 출처·확인 시각, 테스트를 모두 작업에 연결했다.
- Intentional deferrals: 사용자 계정, 내 이직핏, 통계, 관계 그래프, AI 추출, 대규모 기업 발견은 설계 문서의 후속 단계이므로 이 계획에서 제외했다.
- Type consistency: `ParsedOpening`, 모델 필드, 검색 문서, API schema, TypeScript 타입의 필드명을 동일하게 유지했다.
- Placeholder scan: 구현 미정 표시를 두지 않았으며 실행 시 필요한 source UUID는 `list-sources --first-id`로 기계적으로 획득한다.
