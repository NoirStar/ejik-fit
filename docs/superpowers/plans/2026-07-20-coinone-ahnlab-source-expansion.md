# Coinone and AhnLab Source Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect current technical openings from Coinone and AhnLab through their official public careers systems and expose both companies, postings, and verified marks through the existing product data flow.

**Architecture:** Coinone reuses the established Ninehire connector without branching. AhnLab receives a dedicated connector-family name that shares Recruiter listing discovery, HTML detail parsing, and form transport with Kbank while applying an AhnLab-specific technical/security title filter. Both source definitions enter the single backend registry, and the frontend only adds trusted-host logo mappings.

**Tech Stack:** Python 3.12, SQLAlchemy, httpx, BeautifulSoup, pytest, Next.js, TypeScript, Vitest

## Global Constraints

- Keep the existing framework, source registry, API, and frontend identity architecture.
- Use only official public careers endpoints and official logo assets.
- Do not add Bunjang while its official live feed has no technical opening.
- Do not duplicate the company list in the frontend; `/api/sources` remains the data-policy source of truth.
- Do not hard-code live posting counts into product behavior or automated assertions.
- Add tests only at the new filtering, transport, registry, and trusted-logo boundaries.
- Preserve all unrelated user files and untracked handoff assets.

---

### Task 1: Add the AhnLab Recruiter connector family

**Files:**
- Modify: `packages/backend/src/ejikfit/connectors/public_json_detail.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Test: `packages/backend/tests/test_public_json_detail.py`
- Test: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Consumes: existing `_recruiter_legacy_refs`, `_recruiter_legacy_opening`, `is_technical_role`, and `_fetch_listing_page`
- Produces: connector family `ahnlab_recruiter_public_api_tech` with Recruiter discovery/detail parsing, AhnLab filtering, self-validation, and form-encoded POST transport

- [ ] **Step 1: Write a failing AhnLab filtering test**

Add a focused fixture to `test_public_json_detail.py` whose open rows include
`ML/MLOps`, `Web 개발`, `보안 분석`, `디지털 포렌식`, `PM`, and `인재Pool`.
Discover and filter it with:

```python
all_refs = discover_public_json_detail_refs(
    listing,
    "https://ahnlab.recruiter.co.kr/app/jobnotice/list.json",
    "ahnlab_recruiter_public_api_tech",
)
refs = filter_public_detail_refs(
    all_refs,
    "ahnlab_recruiter_public_api_tech",
)

assert [ref.title for ref in refs] == [
    "ML/MLOps",
    "Web 개발",
    "보안 분석",
    "디지털 포렌식",
]
assert public_detail_listing_is_self_validated(
    "ahnlab_recruiter_public_api_tech"
)
```

- [ ] **Step 2: Write a failing form-transport test**

Parameterize the existing legacy Recruiter form test in `test_crawler.py` so
both connector families must send `request_body` as `form_body`:

```python
@pytest.mark.parametrize(
    "connector_family",
    [
        "recruiter_legacy_public_api_tech",
        "ahnlab_recruiter_public_api_tech",
    ],
)
def test_fetch_listing_page_uses_form_body_for_recruiter_api(
    connector_family: str,
) -> None:
    source = CareerSource(
        company=Company(name="Recruiter 기업", slug="recruiter-company"),
        base_url=(
            "https://recruiter-company.recruiter.co.kr/"
            "app/jobnotice/list.json"
        ),
        source_type=SourceType.PUBLIC_JSON_DETAIL,
        connector_family=connector_family,
        request_method="POST",
        request_body={"jobnoticeStateCode": "10", "pageSize": "100"},
    )
    fetcher = RecordingFetcher('{"pageUtil":{},"list":[]}')

    page = asyncio.run(crawler._fetch_listing_page(source, fetcher, None))

    assert page.url == source.base_url
    assert fetcher.calls == [
        {
            "url": source.base_url,
            "method": "POST",
            "json_body": None,
            "form_body": {
                "jobnoticeStateCode": "10",
                "pageSize": "100",
            },
        }
    ]
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
.venv/bin/pytest \
  packages/backend/tests/test_public_json_detail.py::test_ahnlab_recruiter_filters_current_technical_and_security_roles \
  packages/backend/tests/test_crawler.py::test_fetch_listing_page_uses_form_body_for_recruiter_api \
  -q
