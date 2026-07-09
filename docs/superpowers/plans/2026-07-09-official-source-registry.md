# Official Source Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `CareerSource` from a crawl URL list into the first operational source registry so official company source health, policy status, and prioritization metadata are stored with each source.

**Architecture:** Keep the existing `Company` + `CareerSource` catalog instead of adding a new table. Add the registry fields directly to `CareerSource`, seed them from `INITIAL_SOURCE_CATALOG`, and record crawler success/failure metadata during source runs. Source status remains the scheduler gate, while `policy_status` records whether a source is publicly allowed, needs review, blocked, or stopped.

**Tech Stack:** Python 3.12, SQLAlchemy ORM, Alembic, pytest, existing async `httpx` crawler.

## Global Constraints

- Official source expansion follows `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`.
- CloakBrowser or browser rendering may only be used for public JavaScript rendering and public network response discovery.
- CAPTCHA solving, login bypass, Cloudflare or bot-protection bypass, session impersonation, and access-control bypass are out of scope.
- CAPTCHA, security checks, authentication screens, 401, 403, and similar blocks must leave source status metadata instead of pretending the source has zero jobs.
- Existing Greeting, Naver, Kakao, and LINE sources stay active and must not be regressed.
- A single failed listing must not close existing postings.
- Every production behavior change starts with a failing test.
- Do not keep a local dev server running after verification.

---

## File Structure

- `packages/backend/src/ejikfit/models.py`: add `PolicyStatus`, new `SourceStatus` values, registry metadata columns, and `priority_score`.
- `packages/backend/alembic/versions/20260709_0006_source_registry_fields.py`: add new status enum values, policy status enum, and registry columns to `career_sources`.
- `packages/backend/src/ejikfit/seed_data.py`: extend `SeedSource` with registry metadata and persist it idempotently.
- `packages/backend/src/ejikfit/crawler.py`: update source health metadata on success, temporary failure, and blocked source failure.
- `packages/backend/tests/test_models.py`: prove new status namespaces and default registry values.
- `packages/backend/tests/test_seed_data.py`: prove seeded sources persist connector family, sector, policy status, and priority metadata.
- `packages/backend/tests/test_migration_offline.py`: prove offline Alembic SQL includes the new enum values and columns.
- `packages/backend/tests/test_crawler.py`: prove blocked and temporary failures record source health without closing postings.

---

### Task 1: Registry Fields And Seed Metadata

**Files:**
- Modify: `packages/backend/src/ejikfit/models.py`
- Modify: `packages/backend/src/ejikfit/seed_data.py`
- Create: `packages/backend/alembic/versions/20260709_0006_source_registry_fields.py`
- Modify: `packages/backend/tests/test_models.py`
- Modify: `packages/backend/tests/test_seed_data.py`
- Modify: `packages/backend/tests/test_migration_offline.py`

**Interfaces:**
- Consumes: existing `SeedSource(name, slug, base_url, source_type, homepage_url)` and `seed_sources(session) -> int`.
- Produces: `PolicyStatus`, expanded `SourceStatus`, `CareerSource.priority_score`, and persisted registry metadata fields.

- [x] **Step 1: Write the failing model test**

Append to `packages/backend/tests/test_models.py`:

```python
def test_source_registry_status_namespaces_are_stable() -> None:
    assert SourceStatus.NEEDS_CONNECTOR.value == "needs_connector"
    assert SourceStatus.NEEDS_BROWSER.value == "needs_browser"
    assert SourceStatus.BLOCKED.value == "blocked"
    assert PolicyStatus.ALLOWED.value == "allowed"
    assert PolicyStatus.REVIEW.value == "review"
    assert PolicyStatus.BLOCKED.value == "blocked"
    assert PolicyStatus.STOPPED.value == "stopped"


def test_career_source_registry_defaults_and_priority_score() -> None:
    source = CareerSource(
        company=Company(name="테스트 기업", slug="test-company"),
        base_url="https://example.com/careers",
        source_type=SourceType.JSON_LD,
        status=SourceStatus.ALLOWED,
        brand_tier_weight=6,
        tech_job_priority=4,
        expected_job_volume=3,
        connector_reuse_score=2,
        policy_risk=1,
        non_tech_noise=2,
    )

    assert source.policy_status == PolicyStatus.REVIEW
    assert source.connector_family == "json_ld"
    assert source.priority_score == 12
```

- [x] **Step 2: Write the failing seed metadata test**

Extend `test_seeding_sources_is_idempotent_and_persists_catalog_source_types` in `packages/backend/tests/test_seed_data.py`:

