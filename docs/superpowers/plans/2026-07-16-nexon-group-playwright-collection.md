# Nexon Group Playwright Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect the current public technical postings from Nexon Company's integrated careers site with one ordinary headed Playwright session and attribute them to 13 separate affiliate companies.

**Architecture:** Add a pure Nexon response parser, extend the existing Playwright renderer with a cached headed-browser JSON snapshot, and route 13 logical `browser_public_render` sources through that snapshot. Reuse the current provider-group serialization so one `crawl-all` run passes one renderer instance across all Nexon sources, while each affiliate retains independent ingestion and safe closing state.

**Tech Stack:** Python 3.12, Playwright Chromium, Xvfb, FastAPI/SQLAlchemy crawler models, pytest, Next.js 16, TypeScript, Vitest.

## Global Constraints

- Use stock Playwright Chromium only; do not add CloakBrowser, stealth patches, proxies, login state, or CAPTCHA handling.
- Navigate only `https://careers.nexon.com/` and `https://careers.nexon.com/recruit`; do not crawl `/recruit?…` URLs.
- Validate the complete declared listing before ingesting or closing any posting.
- Fetch the shared Nexon snapshot once per `crawl-all` run and partition it into 13 independently tracked sources.
- Collect only roles accepted by the existing technical-role classifier.
- Keep official detail URLs and official affiliate names unchanged.
- Add only targeted tests for parser correctness, completeness, snapshot reuse, seed mappings, Xvfb runtime, and logo routing.
- Preserve unrelated user files and changes.

---

### Task 1: Pure Nexon connector

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/nexon.py`
- Create: `packages/backend/tests/test_nexon_connector.py`

**Interfaces:**
- Produces: `NEXON_LIST_API`, `NEXON_CORPORATIONS_API`, `NEXON_RECRUIT_URL`, `NexonPage`, `nexon_request_body(page: int, size: int = 15) -> dict[str, object]`, `parse_nexon_page(payload: object) -> NexonPage`, `combine_nexon_pages(pages: list[NexonPage], corporations: object) -> dict[str, object]`, `filter_nexon_payload(payload: str, corporation_name: str) -> str`, and `parse_nexon_openings(payload: str, page_url: str) -> list[ParsedOpening]`.
- Consumes: existing `ParsedOpening`, `structured_plain_text`, and timezone-aware `datetime` conventions.

- [ ] **Step 1: Write focused failing connector tests**

Create compact fixtures for two pages containing jobs from `넥슨코리아` and `네오플`. Assert:

```python
def test_combine_nexon_pages_requires_a_complete_unique_listing() -> None:
    first = parse_nexon_page(_payload(page=1, total=3, ids=(100, 101)))
    second = parse_nexon_page(_payload(page=2, total=3, ids=(102,)))

    combined = combine_nexon_pages(
        [first, second],
        [{"corpCode": "NX", "corpName": "넥슨코리아"}],
    )

    assert combined["pagination"] == {"page": 1, "size": 3, "total": 3}
    assert [row["jobPostNo"] for row in combined["list"]] == [100, 101, 102]


def test_combine_nexon_pages_rejects_duplicate_or_missing_rows() -> None:
    with pytest.raises(ValueError, match="duplicate"):
        combine_nexon_pages(
            [
                parse_nexon_page(_payload(page=1, total=2, ids=(100,))),
                parse_nexon_page(_payload(page=2, total=2, ids=(100,))),
            ],
            [{"corpCode": "NX", "corpName": "넥슨코리아"}],
        )


def test_filter_and_parse_nexon_openings_preserves_official_fields() -> None:
    filtered = filter_nexon_payload(json.dumps(_combined_payload()), "네오플")
    openings = parse_nexon_openings(filtered, NEXON_RECRUIT_URL)

    assert [opening.external_id for opening in openings] == ["102"]
    assert openings[0].url == "https://careers.nexon.com/recruit/102"
    assert openings[0].employment_type == "regular"
    assert openings[0].career_type == "experienced"
    assert openings[0].location == "제주"
    assert "Python" in openings[0].description_text
```

Also cover a changed pagination total, early empty page, missing job ID, unknown corporation name, `경력무관`, `계약직`, ISO closing timestamps, and date-only fields.

- [ ] **Step 2: Run connector tests and verify RED**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  -p pytest_asyncio.plugin packages/backend/tests/test_nexon_connector.py -q
```

Expected: collection fails because `ejikfit.connectors.nexon` does not exist.

- [ ] **Step 3: Implement the minimal pure connector**

Use frozen dataclasses and strict validation. Required mappings:

