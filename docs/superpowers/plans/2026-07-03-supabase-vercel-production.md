# Supabase·Vercel Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이직핏을 Vercel Web/API, Supabase PostgreSQL/Storage, 6시간 주기 GitHub Actions crawler로 운영한다.

**Architecture:** 기존 Next.js와 FastAPI 읽기 경계를 유지하고 Supabase를 운영 기준 저장소로 사용한다. Python crawler는 GitHub Actions에서만 실행하며, 운영 검색은 PGroonga를 사용하는 PostgreSQL 구현으로 전환하고 로컬 Docker 구현은 그대로 유지한다.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL/PGroonga, boto3/Supabase Storage S3, GitHub Actions, Next.js 16.2, Vercel

## Global Constraints

- 운영 수집은 로컬 컴퓨터에서 실행하지 않는다.
- 예약 수집은 6시간마다 정각을 피해 17분에 실행한다.
- 운영 환경에 Redis, Celery, MinIO, Meilisearch 의존성을 두지 않는다.
- 로그인, CAPTCHA, 접근 통제를 우회하지 않는다.
- 정상 목록에서 3회 연속 사라진 공고만 마감한다.
- Supabase Storage bucket은 private으로 유지한다.
- DB, S3 secret은 브라우저와 저장소에 노출하지 않는다.
- 로컬 Docker Compose는 개발과 통합 테스트 용도로 유지한다.
- Vercel과 Supabase는 가능한 경우 서울 리전을 사용한다.

---

### Task 1: Serverless-safe database and runtime configuration

**Files:**
- Modify: `packages/backend/src/ejikfit/config.py`
- Modify: `packages/backend/src/ejikfit/db.py`
- Modify: `packages/backend/src/ejikfit/api/app.py`
- Create: `packages/backend/tests/test_runtime_config.py`
- Modify: `.env.example`

**Interfaces:**
- Produces: `engine_options(settings: Settings) -> dict`
- Produces: `Settings.database_pool_mode`, `Settings.search_backend`, `Settings.postgres_search_mode`, `Settings.s3_region`
- Consumes: `Settings.database_url`

- [ ] **Step 1: Write failing configuration tests**

```python
from sqlalchemy.pool import NullPool

from ejikfit.config import Settings
from ejikfit.db import engine_options


def test_transaction_pooling_disables_client_pool_and_prepared_statements():
    settings = Settings(
        database_url="postgresql+psycopg://user:pass@pooler:6543/postgres",
        database_pool_mode="transaction",
    )

    options = engine_options(settings)

    assert options["poolclass"] is NullPool
    assert options["connect_args"] == {"prepare_threshold": None}


def test_local_database_keeps_pre_ping():
    settings = Settings(database_pool_mode="local")
    assert engine_options(settings) == {"pool_pre_ping": True}
```

- [ ] **Step 2: Run the tests and verify the missing interface**

Run: `pytest packages/backend/tests/test_runtime_config.py -v`

Expected: FAIL because `engine_options` and the new settings do not exist.

- [ ] **Step 3: Add explicit runtime settings**

```python
from typing import Literal

database_pool_mode: Literal["local", "session", "transaction"] = "local"
search_backend: Literal["postgres", "meilisearch"] = "meilisearch"
postgres_search_mode: Literal["like", "pgroonga"] = "like"
s3_region: str = "us-east-1"
```

Add the following engine policy in `db.py` and build the module engine from it:

```python
from sqlalchemy.pool import NullPool


def engine_options(settings) -> dict:
    if settings.database_pool_mode == "transaction":
        return {
            "poolclass": NullPool,
            "connect_args": {"prepare_threshold": None},
        }
    return {"pool_pre_ping": True}


settings = get_settings()
engine = create_engine(settings.database_url, **engine_options(settings))
```

Add these defaults to `.env.example`:

```text
DATABASE_POOL_MODE=local
SEARCH_BACKEND=meilisearch
POSTGRES_SEARCH_MODE=like
S3_REGION=us-east-1
```

- [ ] **Step 4: Make API search dependency selection explicit**

In `api/app.py`, construct `MeiliPostingIndex` only when `search_backend == "meilisearch"` and pass `use_pgroonga=settings.postgres_search_mode == "pgroonga"` to `DatabasePostingReader`.

- [ ] **Step 5: Run tests**

