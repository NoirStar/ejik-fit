# Workday SuccessFactors Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable `workday` and `sap_successfactors` connectors for public enterprise ATS job-feed JSON.

**Architecture:** Add two `SourceType` values and a single PostgreSQL enum migration. Implement each connector as a focused parser module that maps public JSON payloads into `ParsedOpening`, then route both through the crawler's listing ingestion path.

**Tech Stack:** Python, Alembic, BeautifulSoup for HTML-to-text, SQLAlchemy test fixtures, pytest.

## Global Constraints

- Do not bypass login, CAPTCHA, bot checks, or access control.
- Do not add company-specific parsing branches.
- Keep access-control handling in the fetcher; these connectors parse only already-fetched public JSON.
- Existing source CLI operations must keep working through enum-driven choices.
- Use TDD: write failing tests before production code.

---

### Task 1: Workday And SAP SuccessFactors Connectors

**Files:**
- Modify: `packages/backend/src/ejikfit/models.py`
- Create: `packages/backend/alembic/versions/20260709_0010_workday_successfactors_source_types.py`
- Create: `packages/backend/src/ejikfit/connectors/workday.py`
- Create: `packages/backend/src/ejikfit/connectors/successfactors.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_models.py`
- Modify: `packages/backend/tests/test_migration_offline.py`
- Create: `packages/backend/tests/test_workday_connector.py`
- Create: `packages/backend/tests/test_successfactors_connector.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Produces: `SourceType.WORKDAY = "workday"`
- Produces: `SourceType.SAP_SUCCESSFACTORS = "sap_successfactors"`
- Produces: `parse_workday_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]`
- Produces: `parse_successfactors_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]`
- Produces: crawler support for both source types.

- [x] **Step 1: Write failing enum and migration tests**

Expected coverage:
- `SourceType.WORKDAY.value == "workday"`.
- `SourceType.SAP_SUCCESSFACTORS.value == "sap_successfactors"`.
- Offline migration SQL includes `WORKDAY` and `SAP_SUCCESSFACTORS`.

- [x] **Step 2: Write failing parser and crawler tests**

Expected coverage:
- Workday `jobPostings` feed maps public jobs to `ParsedOpening`.
- Workday detail-ish `jobPostingInfo` payload is also accepted.
- SAP SuccessFactors `d.results` / `results` style feed maps open jobs to `ParsedOpening`.
- Closed/inactive items are filtered.
- `crawl_source` ingests both new source types.

- [x] **Step 3: Run tests to verify red**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_workday_connector.py packages/backend/tests/test_successfactors_connector.py packages/backend/tests/test_models.py::test_future_enterprise_source_namespaces_are_stable packages/backend/tests/test_migration_offline.py::test_offline_migration_includes_conditional_pgroonga_index packages/backend/tests/test_crawler.py::test_crawl_source_routes_workday_into_ingestion packages/backend/tests/test_crawler.py::test_crawl_source_routes_successfactors_into_ingestion -q`

Expected: FAIL because the source types and connector modules are missing.

- [x] **Step 4: Implement enum, migration, connector modules, and routes**

Implementation requirements:
- Add enum values after `LEVER_GREENHOUSE`.
- Add Alembic revision `20260709_0010` after `20260709_0009`.
- Workday parser supports `jobPostings` list and `jobPostingInfo` object.
- SAP parser supports `d.results`, `results`, `value`, `jobs`, and `jobRequisitions` lists.
- Convert HTML descriptions to text with BeautifulSoup.
- Route both source types through `_parse_listing_openings` and the list-style crawl branch.

- [x] **Step 5: Run selected and full verification**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_workday_connector.py packages/backend/tests/test_successfactors_connector.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py packages/backend/tests/test_crawler.py -q`

Expected: PASS.

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -q`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-workday-successfactors-connectors.md packages/backend/src/ejikfit/models.py packages/backend/alembic/versions/20260709_0010_workday_successfactors_source_types.py packages/backend/src/ejikfit/connectors/workday.py packages/backend/src/ejikfit/connectors/successfactors.py packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py packages/backend/tests/test_workday_connector.py packages/backend/tests/test_successfactors_connector.py packages/backend/tests/test_crawler.py
git commit -m "feat: add workday successfactors connectors"
```