```python
NEXON_RECRUIT_URL = "https://careers.nexon.com/recruit"
NEXON_LIST_API = "https://career-gateway.nexon.com/career/v1/open/job-posts"

CAREER_TYPES = {
    "신입": "new_comer",
    "경력": "experienced",
    "경력무관": "mixed",
    "신입/경력": "mixed",
}
EMPLOYMENT_TYPES = {
    "정규직": "regular",
    "계약직": "contract",
    "인턴": "intern",
}
```

`combine_nexon_pages` must require stable totals, sequential page numbers, at most 50 pages, unique IDs, `len(rows) == total`, a unique code/name corporation directory, and a known corporation name on every job. The combined payload retains that corporation directory so an affiliate with zero current jobs is still distinguishable from an unknown affiliate. `filter_nexon_payload` must set the filtered total to `len(filtered_rows)` and reject a corporation absent from the directory. `parse_nexon_openings` must reject malformed required fields instead of skipping them silently.

- [ ] **Step 4: Run connector tests and verify GREEN**

Run the command from Step 2.

Expected: all Nexon connector tests pass.

- [ ] **Step 5: Commit the connector**

```bash
git add packages/backend/src/ejikfit/connectors/nexon.py \
  packages/backend/tests/test_nexon_connector.py
git commit -m "feat(crawler): parse Nexon group jobs"
```

---

### Task 2: Headed Playwright snapshot and pagination

**Files:**
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Consumes: Task 1's list URL, request builder, page parser, and combiner.
- Produces: `PlaywrightBrowserRenderer.fetch_nexon_snapshot() -> FetchedPage` with one-result/one-error instance caching; optional `browser_renderer` injection in `run_source_by_id`.

- [ ] **Step 1: Add failing renderer tests**

Extend the existing fake Playwright objects only with the minimal context, expected-response, JSON, and `evaluate` methods needed by the Nexon path. Assert:

```python
def test_nexon_snapshot_uses_headed_chromium_and_combines_pages(monkeypatch) -> None:
    renderer, fake_chromium, fake_page = _nexon_renderer(monkeypatch, total=16)

    snapshot = asyncio.run(renderer.fetch_nexon_snapshot())

    assert fake_chromium.launch_headless is False
    assert fake_page.visited_urls == [
        "https://careers.nexon.com/",
        "https://careers.nexon.com/recruit",
    ]
    assert fake_page.evaluated_pages == [2]
    assert len(json.loads(snapshot.text)["list"]) == 16


def test_nexon_snapshot_reuses_success_and_failure(monkeypatch) -> None:
    renderer, fake_chromium, _ = _nexon_renderer(monkeypatch, total=1)

    first = asyncio.run(renderer.fetch_nexon_snapshot())
    second = asyncio.run(renderer.fetch_nexon_snapshot())

    assert first is second
    assert fake_chromium.launch_count == 1
```

Add a failure test proving a `403` or challenge raises `BlockedSourceError` and the same renderer does not launch a second browser on the next affiliate.

- [ ] **Step 2: Run renderer tests and verify RED**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py \
  -k 'nexon_snapshot' -q
```

Expected: fail because the snapshot method is missing.

- [ ] **Step 3: Implement headed snapshot collection**

Keep `render()` unchanged and headless for existing sources. In the Nexon-only method:

```python
browser = await playwright.chromium.launch(headless=False)
context = await browser.new_context(
    locale="ko-KR",
    timezone_id="Asia/Seoul",
    viewport={"width": 1440, "height": 900},
)
```

Capture the official `/corps` response while loading the root and the first `/job-posts` response around navigation to `/recruit`. Fetch page 2 onward with `page.evaluate` using the same request body and `credentials: "include"`, waiting one second between pages in production. Convert the validated combined payload, including the corporation directory, to a `FetchedPage`. Cache the complete page or the raised exception on the renderer instance.

Make browser/context closing unconditional. Treat `401`, `403`, `429`, 4xx, 5xx, challenge content, invalid JSON, and incomplete pagination as failures using the existing crawler exception vocabulary.

- [ ] **Step 4: Run renderer tests and existing browser-render tests**

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py \
  -k 'playwright_renderer or nexon_snapshot' -q
```

Expected: pass with existing headless render behavior unchanged.

- [ ] **Step 5: Commit the browser snapshot**

```bash
git add packages/backend/src/ejikfit/crawler.py \
  packages/backend/tests/test_crawler.py
git commit -m "feat(crawler): collect Nexon in headed Chromium"
```

---

### Task 3: Route and share the snapshot across 13 sources

**Files:**
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Consumes: `filter_nexon_payload`, `parse_nexon_openings`, and the cached renderer from Tasks 1–2.
- Produces: connector family `nexon_group_browser_api_tech`, provider key `nexon`, and one renderer instance per Nexon host group.

- [ ] **Step 1: Add failing crawler route and sharing tests**