Run: `pytest packages/backend/tests/test_runtime_config.py packages/backend/tests/test_health.py -v`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add .env.example packages/backend/src/ejikfit/config.py packages/backend/src/ejikfit/db.py packages/backend/src/ejikfit/api/app.py packages/backend/tests/test_runtime_config.py
git commit -m "feat: configure serverless database runtime"
```

### Task 2: PostgreSQL and PGroonga search

**Files:**
- Create: `packages/backend/alembic/versions/20260703_0002_pgroonga_search.py`
- Modify: `packages/backend/src/ejikfit/api/postings.py`
- Modify: `packages/backend/tests/test_postings_api.py`
- Create: `packages/backend/tests/test_postgres_search.py`

**Interfaces:**
- Consumes: `DatabasePostingReader(use_pgroonga: bool)`
- Produces: `_posting_search_clause(q: str, use_pgroonga: bool)`
- Produces: PostgreSQL index `ix_job_postings_pgroonga`

- [ ] **Step 1: Write failing query tests**

```python
from sqlalchemy.dialects import postgresql

from ejikfit.api.postings import _posting_search_clause


def test_pgroonga_search_uses_multilingual_operator():
    clause = _posting_search_clause("보안 엔지니어", use_pgroonga=True)
    sql = str(
        clause.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "&@~" in sql
    assert "job_postings.title" in sql
    assert "job_postings.description_text" in sql


def test_local_search_uses_case_insensitive_substring():
    clause = _posting_search_clause("backend", use_pgroonga=False)
    sql = str(clause.compile(dialect=postgresql.dialect()))
    assert "ILIKE" in sql
```

- [ ] **Step 2: Verify the tests fail**

Run: `pytest packages/backend/tests/test_postgres_search.py -v`

Expected: FAIL because `_posting_search_clause` does not exist.

- [ ] **Step 3: Implement the search clause**

```python
def _posting_search_clause(q: str, use_pgroonga: bool):
    if use_pgroonga:
        return or_(
            JobPosting.title.bool_op("&@~")(q),
            JobPosting.description_text.bool_op("&@~")(q),
            JobPosting.location.bool_op("&@~")(q),
            Company.name.ilike(f"%{q}%"),
        )
    pattern = f"%{q}%"
    return or_(
        JobPosting.title.ilike(pattern),
        JobPosting.description_text.ilike(pattern),
        JobPosting.location.ilike(pattern),
        Company.name.ilike(pattern),
    )
```

Make `_list_from_database` join `Company` once before applying filters and use this clause for `q`.

- [ ] **Step 4: Add the Supabase-compatible migration**

The upgrade must run only when PGroonga is available so local `postgres:17-alpine` remains usable:

```python
from alembic import op

revision = "20260703_0002"
down_revision = "20260703_0001"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    available = bind.exec_driver_sql(
        "SELECT EXISTS (SELECT 1 FROM pg_available_extensions "
        "WHERE name = 'pgroonga')"
    ).scalar()
    if not available:
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS pgroonga")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_job_postings_pgroonga "
        "ON job_postings USING pgroonga "
        "(title, description_text, location)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_job_postings_pgroonga")
```

- [ ] **Step 5: Run database search and API tests**

Run: `pytest packages/backend/tests/test_postgres_search.py packages/backend/tests/test_postings_api.py -v`

Expected: all tests PASS.

- [ ] **Step 6: Verify local migration compatibility**

Run: `make migrate`

Expected: Alembic reports upgrade to `20260703_0002` without requiring PGroonga locally.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/alembic/versions/20260703_0002_pgroonga_search.py packages/backend/src/ejikfit/api/postings.py packages/backend/tests/test_postgres_search.py packages/backend/tests/test_postings_api.py
git commit -m "feat: search Korean postings with PostgreSQL"
```

### Task 3: Supabase Storage S3 compatibility

**Files:**
- Modify: `packages/backend/src/ejikfit/storage.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Create: `packages/backend/tests/test_storage.py`

**Interfaces:**
- Modifies: `S3SnapshotStore(..., region: str)`
- Consumes: `Settings.s3_region`

- [ ] **Step 1: Write the failing client configuration test**

```python
from ejikfit.storage import S3SnapshotStore