```

Expected: both tests fail because the new family is unsupported and is still
sent as JSON.

- [ ] **Step 4: Reuse Recruiter parsing and add the AhnLab-only filter**

In `public_json_detail.py`, define:

```python
RECRUITER_LEGACY_CONNECTOR_FAMILIES = frozenset(
    {
        "recruiter_legacy_public_api_tech",
        "ahnlab_recruiter_public_api_tech",
    }
)
```

Use membership in this set for discovery, self-validation, and detail parsing.
Keep the Kbank classification allowlist unchanged. Add:

```python
if connector_family == "ahnlab_recruiter_public_api_tech":
    return [
        ref
        for ref in refs
        if "인재풀" not in ref.title
        and (
            is_technical_role(ref.title, ref.category)
            or "디지털 포렌식" in ref.title
        )
    ]
```

Import the connector-family set in `crawler.py` and use membership for
form-encoded Recruiter requests.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the command from Step 3. Expected: both tests pass.

- [ ] **Step 6: Run the connector regression tests**

Run:

```bash
.venv/bin/pytest \
  packages/backend/tests/test_public_json_detail.py \
  packages/backend/tests/test_crawler.py \
  -q
```

Expected: all tests pass.

- [ ] **Step 7: Commit the connector behavior**

```bash
git add \
  packages/backend/src/ejikfit/connectors/public_json_detail.py \
  packages/backend/src/ejikfit/crawler.py \
  packages/backend/tests/test_public_json_detail.py \
  packages/backend/tests/test_crawler.py
git commit -m "feat(crawler): support AhnLab official careers"
```

### Task 2: Register Coinone and AhnLab in the source catalog

**Files:**
- Modify: `packages/backend/src/ejikfit/seed_data.py`
- Test: `packages/backend/tests/test_seed_data.py`

**Interfaces:**
- Consumes: `SeedSource`, `SourceType.PUBLIC_JSON_DETAIL`, existing Ninehire connector, and Task 1's AhnLab connector family
- Produces: `coinone` and `ahnlab` source records that automatically flow to collection, postings, market aggregation, and `/api/sources`

- [ ] **Step 1: Write a failing source-registry test**

Add:

```python
def test_initial_sources_include_coinone_and_ahnlab_official_sources() -> None:
    sources = {item.slug: item for item in seed_data.INITIAL_SOURCE_CATALOG}

    coinone = sources["coinone"]
    assert coinone.base_url == "https://recruit.coinonecorp.com/"
    assert coinone.source_type == SourceType.PUBLIC_JSON_DETAIL
    assert coinone.connector_family == "ninehire_public_api_tech"
    assert coinone.status == SourceStatus.ALLOWED

    ahnlab = sources["ahnlab"]
    assert ahnlab.base_url == (
        "https://ahnlab.recruiter.co.kr/app/jobnotice/list.json"
    )
    assert ahnlab.source_type == SourceType.PUBLIC_JSON_DETAIL
    assert ahnlab.connector_family == "ahnlab_recruiter_public_api_tech"
    assert ahnlab.request_method == "POST"
    assert ahnlab.request_body == {
        "recruitClassSn": "",
        "recruitClassName": "",
        "jobnoticeStateCode": "10",
        "pageSize": "100",
        "searchByNameOnly": True,
        "currentPage": "1",
    }
    assert ahnlab.status == SourceStatus.ALLOWED
```

- [ ] **Step 2: Run the registry test and verify RED**

Run:

```bash
.venv/bin/pytest \
  packages/backend/tests/test_seed_data.py::test_initial_sources_include_coinone_and_ahnlab_official_sources \
  -q
