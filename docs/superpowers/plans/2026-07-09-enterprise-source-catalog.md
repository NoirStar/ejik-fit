# Enterprise Source Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register the phase-2 enterprise/manufacturing/telecom official career sources in the operational catalog without accidentally scheduling unsupported connectors.

**Architecture:** Keep using `INITIAL_SOURCE_CATALOG` as the seed registry. Add future connector source types for static HTML, static app data, and public browser-rendered pages, then seed 12 official enterprise sources with `needs_connector` or `needs_browser` status so they are visible for operations but not crawled until a connector exists. Add a crawler guard so an unsupported source type cannot be treated as a successful empty listing.

**Tech Stack:** Python 3.12, SQLAlchemy ORM, Alembic, pytest, existing seed/crawler pipeline.

## Global Constraints

- Official source expansion follows `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`.
- CloakBrowser or browser rendering may only be used for public JavaScript rendering and public network response discovery.
- CAPTCHA solving, login bypass, Cloudflare or bot-protection bypass, session impersonation, and access-control bypass are out of scope.
- Unsupported connectors must not be scheduled as `allowed`.
- Existing Greeting, Naver, Kakao, and LINE sources stay active and must not be regressed.
- A single failed or unsupported listing must not close existing postings.
- Every production behavior change starts with a failing test.

---

## File Structure

- `packages/backend/src/ejikfit/models.py`: add future source type enum values.
- `packages/backend/alembic/versions/20260709_0007_enterprise_source_types.py`: add enum values for future connector families.
- `packages/backend/src/ejikfit/seed_data.py`: add `SeedSource.status` and the 12 phase-2 enterprise sources.
- `packages/backend/src/ejikfit/crawler.py`: guard unsupported source types.
- `packages/backend/tests/test_models.py`: prove new source type namespaces.
- `packages/backend/tests/test_seed_data.py`: prove phase-2 sources and statuses seed correctly.
- `packages/backend/tests/test_migration_offline.py`: prove offline SQL includes enum additions.
- `packages/backend/tests/test_crawler.py`: prove unsupported allowed connectors fail safely.

---

### Task 1: Phase-2 Enterprise Catalog

- [x] **Step 1: Research official career URLs**

Verified current official/company-operated pages for Samsung Careers, Hyundai Talent, Kia Jobs, LG Careers, SK Careers/SK hynix Talent Hub, KT Group Recruiting, CJ OliveNetworks careers, POSCO DX/POSCO Group recruiting, and Hanwha Systems/HanwhaIn.

- [x] **Step 2: Write failing tests**

Add tests for:
- `SourceType.HTML_LISTING_DETAIL`, `SourceType.STATIC_NEXT_DATA`, and `SourceType.BROWSER_PUBLIC_RENDER`.
- 12 enterprise slugs in `INITIAL_SOURCE_CATALOG`.
- Enterprise sources are not seeded as `allowed`.
- Existing blocked/stopped source states are not reset by seed.
- Unsupported allowed source types return `failed=1` without closing postings.

- [x] **Step 3: Run tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_models.py \
  packages/backend/tests/test_seed_data.py \
  packages/backend/tests/test_migration_offline.py \
  packages/backend/tests/test_crawler.py -q
```

- [x] **Step 4: Implement source types and seed status**

Add enum values, migration, `SeedSource.status`, and phase-2 sources with `needs_connector`/`needs_browser`.

- [x] **Step 5: Implement crawler unsupported connector guard**

When an allowed source has a source type with no connector route, mark it `needs_connector`, set `last_error_code="unsupported_connector"`, and return a failed crawl result.

- [x] **Step 6: Run tests to verify green**

Run the same command from Step 3.

---

## Self-Review

- Spec coverage: implements phase-2 registration/classification only. It does not implement new enterprise connectors or browser rendering.
- Placeholder scan: no open placeholders remain.
- Type consistency: source type and status names match the spec vocabulary and seed tests.
