# Coinone and AhnLab Source Expansion Design

## Goal

Add Coinone and AhnLab to the single official-source registry so their current
technical openings are collected, shown in the product, and listed
automatically on the data-policy page.

## Scope

- Add one Coinone source backed by Coinone's public Ninehire careers feed.
- Add one AhnLab source backed by AhnLab's public Recruiter listing and detail
  pages.
- Collect only current technical roles. Do not add expired jobs, talent pools,
  product-management roles, or unrelated business roles.
- Add verified official company marks through the existing server-side logo
  proxy and company-identity registry.
- Keep the source registry as the only company list. The data-policy page must
  continue deriving its rows from `/api/sources`; no duplicate frontend list is
  introduced.
- Do not add Bunjang in this batch. Its official feed currently has open jobs
  but no technical opening, so adding it would not improve the live job data.

## Approaches Considered

### 1. Reuse the generic connectors unchanged

Coinone fits the existing Ninehire connector. AhnLab does not: its Recruiter
categories describe recruitment timing rather than job discipline, so the
existing Kbank classification allowlist would discard every AhnLab role.
Broadening that shared allowlist would also admit non-technical Kbank roles.

### 2. Create two entirely new connectors

This isolates behavior but duplicates stable Ninehire and Recruiter discovery,
pagination, detail parsing, and validation. The duplicated code would be more
expensive to maintain without improving correctness.

### 3. Reuse transport and parsing, specialize only AhnLab filtering

This is the selected approach. Coinone uses
`ninehire_public_api_tech` unchanged. AhnLab gets a distinct
`ahnlab_recruiter_public_api_tech` family that shares the existing Recruiter
listing/detail parser and form-encoded request path, but owns its role-selection
rule.

## Source Definitions

### Coinone

- Display name: `코인원`
- Slug: `coinone`
- Careers entry point: `https://recruit.coinonecorp.com/`
- Connector: `ninehire_public_api_tech`
- Sector: `fintech`
- Collection rule: the existing Ninehire active-job validation and technical
  title/category filter.
- Expected current result: five technical roles out of the live official feed.
  This is an observation for validation, not a permanently asserted count.

### AhnLab

- Display name: `안랩`
- Slug: `ahnlab`
- Listing endpoint:
  `https://ahnlab.recruiter.co.kr/app/jobnotice/list.json`
- Careers home: `https://ahnlab.recruiter.co.kr/career/home`
- Connector: `ahnlab_recruiter_public_api_tech`
- Request: form-encoded `POST`, using the existing Recruiter open-notice
  parameters with a page size of 100.
- Sector: `cybersecurity`
- Collection rule:
  - require the listing's `접수중` state;
  - exclude titles containing `인재풀`;
  - include titles recognized by `is_technical_role(title, category)`;
  - additionally include `디지털 포렌식`, which is a security-specialist role
    but is not reliably recognized by the generic title vocabulary.
- Expected current result: seven technical/security roles from the live
  official feed. This is a smoke-check expectation, not a hard-coded product
  value.

## Architecture and Data Flow

1. `INITIAL_SOURCE_CATALOG` receives the two source definitions.
2. `seed-sources` upserts them into the same database table used by all other
   companies.
3. Coinone follows the existing Ninehire bootstrap, listing pagination,
   filtering, and detail API path.
4. AhnLab posts to its Recruiter listing endpoint. Recruiter discovery and HTML
   detail parsing are reused; only the final reference filter is specific to
   AhnLab.
5. Successful snapshots flow through the existing normalization, skill
   extraction, job API, market aggregation, and data-policy source API without
   frontend fixtures or special cases.
6. The frontend identity registry maps the two trusted company names and hosts
   to whitelisted official logo-proxy keys.

## Logo Policy

- Coinone uses the mark served by Coinone's official Ninehire careers tenant.
- AhnLab uses the SVG wordmark hosted on AhnLab's official domain.
- Images are fetched only by the existing server proxy, signature/content-type
  validated, cached, and replaced by the existing initials fallback if the
  remote asset fails.
- Logo matching requires the corresponding trusted careers/company host, so a
  company name on an unrelated URL cannot claim a verified mark.

## Failure Handling

- A malformed or incomplete listing fails the source snapshot rather than
  silently closing jobs.
- A detail identity mismatch fails that detail through the existing connector
  safeguards.
- A temporary logo failure falls back to company initials and does not affect
  collection.
- Empty but valid technical results remain a successful monitored source; a
  source is not marked broken merely because it has no technical opening.

## Selective Verification

Automated coverage is limited to high-value boundaries:

- source definitions contain the correct official endpoint, connector family,
  method, and request shape;
- AhnLab's filter includes representative development, ML/MLOps, security, and
  digital-forensics titles while excluding PM, talent-pool, and non-technical
  roles;
- the AhnLab connector reuses Recruiter discovery/detail parsing and form POST;
- Coinone and AhnLab trusted URLs resolve to the intended logo keys, while an
  untrusted host falls back to initials;
- the logo proxy whitelist points to the verified official assets.

No pixel-level tests, exhaustive UI tests, or duplicate tests of the existing
Ninehire and Recruiter parsers are added. After targeted tests, run the relevant
backend and web suites, perform a live single-source crawl for each company,
then verify `/api/sources`, `/api/postings`, and the deployed data-policy page.

## Completion Criteria

- Both sources are collecting from their official public pages.
- Current technical openings are visible with correct company attribution and
  official detail links.
- The data-policy page lists both companies automatically from the source API.
- Both companies show verified marks or the existing safe initials fallback;
  no unrelated framework favicon is used.
- Backend and web checks pass, and production collection succeeds after push.