Create a fake renderer whose `fetch_nexon_snapshot` increments a counter and returns a combined two-company payload. Prove `_fetch_listing_page` filters by `source.request_body["corpName"]`, `_parse_listing_openings` uses the Nexon JSON parser, and technical filtering removes a nontechnical role.

Extend the provider serialization test with two Nexon targets and assert both calls receive the same non-null renderer object:

```python
def fake_run(source_id: str, browser_renderer=None) -> dict[str, int]:
    if source_id.startswith("nexon"):
        nexon_renderers.append(browser_renderer)
    return _successful_counts()

assert len(nexon_renderers) == 2
assert nexon_renderers[0] is nexon_renderers[1]
```

Add an ingestion safety test where snapshot failure leaves an existing open posting unchanged.

- [ ] **Step 2: Run route tests and verify RED**

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py \
  -k 'nexon_group or shared_provider or nexon_snapshot_failure' -q
```

Expected: fail because routing and shared renderer injection are absent.

- [ ] **Step 3: Implement routing and provider sharing**

Required changes:

```python
NEXON_CONNECTOR_FAMILY = "nexon_group_browser_api_tech"
```

- `_fetch_listing_page`: use `fetch_nexon_snapshot` and filter by the configured corporation name.
- `_parse_listing_openings`: use `parse_nexon_openings` for the Nexon connector family.
- `_listing_is_self_validated`: return true for the validated Nexon payload.
- `_allowed_sources`: set provider key `nexon` for the Nexon family.
- `_crawl_host_group`: construct one `PlaywrightBrowserRenderer` only for a Nexon group and pass it to every target.
- `run_source_by_id`: accept `browser_renderer: BrowserRenderer | None = None`, defaulting to a new renderer for standalone calls.

Do not alter provider behavior for Greeting or other sources.

- [ ] **Step 4: Run targeted crawler tests and verify GREEN**

Run the command from Step 2, then:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py -q
```

Expected: complete crawler test module passes.

- [ ] **Step 5: Commit crawler routing**

```bash
git add packages/backend/src/ejikfit/crawler.py \
  packages/backend/tests/test_crawler.py
git commit -m "feat(crawler): share Nexon group snapshots"
```

---

### Task 4: Register 13 affiliate companies and enable Xvfb

**Files:**
- Modify: `packages/backend/src/ejikfit/seed_data.py`
- Modify: `packages/backend/tests/test_seed_data.py`
- Modify: `.github/workflows/crawl.yml`
- Modify: `packages/backend/tests/test_crawl_workflow.py`
- Modify: `README.md`

**Interfaces:**
- Consumes: connector family and request configuration from Task 3.
- Produces: 13 `allowed` source rows and a `DISPLAY` available to scheduled/manual crawler runs.

- [ ] **Step 1: Add failing seed and workflow tests**

In `test_seed_data.py`, assert the exact code/name/slug table from the design, unique fragment URLs, `request_body={"corpCode": code, "corpName": name}`, `browser_public_render`, allowed source/policy status, and legacy root migration into `#NX`. Update the old assertion that Nexon is `needs_browser`.

In `test_crawl_workflow.py`, assert the non-push workflow starts Xvfb and exports `DISPLAY=:99` before any crawl command.

- [ ] **Step 2: Run seed/workflow tests and verify RED**

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest \
  packages/backend/tests/test_seed_data.py \
  packages/backend/tests/test_crawl_workflow.py -q
```

Expected: fail on the missing affiliates and X display.

- [ ] **Step 3: Add the registry and runtime configuration**

Replace the one legacy Nexon entry with 13 `SeedSource` entries using:

```python
base_url=f"https://careers.nexon.com/recruit#{corp_code}"
source_type=SourceType.BROWSER_PUBLIC_RENDER
connector_family="nexon_group_browser_api_tech"
request_body={"corpCode": corp_code, "corpName": company_name}
status=SourceStatus.ALLOWED
policy_status=PolicyStatus.ALLOWED
```

Add the legacy root URL to `SOURCE_URL_MIGRATIONS` for `#NX`. Use each official corporation site's homepage URL from the verified corporations response.

In the workflow, after installing Playwright Chromium and only for non-push events, start:

```bash
Xvfb :99 -screen 0 1440x900x24 >/tmp/ejikfit-xvfb.log 2>&1 &
echo "DISPLAY=:99" >> "$GITHUB_ENV"
```

Update README browser instructions to use Xvfb for a Nexon preview and state that it is ordinary headed Chromium, not an access-control bypass.

- [ ] **Step 4: Run seed/workflow tests and verify GREEN**

Run the command from Step 2.

Expected: pass.

- [ ] **Step 5: Commit source activation**

