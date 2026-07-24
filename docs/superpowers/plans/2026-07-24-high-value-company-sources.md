# High-Value Company Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three validated official company sources—SK AX, kt cloud, and LIG Nex1—without mixing KT affiliates or admitting broad non-technical hiring.

**Architecture:** Keep source discovery declarative in `seed_data.py`, reuse the existing SK/KT enterprise JSON parser and Recruiter legacy parser, and place company-specific allow/deny rules at the existing connector-family filter boundaries. URL fragments make shared official endpoints unique in the catalog while HTTP requests continue to use the same fragment-free endpoint. Empty but schema-valid official responses remain successful collections.

**Tech Stack:** Python 3.12, SQLAlchemy 2, HTTPX, pytest, official SK Careers/KT Recruit/Recruiter public APIs

## Global Constraints

- Only official first-party recruiting endpoints are added.
- Source slugs are exactly `sk-ax`, `kt-cloud`, and `lig-nex1`.
- The existing `kt` source retains only postings whose normalized company name is `KT`; the new `kt-cloud` source retains only `kt cloud` postings.
- SK AX retains technical software, data, security, infrastructure, and engineering roles and rejects sales/facility-only roles through the shared technical-role classifier.
- kt cloud rejects construction, electrical, mechanical, BIM, and safety-management roles unless a strong software/data/security marker is also present.
- LIG Nex1 excludes talent-pool postings and admits only titles with an explicit software, AI, data, security, infrastructure, developer, or engineering marker.
- A valid empty `list` or `data` response is success; missing/wrong-shaped collections remain parser errors.
- No scraping of search engines or third-party job aggregators is introduced.
- Lotte Innovate and Korea Credit Data remain deferred until a stable, verifiable official live feed is available.

---

### Task 1: Record the official-source validation ledger

**Files:**
- Create: `docs/audits/2026-07-24-high-value-source-validation.md`

**Interfaces:**
- Records: official endpoint, request method, identity boundary, live response shape, decision, and deferral reason.

- [ ] **Step 1: Create the audit document from reproducible checks**

Document the checks performed on 2026-07-24 (Asia/Seoul):

```text
SK AX     POST https://www.skcareers.com/Recruit/GetRecruitList#sk-ax
          corpCode=10018; response keys list/success/totalCount;
          2 live rows at validation time, including one infrastructure role

kt cloud  GET  https://recruit.kt.com/api/recruit?isPost=1&isInprogress=1&isContainsContents=0#kt-cloud
          response keys data/errorMessage/isSuccess;
          4 kt cloud rows at validation time, all construction/facility work,
          therefore 0 expected technical rows

LIG Nex1  POST https://ligdna.recruiter.co.kr/app/jobnotice/list.json
          response keys list/pageUtil;
          10 live rows at validation time, including
          LIG D&A SW(AI/사이버보안) 상시채용
```

For every source, include the exact form body, official careers/homepage URL, schema evidence, and a note that counts are observations rather than permanent expectations. Record Lotte Innovate as deferred because the official careers page did not yield a stable current filtered feed, and Korea Credit Data as deferred because its official page returned an empty search state without a stable public jobs feed.

- [ ] **Step 2: Review the ledger for unsupported claims**

Check that every factual assertion is tied to an official URL and timestamp, that no current count is described as guaranteed, and that deferred candidates are not seeded.

### Task 2: Add company-specific enterprise filters for SK AX and KT

**Files:**
- Modify: `packages/backend/src/ejikfit/crawler.py`
- Modify: `packages/backend/tests/test_crawler.py`

**Interfaces:**
- Consumes: `ParsedOpening.title`, `description_text`, and connector family.
- Produces: isolated technical opening lists for `skcareers_ax_tech`, `kt_core_enterprise_json_tech`, and `kt_cloud_enterprise_json_tech`.

- [ ] **Step 1: Write failing filter tests**

Create `CareerSource` fixtures for the three connector families and mixed openings. Assert:

```python
assert [item.external_id for item in _apply_source_opening_filters(sk_ax, openings)] == [
    "ax-infra"
]
assert [item.external_id for item in _apply_source_opening_filters(kt, openings)] == [
    "kt-ai"
]
assert _apply_source_opening_filters(kt_cloud, construction_only) == []
assert [item.external_id for item in _apply_source_opening_filters(kt_cloud, mixed)] == [
    "cloud-platform"
]
```

The fixtures must include an SK AX B2B sales title, a `[KT] AI Platform Engineer`, a different KT affiliate role, a `[kt cloud] 데이터센터 시공관리` role, and a `[kt cloud] Cloud Platform Engineer` role. Include department/job-group context in `description_text` so tests match real parser output.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_crawler.py -q -k 'sk_ax or kt_core or kt_cloud'
```

Expected: FAIL because all three families currently fall through to the generic title-only technical filter.

- [ ] **Step 3: Implement normalized company identity and cloud noise rejection**

Add private helpers in `crawler.py`:

```python
def _normalized_company_label(opening: ParsedOpening) -> str:
    return "".join((opening.description_text or "").casefold().split())


