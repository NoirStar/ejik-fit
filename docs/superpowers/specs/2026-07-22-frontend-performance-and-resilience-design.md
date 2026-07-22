# Frontend Performance and Resilience Design

## Goal

Improve cold-load speed, navigation efficiency, and public-data resilience without changing the product's visual hierarchy or weakening freshness for account-specific data.

This is the first of three performance phases:

1. Optimize cold delivery and the public read path.
2. Audit authentication-shell hydration and add production Web Vitals reporting.
3. Profile production-like database queries and load-test backend endpoints.

Only phase 1 is included in this design.

## Baseline

Measurements were taken from the current production build with the local deterministic API fixture and fresh Chromium contexts.

| Route | Total transfer | JavaScript | Font | Resource requests | Automatic RSC prefetches |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 2,439 KB | 284 KB | 2,010 KB | 75 | 50 |
| `/market` | 2,459 KB | 332 KB | 2,010 KB | 77 | 55 |
| `/skills/graph` | 2,429 KB | 322 KB | 2,010 KB | 51 | not separately budgeted |
| `/jobs` | 2,395 KB | 261 KB | 2,010 KB | 51 | not separately budgeted |

The `/market` client bundle contains a 78 KB gzip chunk dominated by technology brand icon path data. Public API reads currently use `cache: "no-store"`, so every render reaches the API even though production collection runs on a much slower cadence.

The official Pretendard 1.3.9 variable dynamic subset was tested against the actual rendered page text. Font-file transfer fell from 2,010 KB to 337 KB on `/` and 180 KB on `/market`; the subset stylesheet transferred approximately 12 KB. Representative Korean and English strings at weights 400 and 700 had identical measured widths between the monolithic and subset fonts.

## Success Criteria

All budgets use a fresh Chromium context against a production build and the deterministic API fixture.

- Preserve the current Pretendard family, typography weights, and page layout.
- Keep cold font transfer at or below 450 KB on `/` and `/market`, including the subset stylesheet.
- Reduce `/market` cold JavaScript transfer to at most 275 KB.
- Limit automatic RSC prefetch requests after initial load to at most 15 on `/` and `/market`.
- Keep primary navigation client-side and immediately usable.
- Cache public GET data for no longer than 60 seconds unless the endpoint is explicitly classified as durable.
- Never cache personalized POST requests or authenticated browser data.
- Fail a stalled upstream request within 8 seconds and render the existing partial or error state instead of blocking the full page indefinitely.
- Pass all existing unit, type, build, and end-to-end checks.

## Approach

### 1. Self-host the Pretendard variable dynamic subset

Replace the monolithic `PretendardVariable.woff2` face with the pinned Pretendard 1.3.9 variable dynamic-subset stylesheet and its 92 WOFF2 slices. Store both the stylesheet and slices under `apps/web/public/fonts/pretendard/` so rendering does not depend on a third-party CDN.

Keep the public family name `"Pretendard Variable"`, existing fallback stack, weight range, and `font-display: swap`. Remove the unused monolithic font after the subset is verified. Preserve `OFL.txt` and update the font source record.

The browser will request only the Unicode ranges needed by the current page. Extra requests are acceptable because the measured transfer reduction is substantially larger, files are immutable, and production HTTP/2 can fetch them concurrently.

### 2. Apply intent-aware prefetching

Keep automatic prefetching for the five global navigation destinations because they represent high-probability actions and make the main product transitions immediate.

Disable viewport prefetching for repeated or low-probability links:

- community post titles, tags, comment links, company links, and job cards;
- market filter chips, technology-to-jobs links, and evidence lists;
- job result titles, company links, skill links, and pagination links;
- secondary policy and methodology links.

Use ordinary Next.js `Link` navigation with `prefetch={false}` for these links. This preserves client-side transitions, keyboard behavior, and accessible anchors while preventing dozens of speculative RSC requests. Do not create a custom hover-prefetch abstraction in this phase; that adds state and maintenance for limited measured benefit.

### 3. Move technology brand paths out of the client bundle