```bash
git add packages/backend/src/ejikfit/seed_data.py \
  packages/backend/tests/test_seed_data.py \
  packages/backend/tests/test_crawl_workflow.py \
  .github/workflows/crawl.yml README.md
git commit -m "feat(crawler): activate Nexon group sources"
```

---

### Task 5: Official affiliate logo identities

**Files:**
- Modify: `apps/web/src/app/company-logo-assets/[logoKey]/route.ts`
- Modify: `apps/web/src/app/company-logo-assets/[logoKey]/route.test.ts`
- Modify: `apps/web/src/features/home-feed/company-identity.ts`
- Modify: `apps/web/src/features/home-feed/company-identity.test.ts`
- Modify: `apps/web/public/company-logos/SOURCES.md`

**Interfaces:**
- Consumes: the 13 slugs from Task 4 and official `logoImgUrl` values from the Nexon corporations endpoint.
- Produces: official logo proxy keys and deterministic initials fallback for every affiliate.

- [ ] **Step 1: Add failing identity tests**

Add a table-driven test resolving each affiliate name/slug to its own `/company-logo-assets/{key}` path. Add one route test proving `nexon-games` is whitelisted and proxied. Preserve the existing unknown-key and invalid-image fallback tests.

- [ ] **Step 2: Run identity tests and verify RED**

```bash
cd apps/web && npm test -- \
  src/features/home-feed/company-identity.test.ts \
  'src/app/company-logo-assets/[logoKey]/route.test.ts'
```

Expected: missing affiliate identities fail.

- [ ] **Step 3: Add official logo routes and source records**

Add the exact official `https://careers.nexon.com/files/logo/...` URL returned for each corporation to the proxy allowlist. Add exact aliases before the generic Nexon host fallback so `넥슨게임즈` does not resolve as `넥슨`. Record URL, retrieval date `2026-07-16`, and the existing identification-only usage note in `SOURCES.md`.

- [ ] **Step 4: Run identity tests and verify GREEN**

Run the command from Step 2.

Expected: pass.

- [ ] **Step 5: Commit logo identities**

```bash
git add 'apps/web/src/app/company-logo-assets/[logoKey]/route.ts' \
  'apps/web/src/app/company-logo-assets/[logoKey]/route.test.ts' \
  apps/web/src/features/home-feed/company-identity.ts \
  apps/web/src/features/home-feed/company-identity.test.ts \
  apps/web/public/company-logos/SOURCES.md
git commit -m "feat(web): identify Nexon group companies"
```

---

### Task 6: Verification, integration, and production collection

**Files:**
- Modify only files required by failures attributable to Tasks 1–5.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified `main`, deployed source registry, and current production Nexon affiliate jobs.

- [ ] **Step 1: Run focused backend verification**

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_nexon_connector.py \
  packages/backend/tests/test_crawler.py \
  packages/backend/tests/test_seed_data.py \
  packages/backend/tests/test_crawl_workflow.py -q
```

Expected: all pass without warnings attributable to the change.

- [ ] **Step 2: Run web verification**

```bash
cd apps/web
npm test -- src/features/home-feed/company-identity.test.ts \
  'src/app/company-logo-assets/[logoKey]/route.test.ts'
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits zero.

- [ ] **Step 3: Run a live local Nexon smoke without persisting production data**

Use stock headed Chromium under Xvfb to fetch the snapshot and run the pure parser. Assert total equals the API declaration, all job IDs are unique, all returned corporations are registered, and at least one technical posting exists. Do not print full descriptions or cookies.

- [ ] **Step 4: Review the diff and commit any verification-only correction**

```bash
git diff --check
git status --short
```

Stage only intentional tracked files. Do not add `.agents/`, handoff images/documents, or the root `package-lock.json`.

- [ ] **Step 5: Merge into main and push**

Fast-forward the feature branch into `main` after verification, then:

```bash
git push origin main
```

- [ ] **Step 6: Verify CI/Vercel and run production collection**

Wait for the pushed commit's GitHub checks and Vercel web/API deployments. Trigger `crawl.yml` with an empty company input so `crawl-all` shares one Nexon snapshot across the 13 sources. Wait for completion and inspect the workflow summary.

- [ ] **Step 7: Verify production data and browser output**

Confirm `/api/sources` reports all 13 affiliates as collecting with recent `last_success_at`, and that affiliates with technical openings have nonzero counts. Open representative Nexon Korea, Nexon Games, and Neople postings from the production web at desktop and mobile widths; verify official logo/fallback, company attribution, official detail link, no horizontal overflow, and no console errors.

- [ ] **Step 8: Continue the remaining product backlog**

After the Nexon rollout is stable, re-audit the current open work against the existing handoff/status documents and continue with the highest-impact incomplete user-facing feature. Do not bundle unrelated backlog work into the Nexon commits.