def _is_kt_cloud_technical_opening(opening: ParsedOpening) -> bool:
    searchable = f"{opening.title} {opening.description_text or ''}"
    construction_markers = (
        "bim",
        "기계",
        "시공",
        "안전관리",
        "전기",
    )
    strong_software_markers = (
        "ai ",
        "backend",
        "cloud platform",
        "data ",
        "developer",
        "devops",
        "security",
        "software",
        "개발",
        "데이터",
        "보안",
        "소프트웨어",
    )
    normalized = searchable.casefold()
    if any(marker in normalized for marker in construction_markers) and not any(
        marker in normalized for marker in strong_software_markers
    ):
        return False
    return is_technical_role(searchable)
```

At the start of `_apply_source_opening_filters`, after the `targets_technical_roles` guard:

- `skcareers_ax_tech`: `is_technical_role(opening.title, opening.description_text)`.
- `kt_core_enterprise_json_tech`: normalized department contains the exact parser token `department: KT` and the title starts with `[KT]`, then apply `is_technical_role` to title plus description.
- `kt_cloud_enterprise_json_tech`: normalized department contains `department: kt cloud` and title starts with `[kt cloud]`, then apply `_is_kt_cloud_technical_opening`.

Use a small parser for the `department:` line instead of an unrestricted substring if the current static-payload description format exposes a line boundary. Keep comparison case-insensitive and whitespace-tolerant.

- [ ] **Step 4: Run focused and neighboring crawler tests**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_crawler.py -q
```

Expected: PASS with no regressions to other connector families.

- [ ] **Step 5: Commit the enterprise identity boundary**

```bash
git add packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_crawler.py
git commit -m "fix: isolate technical roles for SK AX and KT sources"
```

### Task 3: Add a title-based LIG Recruiter connector family

**Files:**
- Modify: `packages/backend/src/ejikfit/connectors/public_json_detail.py`
- Modify: `packages/backend/tests/test_public_json_detail.py`

**Interfaces:**
- Consumes: valid Recruiter legacy listing/detail payloads.
- Produces: filtered LIG Nex1 references through `lig_recruiter_public_api_tech`.

- [ ] **Step 1: Write failing listing-filter tests**

Build a complete Recruiter listing fixture with `pageUtil.currentPage=1`, `lastPage=1`, `maxRows=100`, and matching `recordCount`. Include:

```text
LIG D&A SW(AI/사이버보안) 상시채용       keep
2026 LIG D&A 상시채용 인재DB(R&D/사업/관리) drop
(구미) 소방안전관리 직무 경력 수시채용       drop
2026년 상반기 기술직 수시채용                drop
```

Assert `discover_public_json_detail_refs` accepts the family and that `filter_public_detail_refs` returns only the explicit SW/AI/security posting. Add a valid-empty fixture with an empty `list`, `recordCount=0`, and complete one-page metadata; assert it returns an empty list. Add a malformed fixture without `pageUtil`; assert it raises `ValueError`.

- [ ] **Step 2: Run the connector test and verify failure**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_public_json_detail.py -q -k lig
```

Expected: FAIL because `lig_recruiter_public_api_tech` is not a registered Recruiter legacy family.

- [ ] **Step 3: Register and filter the LIG family**

Add `lig_recruiter_public_api_tech` to `RECRUITER_LEGACY_CONNECTOR_FAMILIES`. Before the generic Recruiter classification branch in `filter_public_detail_refs`, add:

```python
if connector_family == "lig_recruiter_public_api_tech":
    return [
        ref
        for ref in refs
        if "인재db" not in ref.title.casefold()
        and is_technical_role(ref.title)
    ]
```

This retains the already-hardened Recruiter paging, identity, URL-origin, receipt-state, and detail validation. It intentionally does not use `recruitClassName` as a technical category because the LIG feed uses hiring cadence values such as `상시`, `수시`, and `공채` there.

- [ ] **Step 4: Run the complete public JSON connector suite**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_public_json_detail.py -q
```

Expected: PASS, including existing generic Recruiter and AhnLab behavior.

- [ ] **Step 5: Commit the LIG family**

```bash
git add packages/backend/src/ejikfit/connectors/public_json_detail.py packages/backend/tests/test_public_json_detail.py
git commit -m "feat: support LIG Nex1 official job feed"
```

### Task 4: Seed the three official company sources

**Files:**
- Modify: `packages/backend/src/ejikfit/seed_data.py`
- Modify: `packages/backend/tests/test_seed_data.py`
- Create: `docs/audits/2026-07-24-high-value-source-validation.md`

**Interfaces:**
- Produces: three unique `SeedSource` records and a specialized existing KT record.

- [ ] **Step 1: Write failing seed assertions**