Replace runtime `simple-icons` path imports in `TechnologyIcon` with a small name-to-asset registry containing only asset keys and brand colors. Copy the corresponding pinned SVG files to `apps/web/public/technology-logos/simple-icons/` and render them as CSS masks so existing brand colors remain visible.

The initial market view renders eight rows, so it downloads only the eight requested SVG assets instead of parsing every supported icon path in JavaScript. Expanding the list may request more immutable SVGs on demand. Concept and category fallbacks continue to use the existing Phosphor icons.

Retain the `simple-icons` development dependency only if a deterministic asset-sync verification script needs it. Runtime client code must not import the package.

### 4. Classify API request freshness and timeouts

Refactor the internal API request helper around explicit request policies:

- `public`: GET requests for postings, posting detail, hiring overview, skill statistics, skill graph, and skill trends; use `next.revalidate: 60`.
- `durable`: GET requests for the skill catalog and source directory; use `next.revalidate: 300`.
- `private`: personalized or mutating requests such as fit analysis; use `cache: "no-store"`.

All policies use an 8-second timeout. A caller-provided abort signal remains authoritative and is combined with the timeout signal when supported. HTTP failures remain `ApiError`; timeouts use a distinct `ApiTimeoutError` so logs identify the actual cause without exposing details to the user.

Current server pages already use settled resource states. A failed resource therefore degrades only its section while other successful resources continue rendering. No stale account or user-specific response may enter the server data cache.

### 5. Make performance budgets repeatable

Add a production-browser performance check that records resource entries after a cold load. It must assert:

- font transfer budget on `/` and `/market`;
- JavaScript transfer budget on `/market`;
- automatic RSC-prefetch budget on `/` and `/market`;
- successful font loading and unchanged primary navigation behavior.

Add focused unit tests for request policy selection, timeout classification, icon asset mapping, and no-prefetch behavior on repeated lists. Existing route-level E2E tests remain the source of truth for product behavior and responsive layout.

## Data Flow

1. A browser requests a product route.
2. The Next.js server renders the route and calls the typed API helper.
3. Public reads use the URL-keyed 60-second data cache; durable reads use the 300-second cache; private POSTs bypass it.
4. If the upstream does not settle within 8 seconds, the request rejects with a timeout classification.
5. `settledResource` converts that failure into the route's existing partial or error state while independent requests remain visible.
6. The browser receives server-rendered content, only the required font Unicode slices, and route-specific client JavaScript.
7. Only global navigation is prefetched on viewport entry; repeated content links fetch their destination when activated.

## Error Handling

- Missing subset assets fail through the existing system-font fallback and are caught by the production resource-budget test.
- A technology without a mapped brand asset uses the existing neutral category icon. A registry verification test fails when a mapped SVG file is absent, preventing a broken asset reference from shipping.
- Non-2xx API responses preserve their status in `ApiError`.
- Timeouts are logged distinctly and converted to existing Korean partial-state copy.
- Cache configuration is explicit per API function; the generic helper must not infer privacy from the HTTP method alone.
- No retry loop is added in this phase because retries can multiply load during an outage. Cached public reads and manual page retry remain the recovery paths.

## Testing Strategy

Implementation follows red-green-refactor cycles:

1. Add failing typography and production-transfer budget checks, then introduce the self-hosted subset.
2. Add failing RSC-request-count checks, then apply `prefetch={false}` to repeated links.
3. Add a failing client-bundle budget and icon fallback tests, then move brand paths to static assets.
4. Add failing API policy and timeout tests, then refactor the request helper.
5. Run focused tests after each change, followed by the full frontend unit suite, typecheck, production build, and all relevant E2E scenarios.

## Non-goals

- No visual redesign, copy rewrite, or navigation hierarchy change.
- No system-font replacement.
- No caching of account, notification, saved-search, or community mutation data.
- No React Compiler rollout in this phase.
- No database index or SQL query changes without production-like query evidence.
- No speculative retry framework or service worker.

## Rollout and Reversal

Each optimization is an independent commit so it can be reverted separately. Performance checks compare a production build against fixed budgets before the branch is integrated. If a font slice, icon asset, or cache policy causes a functional regression, revert that commit while retaining the other verified improvements.