```

Expected: fail with missing `coinone` and `ahnlab` keys.

- [ ] **Step 3: Add the two `SeedSource` records**

Add Coinone:

```python
SeedSource(
    name="코인원",
    slug="coinone",
    base_url="https://recruit.coinonecorp.com/",
    source_type=SourceType.PUBLIC_JSON_DETAIL,
    homepage_url="https://coinone.co.kr",
    sector="fintech",
    connector_family="ninehire_public_api_tech",
    policy_status=PolicyStatus.ALLOWED,
    brand_tier_weight=6,
    tech_job_priority=7,
    expected_job_volume=5,
    connector_reuse_score=5,
    policy_risk=0,
    non_tech_noise=9,
    notes=(
        "Official Coinone careers site and public Ninehire feed; limited "
        "to current technical roles with verified detail pages."
    ),
    status=SourceStatus.ALLOWED,
),
```

Add AhnLab:

```python
SeedSource(
    name="안랩",
    slug="ahnlab",
    base_url="https://ahnlab.recruiter.co.kr/app/jobnotice/list.json",
    source_type=SourceType.PUBLIC_JSON_DETAIL,
    homepage_url="https://www.ahnlab.com",
    sector="cybersecurity",
    connector_family="ahnlab_recruiter_public_api_tech",
    request_method="POST",
    request_body={
        "recruitClassSn": "",
        "recruitClassName": "",
        "jobnoticeStateCode": "10",
        "pageSize": "100",
        "searchByNameOnly": True,
        "currentPage": "1",
    },
    policy_status=PolicyStatus.ALLOWED,
    brand_tier_weight=6,
    tech_job_priority=7,
    expected_job_volume=7,
    connector_reuse_score=5,
    policy_risk=0,
    non_tech_noise=7,
    notes=(
        "Official AhnLab Recruiter listing and detail pages; limited to "
        "current software, ML, security, and digital-forensics roles."
    ),
    status=SourceStatus.ALLOWED,
),
```

- [ ] **Step 4: Run registry and idempotency tests**

Run:

```bash
.venv/bin/pytest \
  packages/backend/tests/test_seed_data.py::test_initial_sources_include_coinone_and_ahnlab_official_sources \
  packages/backend/tests/test_seed_data.py::test_seeding_sources_is_idempotent_and_persists_catalog_source_types \
  -q
```

Expected: both tests pass.

- [ ] **Step 5: Commit the source definitions**

```bash
git add \
  packages/backend/src/ejikfit/seed_data.py \
  packages/backend/tests/test_seed_data.py
git commit -m "feat(data): register Coinone and AhnLab sources"
```

### Task 3: Add verified Coinone and AhnLab company marks

**Files:**
- Modify: `apps/web/src/app/company-logo-assets/[logoKey]/route.ts`
- Modify: `apps/web/src/app/company-logo-assets/[logoKey]/route.test.ts`
- Modify: `apps/web/src/features/home-feed/company-identity.ts`
- Modify: `apps/web/src/features/home-feed/company-identity.test.ts`

**Interfaces:**
- Consumes: existing official-logo proxy validation and trusted-host `companyIdentity`
- Produces: `/company-logo-assets/coinone` and `/company-logo-assets/ahnlab` plus trusted company-name mappings

- [ ] **Step 1: Write failing trusted-identity tests**

Add tests proving:

```typescript
expect(
  companyIdentity(
    "코인원",
    "https://recruit.coinonecorp.com/job_posting/example",
  ),
).toMatchObject({
  kind: "logo",
  src: "/company-logo-assets/coinone",
});

expect(
  companyIdentity(
    "안랩",
    "https://ahnlab.recruiter.co.kr/app/jobnotice/view?jobnoticeSn=1",
  ),
).toMatchObject({
  kind: "logo",
  src: "/company-logo-assets/ahnlab",
});

