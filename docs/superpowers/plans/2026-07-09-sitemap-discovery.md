# Sitemap Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `sitemap_discovery` support for extracting official career/job URL candidates from sitemap XML and robots.txt files.

**Architecture:** Add a `SourceType.SITEMAP_DISCOVERY` enum and migration so discovery sources can be tracked in the registry. Implement a parser module that returns discovery candidates rather than job postings, then expose it through a focused `discover-sitemap` CLI command.

**Tech Stack:** Python, Alembic, ElementTree/regex parsing, httpx fetcher via existing crawler `HttpFetcher`, pytest.

## Global Constraints

- Do not ingest sitemap URLs as job postings.
- Do not bypass access control; only parse already-fetched public sitemap/robots content.
- Discovery output must be explicit candidate URLs, not hidden side effects.
- Use TDD: write failing tests before production code.

---

### Task 1: Sitemap Discovery Parser And CLI

**Files:**
- Modify: `packages/backend/src/ejikfit/models.py`
- Create: `packages/backend/alembic/versions/20260709_0011_sitemap_discovery_source_type.py`
- Create: `packages/backend/src/ejikfit/connectors/sitemap_discovery.py`
- Modify: `packages/backend/src/ejikfit/cli.py`
- Modify: `packages/backend/tests/test_models.py`
- Modify: `packages/backend/tests/test_migration_offline.py`
- Create: `packages/backend/tests/test_sitemap_discovery_connector.py`
- Modify: `packages/backend/tests/test_cli.py`

**Interfaces:**
- Produces: `SourceType.SITEMAP_DISCOVERY = "sitemap_discovery"`
- Produces: `parse_sitemap_discovery(raw: str, source_url: str) -> list[DiscoveryCandidate]`
- Produces: `discover-sitemap <url> [--sample-limit N]` CLI JSON output.

- [x] **Step 1: Write failing enum and migration tests**

Expected coverage:
- `SourceType.SITEMAP_DISCOVERY.value == "sitemap_discovery"`.
- Offline migration SQL includes `SITEMAP_DISCOVERY`.

- [x] **Step 2: Write failing parser and CLI tests**

Expected coverage:
- Sitemap XML `<loc>` entries are filtered to career/job/recruit/apply URLs.
- robots.txt `Sitemap:` lines and job-like URLs are parsed.
- CLI prints JSON with `url`, `discovered`, and `candidates`.

- [x] **Step 3: Run tests to verify red**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_sitemap_discovery_connector.py packages/backend/tests/test_models.py::test_future_enterprise_source_namespaces_are_stable packages/backend/tests/test_migration_offline.py::test_offline_migration_includes_conditional_pgroonga_index packages/backend/tests/test_cli.py::test_discover_sitemap_prints_json_candidates -q`

Expected: FAIL because the enum, connector module, and CLI command are missing.

- [x] **Step 4: Implement enum, migration, parser, and CLI**

Implementation requirements:
- Add enum value before `BROWSER_PUBLIC_RENDER`.
- Add Alembic revision `20260709_0011` after `20260709_0010`.
- Parser must dedupe URLs while preserving order.
- Parser must resolve relative URLs with `urljoin`.
- CLI must fetch with existing `HttpFetcher` and print deterministic JSON.

- [x] **Step 5: Run selected and full verification**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_sitemap_discovery_connector.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py packages/backend/tests/test_cli.py -q`

Expected: PASS.

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -q`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-sitemap-discovery.md packages/backend/src/ejikfit/models.py packages/backend/alembic/versions/20260709_0011_sitemap_discovery_source_type.py packages/backend/src/ejikfit/connectors/sitemap_discovery.py packages/backend/src/ejikfit/cli.py packages/backend/tests/test_models.py packages/backend/tests/test_migration_offline.py packages/backend/tests/test_sitemap_discovery_connector.py packages/backend/tests/test_cli.py
git commit -m "feat: add sitemap discovery cli"
```
