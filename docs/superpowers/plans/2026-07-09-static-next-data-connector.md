# Static Next Data Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `static_next_data` connector that extracts public job postings from Next.js `__NEXT_DATA__` HTML and static JSON payloads.

**Architecture:** Extend the existing `ejikfit.connectors.next_data` module so Greeting can keep using `extract_next_data` while the new generic parser returns `ParsedOpening` objects. Route `SourceType.STATIC_NEXT_DATA` through the crawler's listing parser and keep truly browser-only sources marked as unsupported browser work.

**Tech Stack:** Python, BeautifulSoup, SQLAlchemy test fixtures, pytest.

## Global Constraints

- Do not bypass login, CAPTCHA, bot checks, or access control.
- Store official-source collection state explicitly instead of hiding blocked or unsupported sources.
- Prefer connector-family reuse over company-specific hardcoding.
- Follow existing `ParsedOpening` ingestion contracts.
- Use TDD: write failing tests before production code.

---

### Task 1: Static Next Data Parser And Crawler Route

**Files:**
- Modify: `packages/backend/src/ejikfit/connectors/next_data.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Create: `packages/backend/tests/test_static_next_data_connector.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Consumes: `ParsedOpening` from `ejikfit.connectors.types`
- Produces: `parse_static_next_data_openings(raw: str, listing_url: str) -> list[ParsedOpening]`
- Produces: crawler support for `SourceType.STATIC_NEXT_DATA`

- [x] **Step 1: Write the failing parser tests**

```python
from ejikfit.connectors.next_data import parse_static_next_data_openings

def test_parse_static_next_data_openings_maps_next_data_script():
    ...
```

Expected coverage:
- HTML `script#__NEXT_DATA__` payloads.
- Raw static JSON payloads.
- Recursive nested job arrays.
- Filtering private, closed, and navigation-only dictionaries.
- Relative detail URL resolution and date parsing.

- [x] **Step 2: Run parser tests to verify they fail**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_static_next_data_connector.py -q`

Expected: FAIL because `parse_static_next_data_openings` does not exist.

- [x] **Step 3: Write the failing crawler route test**

Update `packages/backend/tests/test_crawler.py`:
- Add a `STATIC_NEXT_DATA` ingestion route test with JSON payload.
- Move unsupported-connector crawl and preview tests to `BROWSER_PUBLIC_RENDER`.

- [x] **Step 4: Run crawler route tests to verify they fail**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_crawler.py::test_crawl_source_routes_static_next_data_into_ingestion packages/backend/tests/test_crawler.py::test_unsupported_allowed_browser_connector_fails_without_closing_postings packages/backend/tests/test_crawler.py::test_preview_source_reports_unsupported_browser_connector_without_mutating -q`

Expected: FAIL because crawler does not route `STATIC_NEXT_DATA` yet and browser unsupported status still needs the expected behavior.

- [x] **Step 5: Implement parser and route**

Implementation requirements:
- Preserve `extract_next_data(html: str) -> dict[str, Any]`.
- Add `parse_static_next_data_openings(raw: str, listing_url: str) -> list[ParsedOpening]`.
- Reuse `urljoin` for relative detail URLs.
- Recursively inspect dict/list payloads and only map objects with a credible title plus id or URL.
- Skip private/unpublished/closed objects.
- Set browser-only unsupported source status to `NEEDS_BROWSER`.

- [x] **Step 6: Run selected tests to verify green**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_static_next_data_connector.py packages/backend/tests/test_crawler.py -q`

Expected: PASS.

- [x] **Step 7: Run full backend verification**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -q`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 8: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-static-next-data-connector.md packages/backend/src/ejikfit/connectors/next_data.py packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_static_next_data_connector.py packages/backend/tests/test_crawler.py
git commit -m "feat: add static next data connector"
```