def test_s3_store_passes_supabase_region(monkeypatch):
    captured = {}

    def fake_client(service, **kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr("ejikfit.storage.boto3.client", fake_client)
    S3SnapshotStore(
        endpoint_url="https://project.supabase.co/storage/v1/s3",
        region="ap-northeast-2",
        access_key="access",
        secret_key="secret",
        bucket="raw-snapshots",
    )
    assert captured["region_name"] == "ap-northeast-2"
```

- [ ] **Step 2: Verify it fails**

Run: `pytest packages/backend/tests/test_storage.py -v`

Expected: FAIL because `region` is not accepted.

- [ ] **Step 3: Pass `region_name` to boto3 and update crawler construction**

```python
self.client = boto3.client(
    "s3",
    endpoint_url=endpoint_url,
    region_name=region,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
)
```

- [ ] **Step 4: Run storage and ingestion tests**

Run: `pytest packages/backend/tests/test_storage.py packages/backend/tests/test_ingestion.py -v`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/ejikfit/storage.py packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_storage.py
git commit -m "feat: support Supabase snapshot storage"
```

### Task 4: Batch crawler and machine-readable report

**Files:**
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/src/ejikfit/cli.py`
- Modify: `packages/backend/tests/test_crawler.py`
- Modify: `packages/backend/tests/test_cli.py`

**Interfaces:**
- Produces: `run_all_sources() -> dict[str, object]`
- Produces: `render_crawl_summary(report: dict[str, object]) -> str`
- Produces: CLI `ejikfit crawl-all`

- [ ] **Step 1: Write failing batch behavior tests**

```python
def test_crawl_all_continues_after_one_source_failure(monkeypatch):
    monkeypatch.setattr(
        crawler,
        "_allowed_source_ids",
        lambda: ["first", "second"],
    )
    monkeypatch.setattr(
        crawler,
        "run_source_by_id",
        lambda source_id: (
            {"discovered": 0, "ingested": 0, "failed": 1, "closed": 0}
            if source_id == "first"
            else {"discovered": 2, "ingested": 2, "failed": 0, "closed": 0}
        ),
    )

    report = crawler.run_all_sources()

    assert report["sources"] == 2
    assert report["failed"] == 1
    assert report["ingested"] == 2
```

Add a CLI test that invokes `crawl-all`, asserts JSON output, asserts Markdown is appended to the path in `GITHUB_STEP_SUMMARY`, and expects exit code `1` when `failed > 0`.

- [ ] **Step 2: Run tests and verify failure**

Run: `pytest packages/backend/tests/test_crawler.py packages/backend/tests/test_cli.py -v`

Expected: FAIL because the batch functions and CLI command do not exist.

- [ ] **Step 3: Implement isolated source execution and aggregate totals**

Query allowed source IDs ordered by URL, call `run_source_by_id` independently, catch unexpected exceptions per source, and aggregate:

```python
{
    "sources": len(results),
    "discovered": sum(item["discovered"] for item in results),
    "ingested": sum(item["ingested"] for item in results),
    "failed": sum(item["failed"] for item in results),
    "closed": sum(item["closed"] for item in results),
    "results": results,
}
```

When `search_backend == "postgres"`, pass `posting_index=None`; do not attempt Meilisearch.

- [ ] **Step 4: Implement `crawl-all` CLI reporting**

Print one JSON report to stdout. If `GITHUB_STEP_SUMMARY` exists, append a Markdown table containing every source and totals. Return `1` for partial failure and `0` otherwise.

- [ ] **Step 5: Run crawler and CLI tests**

Run: `pytest packages/backend/tests/test_crawler.py packages/backend/tests/test_cli.py -v`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/ejikfit/crawler.py packages/backend/src/ejikfit/cli.py packages/backend/tests/test_crawler.py packages/backend/tests/test_cli.py
git commit -m "feat: crawl all career sources remotely"
```

### Task 5: Six-hour GitHub Actions production crawler

**Files:**
- Create: `.github/workflows/crawl.yml`
- Create: `packages/backend/tests/test_crawl_workflow.py`
- Modify: `apps/api/Dockerfile`

**Interfaces:**
- Consumes secrets: `CRAWLER_DATABASE_URL`, `SUPABASE_S3_ENDPOINT_URL`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY`
- Runs: `ejikfit crawl-all`

- [ ] **Step 1: Write a failing workflow contract test**

Load `.github/workflows/crawl.yml` as text and assert it contains:

```python
assert 'cron: "17 */6 * * *"' in workflow
assert "workflow_dispatch:" in workflow
assert "cancel-in-progress: false" in workflow
assert "ejikfit crawl-all" in workflow
assert "SEARCH_BACKEND: postgres" in workflow
assert "POSTGRES_SEARCH_MODE: pgroonga" in workflow
assert "secrets.CRAWLER_DATABASE_URL" in workflow
```

- [ ] **Step 2: Run the test and verify the missing workflow**

Run: `pytest packages/backend/tests/test_crawl_workflow.py -v`

Expected: FAIL because the workflow file does not exist.

- [ ] **Step 3: Create the workflow**

```yaml
name: crawl production sources

on:
  schedule:
    - cron: "17 */6 * * *"
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: production-crawler
  cancel-in-progress: false

jobs:
  crawl:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    env:
      EJIKFIT_ENV: production
      DATABASE_URL: ${{ secrets.CRAWLER_DATABASE_URL }}
      DATABASE_POOL_MODE: session
      SEARCH_BACKEND: postgres
      POSTGRES_SEARCH_MODE: pgroonga
      S3_ENDPOINT_URL: ${{ secrets.SUPABASE_S3_ENDPOINT_URL }}
      S3_REGION: ${{ secrets.SUPABASE_S3_REGION }}
      S3_ACCESS_KEY: ${{ secrets.SUPABASE_S3_ACCESS_KEY }}
      S3_SECRET_KEY: ${{ secrets.SUPABASE_S3_SECRET_KEY }}
      S3_BUCKET: raw-snapshots
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: packages/backend/pyproject.toml
      - run: pip install ./packages/backend
      - run: alembic -c packages/backend/alembic.ini upgrade head
      - run: ejikfit seed-sources
      - run: ejikfit crawl-all
```

- [ ] **Step 4: Include the workflow contract in the backend test image**

Add this line before the development dependency install in `apps/api/Dockerfile`:

```dockerfile
COPY .github /app/.github
```

- [ ] **Step 5: Run the workflow contract test**

Run: `pytest packages/backend/tests/test_crawl_workflow.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/crawl.yml apps/api/Dockerfile packages/backend/tests/test_crawl_workflow.py
git commit -m "ci: crawl production sources every six hours"
```

### Task 6: Vercel production configuration and deployment contract

**Files:**
- Modify: `apps/web/vercel.json`
- Create: `packages/backend/vercel.json`
- Create: `packages/backend/tests/test_deployment_contract.py`
- Modify: `apps/api/Dockerfile`
- Modify: `docs/deployment/vercel.md`
- Modify: `README.md`

**Interfaces:**
- Web env: `API_BASE_URL`
- API env: `DATABASE_URL`, `DATABASE_POOL_MODE=transaction`, `SEARCH_BACKEND=postgres`, `POSTGRES_SEARCH_MODE=pgroonga`
- Web root: `apps/web`
- API root: `packages/backend`

- [ ] **Step 1: Write a failing deployment contract test**

```python
def test_vercel_projects_target_seoul_and_keep_secrets_server_side():
    web = json.loads(Path("apps/web/vercel.json").read_text())
    api = json.loads(Path("packages/backend/vercel.json").read_text())
    assert web["regions"] == ["icn1"]
    assert api["regions"] == ["icn1"]
    assert api["framework"] == "fastapi"
    assert "NEXT_PUBLIC_DATABASE_URL" not in json.dumps(web)
```

- [ ] **Step 2: Verify failure**

Run: `pytest packages/backend/tests/test_deployment_contract.py -v`

Expected: FAIL because the API config and region declarations do not exist.

- [ ] **Step 3: Add Vercel project configuration**

Web:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["icn1"],
  "installCommand": "npm ci",
  "buildCommand": "npm run build"
}
```

API:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "fastapi",
  "regions": ["icn1"]
}
```

- [ ] **Step 4: Replace the old worker deployment guide**

Document the exact Supabase + GitHub Actions environment matrix, the two Vercel root directories, the serverless/session pooler split, private `raw-snapshots` bucket, manual first crawl, and custom domain layout:

```text
CUSTOM_DOMAIN       -> Web project
api.CUSTOM_DOMAIN   -> API project
```

The domain value remains deployment input and is never committed.

- [ ] **Step 5: Include the Web deployment contract in the backend test image**

Add this line before the development dependency install in `apps/api/Dockerfile`:

```dockerfile
COPY apps/web/vercel.json /app/apps/web/vercel.json
```

- [ ] **Step 6: Run contract and build checks**

Run: `pytest packages/backend/tests/test_deployment_contract.py -v`

Run: `cd apps/web && VERCEL=1 npm run build`

Expected: test and Vercel build PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/Dockerfile apps/web/vercel.json packages/backend/vercel.json packages/backend/tests/test_deployment_contract.py docs/deployment/vercel.md README.md
git commit -m "chore: configure Vercel and Supabase production"
```

