# HTML Listing Detail Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first reusable `html_listing_detail` connector so static official listing pages can be parsed into `ParsedOpening` without enabling unsupported sources prematurely.

**Architecture:** Add a focused connector module that parses anchors and nearby metadata from static HTML. Route `SourceType.HTML_LISTING_DETAIL` through the existing list-style ingestion path in `crawl_source`. Keep phase-2 enterprise seeds in `needs_connector` until a live smoke check proves a specific source is safe to schedule.

**Tech Stack:** Python 3.12, BeautifulSoup, SQLAlchemy ORM, pytest, existing crawler and `ParsedOpening` contract.

## Global Constraints

- Official source expansion follows `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`.
- CAPTCHA solving, login bypass, Cloudflare or bot-protection bypass, session impersonation, and access-control bypass are out of scope.
- Static HTML parsing must not mark unsupported or empty pages as successful if the source itself is not scheduled as `allowed`.
- Existing Greeting, Naver, Kakao, LINE, and phase-2 catalog tests stay green.
- A single failed or unsupported listing must not close existing postings.
- Every production behavior change starts with a failing test.

---

## File Structure

- `packages/backend/src/ejikfit/connectors/html_listing.py`: parse static listing anchors into `ParsedOpening`.
- `packages/backend/src/ejikfit/crawler.py`: route `SourceType.HTML_LISTING_DETAIL` to the new parser.
- `packages/backend/tests/test_html_listing_connector.py`: parser behavior tests.
- `packages/backend/tests/test_crawler.py`: ingestion route test.

---

### Task 1: Static HTML Listing Parser

- [x] **Step 1: Write failing parser tests**

Create tests for parsing job links, deduping duplicate anchors, resolving relative URLs, filtering navigation links, and extracting Korean date ranges.

- [x] **Step 2: Run parser tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_html_listing_connector.py -q
```

- [x] **Step 3: Implement connector**

Create `parse_html_listing_openings(html: str, listing_url: str) -> list[ParsedOpening]`.

- [x] **Step 4: Run parser tests to verify green**

Run the same parser test command.

### Task 2: Crawler Route

- [x] **Step 1: Write failing crawler route test**

Add a test that an allowed `HTML_LISTING_DETAIL` source ingests parsed openings and records source success metadata.

- [x] **Step 2: Run crawler tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py -q
```

- [x] **Step 3: Implement crawler route**

Import the parser and route `SourceType.HTML_LISTING_DETAIL` through it.

- [x] **Step 4: Run crawler tests to verify green**

Run the same crawler test command.

---

## Self-Review

- Spec coverage: implements a reusable 2차 connector family, but does not turn any enterprise source on automatically.
- Placeholder scan: no open placeholders remain.
- Type consistency: function name and source type are consistent across tests, connector, and crawler route.
