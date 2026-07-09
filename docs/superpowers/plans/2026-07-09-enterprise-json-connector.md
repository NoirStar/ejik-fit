# Enterprise JSON Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `enterprise_json` source type for official company JSON endpoints that expose job lists outside of the Naver/Kakao/LINE-specific APIs.

**Architecture:** Add a new `SourceType.ENTERPRISE_JSON` enum value and PostgreSQL enum migration. Reuse the generic JSON job-object extraction built for `static_next_data` while keeping the enterprise connector raw-JSON only.

**Tech Stack:** Python, Alembic, SQLAlchemy, pytest.

## Global Constraints

- Do not add company-specific parsing branches.
- Keep `static_next_data` HTML support intact.
- Only parse official public JSON payloads; access-control handling remains in the fetcher.
- Use TDD: write failing tests before production code.

---

### Task 1: Enterprise JSON Connector

**Files:**
- Modify: `packages/backend/src/ejikfit/models.py`
- Create: `packages/backend/alembic/versions/20260709_0008_enterprise_json_source_type.py`
- Modify: `packages/backend/src/ejikfit/connectors/next_data.py`
- Create: `packages/backend/src/ejikfit/connectors/enterprise_json.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_models.py`
- Modify: `packages/backend/tests/test_migration_offline.py`
- Create: `packages/backend/tests/test_enterprise_json_connector.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Produces: `SourceType.ENTERPRISE_JSON = "enterprise_json"`
- Produces: `parse_enterprise_json_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]`
- Produces: crawler support for `SourceType.ENTERPRISE_JSON`

- [x] **Step 1: Write failing enum and migration tests**

Expected coverage:
- `SourceType.ENTERPRISE_JSON.value == "enterprise_json"`.
- Offline migration SQL includes `ENTERPRISE_JSON`.

- [x] **Step 2: Write failing parser and crawler tests**

Expected coverage:
- Raw JSON payload maps nested public job objects into `ParsedOpening`.
- Private or closed jobs are filtered by the shared JSON parser.
- `crawl_source` ingests `SourceType.ENTERPRISE_JSON`.

- [x] **Step 3: Run tests to verify red**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_enterprise_json_connector.py packages/backend/tests/test_models.py::test_future_enterprise_source_namespaces_are_stable packages/backend/tests/test_migration_offline.py::test_offline_migration_includes_conditional_pgroonga_index packages/backend/tests/test_crawler.py::test_crawl_source_routes_enterprise_json_into_ingestion -q`

Expected: FAIL because the enum and connector are missing.

- [x] **Step 4: Implement enum, migration, connector, and route**

Implementation requirements:
- Add enum value after `STATIC_NEXT_DATA`.
- Add Alembic revision `20260709_0008` after `20260709_0007`.
- Extract `parse_static_payload_openings(data, listing_url)` from `next_data.py`.
- Implement `enterprise_json.py` by `json.loads` + shared payload parser.
- Route `ENTERPRISE_JSON` through `_parse_listing_openings` and the list-style crawl branch.

- [x] **Step 5: Run selected and full verification**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_enterprise_json_connector.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py packages/backend/tests/test_crawler.py -q`

Expected: PASS.

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -q`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-enterprise-json-connector.md packages/backend/src/ejikfit/models.py packages/backend/alembic/versions/20260709_0008_enterprise_json_source_type.py packages/backend/src/ejikfit/connectors/next_data.py packages/backend/src/ejikfit/connectors/enterprise_json.py packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py packages/backend/tests/test_enterprise_json_connector.py packages/backend/tests/test_crawler.py
git commit -m "feat: add enterprise json connector"
```
