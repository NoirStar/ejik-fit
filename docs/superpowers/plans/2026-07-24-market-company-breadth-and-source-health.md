# Market Company Breadth and Source Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show how widely each skill is requested across companies and distinguish active, legitimately quiet, stale, and not-yet-connected company sources.

**Architecture:** `GET /api/skills/stats` adds a distinct-company aggregate beside the existing posting aggregates without changing existing fields. The market model defaults to company breadth while retaining explicit-demand bars and raw posting counts. The source directory adds a derived, safe `activity_status` based on runnable state, last success, and open-posting count; frontend source surfaces share one copy mapping.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, React 19, Next.js 16, TypeScript, Vitest, Testing Library

## Global Constraints

- `count` remains raw distinct posting count for backward compatibility.
- `company_count` is distinct `JobPosting.company_id` under the same open/confidence/career/category filters.
- Market default sort is company breadth; ties use explicit demand, posting count, then name.
- Every market row says `요구 기업 N곳 · 공고 M건`.
- Weekly charts remain posting-based and explicitly say `공고 기준`.
- `collection_status` remains the source connector/runnable contract.
- `activity_status` is one of `active`, `quiet`, `attention`, `preparing`.
- `quiet` is neutral, not an error state.
- Staleness threshold is exactly 48 hours.
- Internal error text is never exposed by the public source API.

---

### Task 1: Add distinct-company counts to skill statistics

**Files:**
- Modify: `packages/backend/src/ejikfit/api/skills.py`
- Modify: `packages/backend/src/ejikfit/api/schemas.py`
- Modify: `packages/backend/tests/test_skills_api.py`

**Interfaces:**
- Produces: `SkillStat.company_count: int` in `GET /api/skills/stats`.

- [ ] **Step 1: Write failing database and API tests**

Create two companies where one has two Python postings and the other has one. Assert:

```python
python = next(item for item in response.json()["items"] if item["skill"] == "Python")
assert python["count"] == 3
assert python["company_count"] == 2
```

Add a filtered assertion showing `career_type=experienced` changes both values under the same scope. Update fake-reader responses to include `company_count`.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_skills_api.py -q
```

Expected: FAIL because the response schema and SQL query do not contain `company_count`.

- [ ] **Step 3: Add the distinct-company aggregate**

In `DatabaseSkillStatsReader.stats`, define:

```python
company_count = func.count(func.distinct(JobPosting.company_id))
```

Select it beside `count_expr`, return it from every row, and add:

```python
company_count: int
```

to the skill-stat response model. Keep `_apply_scope` as the single place for open, confidence, career, and category filters.

- [ ] **Step 4: Run skill API tests**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_skills_api.py -q
```

Expected: PASS for unfiltered, career-filtered, and category-filtered aggregates.

- [ ] **Step 5: Commit the aggregate contract**

```bash
git add packages/backend/src/ejikfit/api/skills.py packages/backend/src/ejikfit/api/schemas.py packages/backend/tests/test_skills_api.py
git commit -m "feat: count skill demand across companies"
```

### Task 2: Make company breadth the market's primary ranking

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/features/market/model.ts`
- Modify: `apps/web/src/features/market/model.test.ts`
- Modify: `apps/web/src/features/market/market-filters.tsx`
- Modify: `apps/web/src/features/market/market-overview.tsx`
- Modify: `apps/web/src/features/market/technology-demand-chart.tsx`
- Modify: `apps/web/src/features/market/technology-demand-chart.test.tsx`
- Modify: `apps/web/src/features/market/market-overview.test.tsx`
- Modify: `apps/web/src/features/market/market-overview.module.css`

**Interfaces:**
- Consumes: `SkillStatsItem.company_count`.
- Produces: `MarketSkill.companyCount`, `relativeCompanyBreadth`, and `MarketSort = "companies" | "explicit" | "demand" | "required" | "preferred" | "name"`.

- [ ] **Step 1: Write failing market-model tests**

Use Python with 20 postings from 2 companies and AWS with 12 postings from 8 companies. Assert:

```ts
expect(sortMarketSkills(snapshot.skills, "companies").map(({ name }) => name))
  .toEqual(["AWS", "Python"]);
expect(snapshot.skills.find(({ name }) => name === "AWS")).toMatchObject({
  companyCount: 8,
  postingCount: 12,
  relativeCompanyBreadth: 100,
});
```

Add a tie test that resolves by explicit count, posting count, then English-locale name. Update every typed fixture with `company_count`.

- [ ] **Step 2: Run model tests and verify failure**

Run:

```bash
cd apps/web
npm test -- --run src/features/market/model.test.ts
```

Expected: FAIL because the new field/sort does not exist.

- [ ] **Step 3: Implement the model contract and stable sort**

Add:

```ts
export type MarketSort =
  | "companies"
  | "explicit"
  | "demand"
  | "required"
  | "preferred"
  | "name";