```python
        sources_by_slug = {source.company.slug: source for source in sources}
        naver = sources_by_slug["naver"]
        assert naver.connector_family == "naver_json"
        assert naver.policy_status == PolicyStatus.ALLOWED
        assert naver.sector == "platform"
        assert naver.brand_tier_weight == 6
        assert naver.tech_job_priority == 5
        assert naver.expected_job_volume == 5
        assert naver.priority_score > sources_by_slug["deepauto-ai"].priority_score
```

Add `PolicyStatus` to the imports.

- [x] **Step 3: Write the failing migration test**

Extend `packages/backend/tests/test_migration_offline.py`:

```python
    assert "NEEDS_CONNECTOR" in sql
    assert "NEEDS_BROWSER" in sql
    assert "BLOCKED" in sql
    assert "policystatus" in sql
    assert "connector_family" in sql
    assert "last_success_at" in sql
    assert "last_error_code" in sql
    assert "last_error_reason" in sql
```

- [x] **Step 4: Run tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_models.py \
  packages/backend/tests/test_seed_data.py \
  packages/backend/tests/test_migration_offline.py -q
```

Expected: fail because `PolicyStatus`, new source statuses, registry fields, and migration do not exist.

- [x] **Step 5: Implement minimal registry fields**

Add `PolicyStatus`, expand `SourceStatus`, add nullable/defaulted registry fields to `CareerSource`, and add:

```python
@property
def priority_score(self) -> int:
    return (
        self.brand_tier_weight
        + self.tech_job_priority
        + self.expected_job_volume
        + self.connector_reuse_score
        - self.policy_risk
        - self.non_tech_noise
    )
```

- [x] **Step 6: Add Alembic migration**

Create `20260709_0006_source_registry_fields.py` with PostgreSQL enum alterations for `NEEDS_CONNECTOR`, `NEEDS_BROWSER`, `BLOCKED`, a `policystatus` enum, and SQLite/PostgreSQL-compatible column additions with server defaults for required metadata.

- [x] **Step 7: Persist seed metadata idempotently**

Extend `SeedSource` with fields for `sector`, `connector_family`, `policy_status`, `brand_tier_weight`, `tech_job_priority`, `expected_job_volume`, `connector_reuse_score`, `policy_risk`, `non_tech_noise`, and `notes`. Set Naver/Kakao/LINE to high-priority platform sources and Greeting sources to conservative defaults.

- [x] **Step 8: Run tests to verify green**

Run the same command from Step 4. Expected: all selected tests pass.

---

### Task 2: Source Health Recording During Crawls

**Files:**
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Consumes: `crawl_source(session, source, fetcher, store, now, ...) -> CrawlResult`.
- Produces: updated `CareerSource.last_success_at`, `last_error_code`, `last_error_reason`, `status`, and `policy_status` based on crawl outcome.

- [x] **Step 1: Write failing crawler health tests**

Add tests showing blocked fetches set `status=SourceStatus.BLOCKED`, `policy_status=PolicyStatus.BLOCKED`, `last_error_code="blocked"`, and temporary HTTP failures keep status allowed while setting `last_error_code="temporary_fetch_error"`.

- [x] **Step 2: Run tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py -q
```

Expected: fail because crawler does not record health metadata yet.

- [x] **Step 3: Implement health metadata updates**

Add small helper functions in `crawler.py`:

```python
def _mark_source_success(source: CareerSource, now: datetime) -> None:
    source.last_verified_at = now
    source.last_success_at = now
    source.last_error_code = None
    source.last_error_reason = None


def _mark_source_error(
    source: CareerSource,
    code: str,
    reason: str,
    *,
    status: SourceStatus | None = None,
    policy_status: PolicyStatus | None = None,
) -> None:
    if status is not None:
        source.status = status
    if policy_status is not None:
        source.policy_status = policy_status
    source.last_error_code = code
    source.last_error_reason = reason[:1000]
```

Use these helpers in blocked and temporary fetch branches and replace direct `source.last_verified_at = now` with `_mark_source_success(source, now)`.

- [x] **Step 4: Run tests to verify green**

Run the same command from Step 2. Expected: all crawler tests pass.

---

## Self-Review

- Spec coverage: this plan implements the first recommended next step: operational source status, policy status, connector family, priority metadata, last success/error fields, and blocked state recording. It does not implement phase-2 company research or browser rendering.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: `PolicyStatus`, `SourceStatus`, `connector_family`, `last_success_at`, `last_error_code`, and `last_error_reason` are consistently named across tests, model, migration, seed, and crawler tasks.
