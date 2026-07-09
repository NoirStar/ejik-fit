# Lever Greenhouse Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `lever_greenhouse` connector for official Lever and Greenhouse job-board JSON feeds.

**Architecture:** Add a new `SourceType.LEVER_GREENHOUSE` enum and PostgreSQL enum migration. Implement a connector that detects Lever's list-shaped postings feed and Greenhouse's object-with-`jobs` feed, maps both to `ParsedOpening`, and routes the source type through the existing listing ingestion path.

**Tech Stack:** Python, Alembic, BeautifulSoup for HTML-to-text, SQLAlchemy test fixtures, pytest.

## Global Constraints

- Do not add company-specific parsing branches.
- Keep access-control handling in the fetcher; this connector parses only already-fetched public JSON.
- Preserve existing UUID and company-slug source operations.
- Use TDD: write failing tests before production code.

---

### Task 1: Lever And Greenhouse JSON Connector

**Files:**
- Modify: `packages/backend/src/ejikfit/models.py`
- Create: `packages/backend/alembic/versions/20260709_0009_lever_greenhouse_source_type.py`
- Create: `packages/backend/src/ejikfit/connectors/lever_greenhouse.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_models.py`
- Modify: `packages/backend/tests/test_migration_offline.py`
- Create: `packages/backend/tests/test_lever_greenhouse_connector.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Produces: `SourceType.LEVER_GREENHOUSE = "lever_greenhouse"`
- Produces: `parse_lever_greenhouse_openings(raw_json: str, listing_url: str) -> list[ParsedOpening]`
- Produces: crawler support for `SourceType.LEVER_GREENHOUSE`

- [x] **Step 1: Write failing enum and migration tests**

Expected coverage:
- `SourceType.LEVER_GREENHOUSE.value == "lever_greenhouse"`.
- Offline migration SQL includes `LEVER_GREENHOUSE`.

- [x] **Step 2: Write failing parser and crawler tests**

Expected coverage:
- Lever list payload maps public postings to `ParsedOpening`.
- Greenhouse `{"jobs": [...]}` payload maps public postings to `ParsedOpening`.
- Closed/unlisted items are filtered where the feed marks them as inactive.
- `crawl_source` ingests `SourceType.LEVER_GREENHOUSE`.

- [x] **Step 3: Run tests to verify red**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_lever_greenhouse_connector.py packages/backend/tests/test_models.py::test_future_enterprise_source_namespaces_are_stable packages/backend/tests/test_migration_offline.py::test_offline_migration_includes_conditional_pgroonga_index packages/backend/tests/test_crawler.py::test_crawl_source_routes_lever_greenhouse_into_ingestion -q`

Expected: FAIL because the enum and connector are missing.

- [x] **Step 4: Implement enum, migration, connector, and route**

Implementation requirements:
- Add enum value after `ENTERPRISE_JSON`.
- Add Alembic revision `20260709_0009` after `20260709_0008`.
- Parse Lever fields: `id`, `text`, `hostedUrl`, `applyUrl`, `categories`, `createdAt`, `lists`, `descriptionPlain`, `additionalPlain`.
- Parse Greenhouse fields: `id`, `title`, `absolute_url`, `location`, `departments`, `offices`, `metadata`, `content`, `updated_at`.
- Convert HTML descriptions to text with BeautifulSoup.
- Route `LEVER_GREENHOUSE` through `_parse_listing_openings` and the list-style crawl branch.

- [x] **Step 5: Run selected and full verification**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_lever_greenhouse_connector.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py packages/backend/tests/test_crawler.py -q`

Expected: PASS.

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -q`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-lever-greenhouse-connector.md packages/backend/src/ejikfit/models.py packages/backend/alembic/versions/20260709_0009_lever_greenhouse_source_type.py packages/backend/src/ejikfit/connectors/lever_greenhouse.py packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py packages/backend/tests/test_lever_greenhouse_connector.py packages/backend/tests/test_crawler.py
git commit -m "feat: add lever greenhouse connector"
```