```

Compute `maxCompanyCount`, map `companyCount: item.company_count ?? 0`, and compute `relativeCompanyBreadth` using the same safe 1-denominator pattern as explicit demand. Implement the company comparator:

```ts
right.companyCount - left.companyCount ||
right.explicitCount - left.explicitCount ||
right.postingCount - left.postingCount ||
compareName(left, right)
```

- [ ] **Step 4: Write failing UI tests for the default ranking and copy**

Assert the initial select value is `companies`, the first row is AWS, and the row contains `요구 기업 8곳` and `공고 12건`. Assert the trend panel contains `주간 변화 · 공고 기준`.

- [ ] **Step 5: Implement market UI hierarchy**

Initialize sort with:

```ts
const [sort, setSort] = useState<MarketSort>("companies");
```

Put `{ value: "companies", label: "요구 기업 많은 순" }` first in `SORT_OPTIONS`. Rename the main panel title to `시장 기술 확산`, use subtitle `요구한 기업 수를 먼저 보고, 필수·우대 공고 규모를 함께 비교합니다.`, and render:

```tsx
<span className={styles.breadthCount}>
  <strong>요구 기업 {skill.companyCount.toLocaleString("ko-KR")}곳</strong>
  <small>공고 {skill.postingCount.toLocaleString("ko-KR")}건</small>
</span>
```

Keep `ExplicitDemandBar` as the third column so requirement strength remains visible. Update column headers and mobile stacking without adding a second chart.

- [ ] **Step 6: Run market tests and lint**

Run:

```bash
cd apps/web
npm test -- --run src/features/market/model.test.ts src/features/market/technology-demand-chart.test.tsx src/features/market/market-overview.test.tsx
npm run lint
```

Expected: PASS; company breadth is the default, raw posting evidence remains visible, and weekly change says it is posting-based.

- [ ] **Step 7: Commit the market ranking**

```bash
git add apps/web/src/lib/types.ts apps/web/src/features/market/model.ts apps/web/src/features/market/model.test.ts apps/web/src/features/market/market-filters.tsx apps/web/src/features/market/market-overview.tsx apps/web/src/features/market/technology-demand-chart.tsx apps/web/src/features/market/technology-demand-chart.test.tsx apps/web/src/features/market/market-overview.test.tsx apps/web/src/features/market/market-overview.module.css
git commit -m "feat: rank market skills by company breadth"
```

### Task 3: Derive safe public source activity states

**Files:**
- Modify: `packages/backend/src/ejikfit/api/sources.py`
- Modify: `packages/backend/src/ejikfit/api/schemas.py`
- Modify: `packages/backend/tests/test_sources_api.py`

**Interfaces:**
- Produces: `SourceDirectoryItem.activity_status`.

- [ ] **Step 1: Write failing activity-state tests**

Use a fixed `now = datetime(2026, 7, 24, 3, 0, tzinfo=timezone.utc)` and assert:

```python
assert source_activity_status(
    collection_status="collecting",
    open_postings=4,
    last_success_at=now - timedelta(hours=2),
    now=now,
) == "active"
assert source_activity_status(
    collection_status="collecting",
    open_postings=0,
    last_success_at=now - timedelta(hours=2),
    now=now,
) == "quiet"
assert source_activity_status(
    collection_status="collecting",
    open_postings=0,
    last_success_at=now - timedelta(hours=49),
    now=now,
) == "attention"
assert source_activity_status(
    collection_status="preparing",
    open_postings=0,
    last_success_at=None,
    now=now,
) == "preparing"
```

Update the safe-public-fields test to prove `last_error_reason` remains absent while `activity_status` is present.

- [ ] **Step 2: Run source API tests and verify failure**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_sources_api.py -q
```

Expected: FAIL because the derivation and response field do not exist.

- [ ] **Step 3: Implement timezone-safe 48-hour derivation**

Add:

```python
SOURCE_ACTIVITY_FRESHNESS = timedelta(hours=48)

def source_activity_status(
    *,
    collection_status: str,
    open_postings: int,
    last_success_at: datetime | None,
    now: datetime,
) -> str:
    if collection_status == "preparing":
        return "preparing"
    if last_success_at is None:
        return "attention"
    comparable = (
        last_success_at.replace(tzinfo=timezone.utc)
        if last_success_at.tzinfo is None
        else last_success_at.astimezone(timezone.utc)
    )
    if now.astimezone(timezone.utc) - comparable > SOURCE_ACTIVITY_FRESHNESS:
        return "attention"
    return "active" if open_postings > 0 else "quiet"
```

Compute `now` once per `list()` call and apply the status after company-level source aggregation. Add the literal field to `SourceDirectoryItem`.

- [ ] **Step 4: Run source API tests**

