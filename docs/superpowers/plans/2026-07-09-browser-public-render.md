# Browser Public Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `browser_public_render` sources crawlable when a public-page browser renderer is supplied, while preserving a clear `needs_browser` failure state when no renderer is configured.

**Architecture:** Add a focused connector that parses rendered HTML by reusing the existing JSON-LD, Next data, and static HTML listing parsers. Add a browser-rendering interface to the crawler so tests can inject a deterministic renderer and production CLI paths can use a lazy Playwright renderer without requiring Playwright at import time.

**Tech Stack:** Python 3.12, SQLAlchemy, pytest, BeautifulSoup connector parsers, optional Playwright import inside the runtime renderer.

## Global Constraints

- Do not solve CAPTCHA, login, Cloudflare challenge, or access-control bypass.
- Treat missing browser tooling as an explicit source error, not as a successful empty crawl.
- Do not close existing postings when browser rendering is unavailable or blocked.
- Keep parser behavior deterministic and testable without installing Playwright.
- Reuse existing parsed opening types and ingestion flow.

---

### Task 1: Rendered HTML Connector

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/browser_public.py`
- Test: `packages/backend/tests/test_browser_public_connector.py`

**Interfaces:**
- Consumes: `parse_jsonld_openings(html: str, page_url: str)`, `parse_static_next_data_openings(html: str, page_url: str)`, `parse_html_listing_openings(html: str, listing_url: str)`
- Produces: `parse_browser_public_render_openings(html: str, page_url: str) -> list[ParsedOpening]`

- [ ] **Step 1: Write the failing test**

```python
from ejikfit.connectors.browser_public import parse_browser_public_render_openings


def test_parse_browser_public_render_openings_reuses_existing_rendered_html_parsers() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "identifier": "jsonld-1",
          "title": "ML Platform Engineer",
          "url": "https://careers.example.com/jobs/jsonld-1"
        }
        </script>
      </head>
      <body>
        <article>
          <a href="/jobs/backend-2">Backend Engineer</a>
          <p>정규직 · 경력 · 서울</p>
        </article>
      </body>
    </html>
    """

    openings = parse_browser_public_render_openings(
        html,
        "https://careers.example.com/jobs",
    )

    assert [opening.external_id for opening in openings] == [
        "jsonld-1",
        "backend-2",
    ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_browser_public_connector.py -q`

Expected: FAIL with `ModuleNotFoundError: No module named 'ejikfit.connectors.browser_public'`.

- [ ] **Step 3: Write minimal implementation**

Create `parse_browser_public_render_openings` that calls the three existing parsers in order and deduplicates by `(external_id, url)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_browser_public_connector.py -q`

Expected: PASS.

### Task 2: Crawler Browser Renderer Route

**Files:**
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Consumes: `parse_browser_public_render_openings(html: str, page_url: str)`
- Produces: `BrowserRenderer.render(url: str) -> FetchedPage`, optional `browser_renderer` argument on `preview_source` and `crawl_source`, and `PlaywrightBrowserRenderer`

- [ ] **Step 1: Write failing crawl and preview tests**

Add a fake renderer in `test_crawler.py`:

```python
class StaticBrowserRenderer:
    def __init__(self, text: str) -> None:
        self.text = text
        self.rendered_urls: list[str] = []

    async def render(self, url: str) -> crawler.FetchedPage:
        self.rendered_urls.append(url)
        return crawler.FetchedPage(
            url=url,
            text=self.text,
            status_code=200,
            headers={},
        )
```

Add tests showing that crawl ingests rendered HTML, preview returns samples without mutation, and missing renderer records `unsupported_connector` with `SourceStatus.NEEDS_BROWSER`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_crawler.py::test_crawl_source_routes_browser_public_render_into_ingestion packages/backend/tests/test_crawler.py::test_preview_source_parses_browser_public_render_without_persisting_or_mutating -q`

Expected: FAIL because `crawl_source` and `preview_source` do not accept `browser_renderer`.

- [ ] **Step 3: Implement crawler route**

Update `crawler.py` to branch `browser_public_render` through `browser_renderer.render(source.base_url)`, parse rendered HTML with `parse_browser_public_render_openings`, and pass `PlaywrightBrowserRenderer()` from `run_source_by_id` and `preview_source_by_id`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_browser_public_connector.py packages/backend/tests/test_crawler.py -q`

Expected: PASS.

### Task 3: Verification and Commit

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full backend tests**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests -q`

Expected: all tests pass with only existing warnings.

- [ ] **Step 2: Check whitespace**

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-browser-public-render.md packages/backend/src/ejikfit/connectors/browser_public.py packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_browser_public_connector.py packages/backend/tests/test_crawler.py
git commit -m "feat: add browser public render connector"
```