### Task 7: Full verification and security review

**Files:**
- Modify only if verification exposes a defect.

**Interfaces:**
- Consumes all previous tasks.
- Produces a release-ready clean branch.

- [ ] **Step 1: Run complete backend and web tests**

Run: `make test`

Expected: all backend tests, Vitest, TypeScript, and Next production build PASS.

- [ ] **Step 2: Rebuild the local stack**

Run: `make up && make migrate && make seed && make smoke`

Expected: all services healthy, migrations at head, seed idempotent, smoke checks PASS.

- [ ] **Step 3: Verify live idempotence**

Run one allowed source twice and compare `job_revisions` counts before and after the second run.

Expected: the second run does not add a revision when the official posting content has not changed.

- [ ] **Step 4: Verify Vercel build and dependencies**

Run: `cd apps/web && VERCEL=1 npm run build && npm audit --audit-level=high`

Expected: build PASS and `found 0 vulnerabilities`.

- [ ] **Step 5: Scan the repository**

Run:

```bash
git diff --check
rg -n 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|sbp_[A-Za-z0-9]{20,}' --glob '!*.lock' .
```

Expected: no whitespace errors and no secret matches.

### Task 8: Publish, provision, deploy, and connect the domain

**Files:**
- No secret-bearing files are committed.
- Vercel creates ignored `.vercel/` project metadata.
- Supabase CLI may create ignored local link metadata under `supabase/.temp/`.