Run:

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_sources_api.py -q
```

Expected: PASS for active, quiet, attention, preparing, naive SQLite datetimes, and safe response fields.

- [ ] **Step 5: Commit the public health contract**

```bash
git add packages/backend/src/ejikfit/api/sources.py packages/backend/src/ejikfit/api/schemas.py packages/backend/tests/test_sources_api.py
git commit -m "feat: distinguish quiet and stale company sources"
```

### Task 4: Present activity states consistently across company surfaces

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/source-status.ts`
- Create: `apps/web/src/lib/source-status.test.ts`
- Modify: `apps/web/src/features/sources/source-directory.tsx`
- Modify: `apps/web/src/app/trust-pages.module.css`
- Modify: `apps/web/src/features/companies/followed-companies.tsx`
- Modify: `apps/web/src/features/companies/company-profile.tsx`
- Modify: `apps/web/src/app/trust-pages.test.tsx`
- Modify: `apps/web/src/app/companies/[companyId]/page.test.tsx`

**Interfaces:**
- Consumes: `activity_status`.
- Produces: `getSourceActivityCopy(status)` used by source directory, followed companies, and company empty state.

- [ ] **Step 1: Write failing copy and component tests**

Assert exact mapping:

```ts
expect(getSourceActivityCopy("active").label).toBe("공고 수집 정상");
expect(getSourceActivityCopy("quiet").label).toBe("현재 공개 공고 없음");
expect(getSourceActivityCopy("attention").label).toBe("수집 상태 점검 필요");
expect(getSourceActivityCopy("preparing").label).toBe("연결 준비");
```

In the source directory fixture include all four states and assert four separate, honest status labels. Assert `quiet` does not use `role="alert"`, while `attention` provides `수집 상태 점검 필요` without exposing backend error text.

- [ ] **Step 2: Run frontend source tests and verify failure**

Run:

```bash
cd apps/web
npm test -- --run src/lib/source-status.test.ts src/app/trust-pages.test.tsx src/app/companies/\[companyId\]/page.test.tsx
```

Expected: FAIL because types/copy/components only understand collecting/preparing.

- [ ] **Step 3: Implement shared copy and activity filters**

Add the type:

```ts
activity_status: "active" | "quiet" | "attention" | "preparing";
```

Add shared copy with neutral detail for quiet and corrective detail for attention. Change source-directory filters to `전체`, `공고 수집 정상`, `공개 공고 없음`, `점검 필요`, `연결 준비`. Group and count by `activity_status`, while leaving `collection_status` available for preparation-reason copy.

`FollowedCompanyRow` uses the shared label/detail. The company empty state says `최근 정상 확인 결과 공개 공고가 없습니다.` only for `quiet`; it says `최근 수집 상태를 점검 중이므로 0건으로 단정하지 않습니다.` for `attention`.

- [ ] **Step 4: Add restrained status styles**

Use existing status tokens. Active receives the existing positive tone, quiet uses neutral muted surface, attention uses warm status colors, and preparing retains its current preparation tone. Do not add red error treatment to quiet.

- [ ] **Step 5: Run frontend tests and lint**

Run:

```bash
cd apps/web
npm test -- --run src/lib/source-status.test.ts src/app/trust-pages.test.tsx src/app/companies/\[companyId\]/page.test.tsx
npm run lint
```

Expected: PASS with all four statuses and no unsafe internal error details.

- [ ] **Step 6: Commit source-state UI**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/source-status.ts apps/web/src/lib/source-status.test.ts apps/web/src/features/sources/source-directory.tsx apps/web/src/app/trust-pages.module.css apps/web/src/features/companies/followed-companies.tsx apps/web/src/features/companies/company-profile.tsx apps/web/src/app/trust-pages.test.tsx apps/web/src/app/companies/\[companyId\]/page.test.tsx
git commit -m "feat: explain company collection activity"
```

### Task 5: Verify the market and source-health slice

**Files:**
- Modify only a named source, market, or test file when a verification command identifies a concrete failure.

**Interfaces:**
- Produces: backwards-compatible API responses and a buildable market/source UI.

- [ ] **Step 1: Run backend market/source tests**

```bash
cd packages/backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest tests/test_skills_api.py tests/test_sources_api.py -q
```

Expected: PASS.

- [ ] **Step 2: Run market/source frontend tests**

```bash
cd apps/web
npm test -- --run src/features/market src/lib/source-status.test.ts src/app/trust-pages.test.tsx src/app/companies/\[companyId\]/page.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full typecheck and production build**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: TypeScript and Next.js build exit with code 0.

- [ ] **Step 4: Check response compatibility manually**

Use TestClient or a local API and verify every old field remains while the new fields are present:

```text
/api/skills/stats: count + required_count + preferred_count + unspecified_count + company_count
/api/sources: collection_status + preparation_reason + open_postings + last_success_at + activity_status
```

- [ ] **Step 5: Commit only if verification required a correction**

Run `git status --short`. If it is non-empty, stage the exact files listed by that command and commit with `git commit -m "test: verify market breadth and source health"`. If it is empty, do not create an empty commit.