expect(companyIdentity("안랩", "https://untrusted.example/jobs/1")).toMatchObject({
  kind: "initials",
});
```

- [ ] **Step 2: Write failing logo-proxy tests**

Add table-driven route tests asserting the requested upstream URLs are:

```typescript
[
  [
    "coinone",
    "https://image.ninehire.com/brand/b2baa5f0-1f40-11f0-8c6c-596fcda513ba/f2e49d60-2414-11f0-8c6c-596fcda513ba.png",
  ],
  [
    "ahnlab",
    "https://cloudimg.ccs.ahnlab.com/img_upload/assets/images/ko/logo-ahnlab-black2.svg",
  ],
]
```

Use a PNG signature for Coinone and a minimal safe SVG body for AhnLab.

- [ ] **Step 3: Run focused web tests and verify RED**

Run:

```bash
cd apps/web
npm test -- --run \
  src/features/home-feed/company-identity.test.ts \
  'src/app/company-logo-assets/[logoKey]/route.test.ts'
```

Expected: the new identities fall back to initials and both logo keys return
404.

- [ ] **Step 4: Add the trusted identity and proxy mappings**

Add `coinone` and `ahnlab` to `OFFICIAL_LOGO_URLS`. Add `VerifiedLogo` entries:

```typescript
{
  aliases: ["코인원", "coinone"],
  hosts: ["recruit.coinonecorp.com", "coinonecorp.com", "coinone.co.kr"],
  src: "/company-logo-assets/coinone",
  displayName: "코인원",
},
{
  aliases: ["안랩", "ahnlab"],
  hosts: ["ahnlab.recruiter.co.kr", "ahnlab.com", "www.ahnlab.com"],
  src: "/company-logo-assets/ahnlab",
  displayName: "안랩",
},
```

- [ ] **Step 5: Run focused web tests and verify GREEN**

Run the command from Step 3. Expected: all focused tests pass.

- [ ] **Step 6: Commit the company-mark support**

```bash
git add \
  'apps/web/src/app/company-logo-assets/[logoKey]/route.ts' \
  'apps/web/src/app/company-logo-assets/[logoKey]/route.test.ts' \
  apps/web/src/features/home-feed/company-identity.ts \
  apps/web/src/features/home-feed/company-identity.test.ts
git commit -m "feat(web): add Coinone and AhnLab company marks"
```

### Task 4: Verify live collection and deploy

**Files:**
- Verify: `packages/backend`
- Verify: `apps/web`
- Verify: `.github/workflows`

**Interfaces:**
- Consumes: Tasks 1–3 and existing production crawl workflow
- Produces: pushed main commits, seeded production sources, current postings, and automatically updated data-policy rows

- [ ] **Step 1: Run backend and web verification**

```bash
.venv/bin/pytest \
  packages/backend/tests/test_public_json_detail.py \
  packages/backend/tests/test_crawler.py \
  packages/backend/tests/test_seed_data.py \
  -q
cd apps/web
npm test -- --run
npm run lint
npm run build
```

Expected: every command exits 0.

- [ ] **Step 2: Run local official-source smoke checks**

Seed a disposable SQLite database or use the crawler's existing single-source
test path to collect `coinone` and `ahnlab`. Confirm the live result is a valid
snapshot, every posting URL is on the official careers host, and no
non-technical title is included. Treat current counts as observations rather
than fixed assertions.

- [ ] **Step 3: Push main and monitor CI/deploy**

```bash
git push origin main
gh run list --limit 10
```

Wait for backend CI, web CI, and Vercel deployments to finish successfully.

- [ ] **Step 4: Trigger production source synchronization and collection**

Dispatch the existing production crawl workflow using its supported
single-source input for `coinone`, then `ahnlab`, without cancelling any active
run. Confirm both source snapshots succeed.

- [ ] **Step 5: Verify production APIs and UI**

Confirm:

- `/api/sources` includes `coinone` and `ahnlab` as collecting;
- `/api/postings` returns current postings for each company;
- `/data-policy` shows both rows from the source API;
- representative company marks load with HTTP 200 and safe content types;
- official detail links open and company attribution is correct.
