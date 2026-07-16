# Nexon Group Playwright Collection Design

## Goal

Collect the public technical-role postings exposed by Nexon Company's integrated
careers site, attribute each posting to its actual affiliate, and keep the
existing official-source and safe-closing guarantees.

## Verified source behavior

As of 2026-07-16, direct HTTP and ordinary headless Chromium receive a
Cloudflare `403` challenge before the careers application can request its job
data. Unmodified Playwright Chromium running in headed mode on an X virtual
display receives `200` responses without a proxy, stealth patch, login, CAPTCHA
solver, or persisted user session.

The public careers application requests:

- `POST https://career-gateway.nexon.com/career/v1/open/job-posts`
- `GET https://career-gateway.nexon.com/career/v1/open/corps`

The job response contains full description HTML and a pagination object. The
verified response contained 145 open postings and 13 recruiting affiliates.
Because the listing already contains the complete description, the collector
must not make one detail request per posting.

## Scope and policy

- Use stock Playwright Chromium in headed mode under Xvfb.
- Never use CloakBrowser, fingerprint patches, residential proxies, CAPTCHA
  solving, login state, or Cloudflare challenge manipulation.
- Navigate only the public `/` and `/recruit` pages. Do not crawl the
  robots-disallowed `/recruit?…` query form.
- Fetch subsequent pages through the same public API call made by the loaded
  application, with a short delay and a maximum of 50 pages.
- Collect only roles classified as technical by the existing project role
  classifier.
- Preserve the exact official detail URL
  `https://careers.nexon.com/recruit/{jobPostNo}`.
- Attribute postings to the affiliate returned by the official API rather than
  presenting all affiliates as Nexon Korea.

## Affiliate registry

The source catalog will contain one company and one logical career source for
each recruiting affiliate returned by the verified corporation endpoint:

| Code | Company | Slug |
| --- | --- | --- |
| `NX` | 넥슨코리아 | `nexon` |
| `NO` | 네오플 | `neople` |
| `AG` | 넥슨게임즈 | `nexon-games` |
| `HQ` | 넥슨에이치큐 | `nexon-hq` |
| `DV` | 데브캣 | `devcat` |
| `MR` | 민트로켓 | `mintrocket` |
| `UV` | 넥슨유니버스 | `nexon-universe` |
| `SD` | 넥슨네트웍스 | `nexon-networks` |
| `NU` | 넥슨커뮤니케이션즈 | `nexon-communications` |
| `MD` | 엔미디어플랫폼 | `nmedia-platform` |
| `DQ` | 딜로퀘스트 | `diloquest` |
| `SE` | 넥슨스페이스 | `nexon-space` |
| `XC` | 엔엑스씨 | `nxc` |

The sources use the shared official `/recruit` URL with a fragment containing
the corporation code. URL fragments are not transmitted to Nexon; they only
give the existing globally unique `base_url` registry a stable logical key, as
already done for shared Samsung Careers sources. Each source stores its
corporation code and verified corporation name in `request_body`.

The existing `nexon` source is migrated from the careers root URL to the `NX`
logical source so its history remains attached to Nexon Korea. The other 12
companies are added idempotently by the existing seed process.

## Components

### Pure Nexon connector

Add `ejikfit.connectors.nexon` with focused pure functions that:

- build the official list request body;
- validate page, size, total, job IDs, affiliate names, and required fields;
- combine pages only when their totals remain stable and every ID is unique;
- select rows for one registered affiliate;
- map each row to `ParsedOpening`, including title, full HTML/text,
  employment type, career type, work area, opening date, and closing date.

The connector rejects unknown affiliate names instead of silently assigning
them to Nexon Korea. Adding a new official affiliate therefore requires an
explicit registry update.

### Headed browser snapshot

Extend the existing Playwright renderer with a Nexon-specific snapshot method.
The method launches stock Chromium with `headless=False`, Korean locale, Seoul
timezone, and a normal desktop viewport. It loads the careers root, navigates to
`/recruit`, captures the first official list response, and retrieves remaining
pages from within that same browser page.

The renderer caches either the complete validated snapshot or its failure for
the lifetime of one `crawl-all` provider group. The 13 affiliate sources share
that renderer instance, so a scheduled run opens one browser session and reads
the listing once. A standalone `crawl-source --company-slug …` command still
works by opening one session for that selected source.

### Existing crawler integration

Register the sources as `browser_public_render` with connector family
`nexon_group_browser_api_tech`. The crawler routes this family through the new
snapshot method, filters the shared snapshot by the source's corporation code,
then reuses normal `ParsedOpening` ingestion, revision, skill extraction, and
three-missing-run closing behavior.

Nexon targets receive a shared provider key so `crawl-all` serializes them and
passes one renderer instance across the group. Other browser sources retain
their current headless public-render behavior.

### Runtime

The scheduled GitHub Actions crawler starts an Xvfb display after Playwright and
Chromium dependencies are installed. Only the Nexon snapshot launches headed;
ordinary HTTP and existing browser sources keep their current behavior.

### Company identity

Map the 13 slugs to official logo assets served by Nexon Careers through the
existing server-side company-logo proxy. Record each official URL in the asset
source documentation. A failed or changed image continues to use the existing
deterministic initials fallback.

## Failure and closing safety

The snapshot is incomplete and must not be ingested when any of the following
occurs:

- root or API response is `401`, `403`, `429`, or another failure status;
- an access challenge is displayed;
- pagination total changes during the run;
- a page is empty before the declared total is reached;
- a job ID is absent or repeated;
- the combined row count differs from the declared total;
- a row names an affiliate absent from the registry.

On snapshot failure, every affected source records a collection error and its
existing postings remain unchanged. An individual affiliate with a verified
zero-row subset is a successful empty listing and follows the existing
three-consecutive-missing-run rule.

## Targeted verification

Testing is limited to behavior that could corrupt or misattribute production
data:

1. Connector tests cover page validation, duplicate/incomplete rejection,
   affiliate partitioning, and `ParsedOpening` mapping.
2. Crawler tests prove all Nexon sources reuse one complete browser snapshot and
   retain existing postings when the snapshot fails.
3. Seed tests prove the 13 unique company/source mappings and migration of the
   legacy Nexon source.
4. Workflow tests prove an X display is available for scheduled and manually
   selected crawler runs.
5. Company identity tests cover official logo routing and initials fallback.
6. A production smoke run confirms Nexon sources have recent successful
   collection timestamps, nonzero technical postings where applicable, working
   official detail links, and no web console errors.

No broad UI TDD or unrelated regression suite is added for this connector.