**Interfaces:**
- GitHub repository: `NoirStar/ejik-fit`
- GitHub head branch: a new non-destructive branch derived from the current local branch
- Supabase project name: `ejik-fit`
- Vercel projects: `ejik-fit-web`, `ejik-fit-api`

- [ ] **Step 1: Authenticate and publish GitHub**

Run `gh auth login --hostname github.com --git-protocol https --web`, verify with `gh auth status`, fetch remote state, push the complete local history to a new branch without force, then create a Draft PR targeting `main`.

Expected: authenticated account is `NoirStar`, remote branch exists, Draft PR URL is returned.

- [ ] **Step 2: Authenticate Supabase and create or select the project**

Install the CLI with `npx supabase`, run `npx supabase login`, list organizations and projects, then create `ejik-fit` in `ap-northeast-2` only if it does not already exist. Database password entry is performed directly by the user and is never echoed.

Expected: `npx supabase projects list` shows an ACTIVE_HEALTHY `ejik-fit` project.

- [ ] **Step 3: Link Supabase and provision data services**

Link the repository to the selected project, enable PGroonga, create the private `raw-snapshots` bucket, generate server-only S3 credentials, apply Alembic migrations with the Session Pooler URL, and seed sources.

Expected: Alembic is at `20260703_0002`, ten sources exist, bucket visibility is private.

- [ ] **Step 4: Configure GitHub repository secrets**

Set all secrets through `gh secret set` using stdin so values do not appear in command history:

```text
CRAWLER_DATABASE_URL
SUPABASE_S3_ENDPOINT_URL
SUPABASE_S3_REGION
SUPABASE_S3_ACCESS_KEY
SUPABASE_S3_SECRET_KEY
```

Expected: `gh secret list` shows all five names without revealing values.

- [ ] **Step 5: Run the first remote crawl**

Merge the workflow to the default branch or trigger it after the PR is merged, use `gh workflow run crawl.yml`, watch the run, and inspect the Actions Summary.

Expected: remote run succeeds and Supabase contains postings and snapshot objects.

- [ ] **Step 6: Authenticate Vercel and create two projects**

Run `npx vercel login`, link/deploy `apps/web` as `ejik-fit-web`, and link/deploy `packages/backend` as `ejik-fit-api`.

Set API environment values through stdin:

```text
DATABASE_URL is set from the Supabase Transaction Pooler value via stdin
DATABASE_POOL_MODE=transaction
SEARCH_BACKEND=postgres
POSTGRES_SEARCH_MODE=pgroonga
```

After API production deploy, set Web `API_BASE_URL` to the API production URL and deploy Web.

Expected: API `/health`, API `/api/postings?limit=1`, and Web `/` return HTTP 200.

- [ ] **Step 7: Connect the user-owned domain**

Ask for the exact domain at this step and bind it to the deployment-only `CUSTOM_DOMAIN` value. Add the chosen apex or `www` host to `ejik-fit-web` and the `api` subdomain of `CUSTOM_DOMAIN` to `ejik-fit-api`. Apply only the DNS records Vercel reports, wait for verification, make the alternate Web host redirect to the canonical host, and update `API_BASE_URL` to the verified API custom domain.

Expected: HTTPS is valid, canonical redirect works, Web list/detail loads from the API custom domain.

- [ ] **Step 8: Final production smoke test**

Verify Web, API health, posting search, posting detail, official source links, last verified time, GitHub scheduled workflow status, and Supabase revision idempotence.

Expected: every completion criterion in `docs/superpowers/specs/2026-07-03-supabase-vercel-production-design.md` is satisfied.