In one focused test, build the catalog by slug and assert exact fields:

```python
assert sources["sk-ax"].connector_family == "skcareers_ax_tech"
assert sources["sk-ax"].request_body["corpCode"] == "10018"
assert sources["kt"].connector_family == "kt_core_enterprise_json_tech"
assert sources["kt-cloud"].connector_family == "kt_cloud_enterprise_json_tech"
assert sources["lig-nex1"].connector_family == "lig_recruiter_public_api_tech"
assert sources["lig-nex1"].request_method == "POST"
assert sources["lig-nex1"].request_body["pageSize"] == "100"
```

Keep the existing unique-slug and unique-base-URL assertions. Assert the SK AX and kt cloud URLs include unique fragments and all sources are `ALLOWED`.

- [ ] **Step 2: Run the seed test and verify failure**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_seed_data.py -q -k 'high_value or official_sources'
```

Expected: FAIL because the three source records and specialized KT family do not exist.

- [ ] **Step 3: Add exact source definitions**

Add SK AX beside the other SK Careers sources:

```python
SeedSource(
    name="SK AX",
    slug="sk-ax",
    base_url="https://www.skcareers.com/Recruit/GetRecruitList#sk-ax",
    source_type=SourceType.ENTERPRISE_JSON,
    homepage_url="https://www.skax.co.kr",
    sector="enterprise_ai",
    connector_family="skcareers_ax_tech",
    request_method="POST",
    request_body={
        "sort": "2",
        "searchText": "",
        "corpCode": "10018",
        "jobRole": "0",
        "recruitType": "",
        "workingType": "",
        "workingRegion": "",
    },
    policy_status=PolicyStatus.ALLOWED,
    brand_tier_weight=6,
    tech_job_priority=6,
    expected_job_volume=2,
    connector_reuse_score=5,
    policy_risk=0,
    non_tech_noise=4,
    notes="Official SK Careers feed filtered to SK inc. (AX) technical roles.",
    status=SourceStatus.ALLOWED,
)
```

Change the existing KT family to `kt_core_enterprise_json_tech`, then add kt cloud with the same base API plus `#kt-cloud`, name `kt cloud`, homepage `https://www.ktcloud.com`, sector `cloud_infrastructure`, and family `kt_cloud_enterprise_json_tech`. Use brand tier 5, technical priority 6, expected volume 2, reuse score 5, policy risk 0, and non-tech noise 5.

Add LIG Nex1 with canonical endpoint `https://ligdna.recruiter.co.kr/app/jobnotice/list.json`, homepage `https://www.lignex1.com`, sector `defense_technology`, family `lig_recruiter_public_api_tech`, brand tier 5, technical priority 6, expected volume 2, reuse score 5, policy risk 0, and non-tech noise 6. Use this exact form body:

```python
{
    "recruitClassSn": "",
    "recruitClassName": "",
    "jobnoticeStateCode": "10",
    "pageSize": "100",
    "searchByNameOnly": True,
    "currentPage": "1",
}
```

Complete the audit ledger from Task 1 in the same commit so future maintainers can distinguish additions from deliberate deferrals.

- [ ] **Step 4: Run seed and connector registration tests**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_seed_data.py tests/test_crawler.py tests/test_public_json_detail.py -q
```

Expected: PASS with unique slugs/base URLs and all three sources runnable.

- [ ] **Step 5: Commit source catalog expansion**

```bash
git add packages/backend/src/ejikfit/seed_data.py packages/backend/tests/test_seed_data.py docs/audits/2026-07-24-high-value-source-validation.md
git commit -m "feat: add three verified high-value company sources"
```

### Task 5: Verify live contracts and the complete source slice

**Files:**
- Modify only a named source or connector test file when a verification command identifies a concrete failure.

**Interfaces:**
- Produces: reproducible proof of parser compatibility and source isolation.

- [ ] **Step 1: Run the complete focused backend suite**

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_seed_data.py tests/test_crawler.py tests/test_enterprise_json_connector.py tests/test_public_json_detail.py tests/test_listing_validation.py -q
```

Expected: PASS.

- [ ] **Step 2: Repeat read-only official endpoint checks**

Use the exact requests in the audit ledger. Verify only the stable contracts:

```text
SK AX: success is true and list is an array
KT: isSuccess is true and data is an array with company identity
LIG Nex1: list is an array and pageUtil reports one complete page
```

Do not fail because current job counts changed. Save no live response body or personal data in the repository.

- [ ] **Step 3: Run catalog/database seed tests**

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_seed_data.py -q
```

Expected: PASS, including idempotent catalog synchronization and unique endpoints.

- [ ] **Step 4: Commit only verification-driven corrections**

Run `git status --short`. If a concrete failure required a source/test correction, stage exactly those printed paths and commit with `git commit -m "test: verify high-value company sources"`. If no correction was needed, do not create an empty commit.
