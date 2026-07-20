# Source Reliability Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover automatically blocked Nexon sources and remove unverifiable stale postings from normal search, statistics, fit analysis, and alerts without falsely closing them.

**Architecture:** Keep the existing source enums and use the existing `PostingStatus.DELAYED` state. A generic post-crawl sweep marks open postings from non-runnable sources delayed after 72 hours, ingestion reopens only jobs actually seen again, and source seeding recovers the legacy Nexon `ALLOWED/REVIEW` state so ordinary Playwright collection can run again.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, pytest, Next.js 16, React 19, TypeScript, Vitest.

## Global Constraints

- Collect only public official careers pages; do not add login, proxy, stealth, CAPTCHA solving, or access-control bypass.
- Preserve a 72-hour grace period after the last successful source collection.
- Do not classify a delayed posting as closed.
- Normal public collections, market statistics, fit analysis, skill graphs, and notifications continue to read only `PostingStatus.OPEN`.
- A delayed posting remains available through its direct detail URL with an explicit verification-delay warning.
- Add focused regression tests for state transitions and API-visible behavior; do not add pixel-level or exhaustive TDD coverage.
- Preserve unrelated tracked and untracked user files.

---

### Task 1: Recover legacy Nexon automatic-block states

**Files:**
- Modify: `packages/backend/tests/test_seed_data.py`
- Modify: `packages/backend/src/ejikfit/seed_data.py`

**Interfaces:**
- Consumes: `_apply_source_metadata(source: CareerSource, item: SeedSource) -> None`
- Produces: seed recovery for Nexon sources whose policy is `REVIEW` or `BLOCKED`, error code is `blocked`, and error reason starts with `Nexon `

- [ ] **Step 1: Extend the seed regression test with `ALLOWED/REVIEW`**

Add this case to the existing `test_seeding_reverifies_new_nexon_source_after_automatic_access_block` parameter list:

```python
(SourceStatus.ALLOWED, PolicyStatus.REVIEW, True),
```

- [ ] **Step 2: Run the focused test and verify the new case fails**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_seed_data.py::test_seeding_reverifies_new_nexon_source_after_automatic_access_block -q
```

Expected: the `ALLOWED/REVIEW` case fails because `policy_status` remains `REVIEW`.

- [ ] **Step 3: Generalize only the automatic Nexon recovery predicate**

Replace the exact paired-state predicate with:

```python
and source.status != SourceStatus.STOPPED
and source.policy_status in {PolicyStatus.BLOCKED, PolicyStatus.REVIEW}
and source.last_error_code == "blocked"
and (source.last_error_reason or "").startswith("Nexon ")
```

Keep the connector-family checks and the existing clearing of automatic error fields.

- [ ] **Step 4: Run focused seed tests**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_seed_data.py -q
```

Expected: all seed tests pass.

- [ ] **Step 5: Commit the recovery**

```bash
git add packages/backend/src/ejikfit/seed_data.py packages/backend/tests/test_seed_data.py
git commit -m "fix(crawler): recover legacy Nexon source state"
```

---

### Task 2: Delay stale postings from non-runnable sources

**Files:**
- Modify: `packages/backend/tests/test_crawler.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`

**Interfaces:**
- Produces: `delay_stale_source_postings(session: Session, now: datetime, grace_period: timedelta = SOURCE_POSTING_GRACE_PERIOD) -> int`
- Produces: `SOURCE_POSTING_GRACE_PERIOD = timedelta(hours=72)`
- Consumes: `CareerSource.is_runnable`, `CareerSource.last_success_at`, `JobPosting.status`

- [ ] **Step 1: Add focused stale-source tests**

Add `test_delay_stale_source_postings_marks_only_unverifiable_open_jobs`.
Build one runnable source, one recent non-runnable source, and one non-runnable
source last successful more than 72 hours ago. Assert:

```python
assert delay_stale_source_postings(session, now) == 1
assert stale_posting.status == PostingStatus.DELAYED
assert recent_posting.status == PostingStatus.OPEN
assert runnable_posting.status == PostingStatus.OPEN
assert closed_posting.status == PostingStatus.CLOSED
```

Add `test_delay_stale_source_postings_delays_never_verified_legacy_job`.
Create one non-runnable source with `last_success_at=None` and one open posting,
then assert the return value is `1` and the posting status is `DELAYED`.

- [ ] **Step 2: Run the two focused tests and verify import failure**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_crawler.py -k "delay_stale_source_postings" -q
```

Expected: collection fails because `delay_stale_source_postings` does not exist.

- [ ] **Step 3: Implement the set-based transition**

Implement the function with a SQLAlchemy `update(JobPosting)` joined through a subquery of non-runnable `CareerSource` IDs:

```python
SOURCE_POSTING_GRACE_PERIOD = timedelta(hours=72)


def delay_stale_source_postings(
    session: Session,
    now: datetime,
    grace_period: timedelta = SOURCE_POSTING_GRACE_PERIOD,
) -> int:
    cutoff = now - grace_period
    stale_source_ids = select(CareerSource.id).where(
        or_(
            CareerSource.status != SourceStatus.ALLOWED,
            CareerSource.policy_status != PolicyStatus.ALLOWED,
        ),
        or_(
            CareerSource.last_success_at.is_(None),
            CareerSource.last_success_at <= cutoff,
        ),
    )
    result = session.execute(
        update(JobPosting)
        .where(
            JobPosting.source_id.in_(stale_source_ids),
            JobPosting.status == PostingStatus.OPEN,
        )
        .values(status=PostingStatus.DELAYED)
    )
    session.commit()
    return int(result.rowcount or 0)
```

Import `or_`, `update`, and `timedelta` using the existing import style.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_crawler.py -k "delay_stale_source_postings" -q
```

Expected: both tests pass.

- [ ] **Step 5: Commit the delay transition**

```bash
git add packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_crawler.py
git commit -m "feat(crawler): delay stale source postings"
```

---

### Task 3: Preserve delayed state during successful reconciliation

**Files:**
- Modify: `packages/backend/tests/test_crawler.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`

**Interfaces:**
- Changes: `next_missing_state(current: int, successful_listing: bool, seen: bool, current_status: PostingStatus = PostingStatus.OPEN) -> tuple[int, PostingStatus]`
- Consumes: `reconcile_missing(...)`

- [ ] **Step 1: Add delayed reconciliation tests**

Assert the state machine behavior:

```python
assert next_missing_state(
    0,
    successful_listing=True,
    seen=False,
    current_status=PostingStatus.DELAYED,
) == (1, PostingStatus.DELAYED)
assert next_missing_state(
    2,
    successful_listing=True,
    seen=False,
    current_status=PostingStatus.DELAYED,
) == (3, PostingStatus.CLOSED)
assert next_missing_state(
    2,
    successful_listing=True,
    seen=True,
    current_status=PostingStatus.DELAYED,
) == (0, PostingStatus.OPEN)
```

- [ ] **Step 2: Run the focused state test and verify failure**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_crawler.py -k "delayed_missing_state" -q
```

Expected: failure because `next_missing_state` does not accept `current_status`.

- [ ] **Step 3: Implement delayed-state preservation**

Use this decision order:

```python
if not successful_listing:
    return current, current_status
if seen:
    return 0, PostingStatus.OPEN

updated = current + 1
if updated >= 3:
    return updated, PostingStatus.CLOSED
return (
    updated,
    PostingStatus.DELAYED
    if current_status == PostingStatus.DELAYED
    else PostingStatus.OPEN,
)
```

Pass `posting.status` from `reconcile_missing`.

- [ ] **Step 4: Run crawler tests**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_crawler.py -q
```

Expected: all crawler tests pass.

- [ ] **Step 5: Commit the reconciliation behavior**

```bash
git add packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_crawler.py
git commit -m "fix(crawler): preserve delayed jobs until verified"
```

---

### Task 4: Run the delay sweep before the market snapshot

**Files:**
- Modify: `packages/backend/tests/test_crawl_workflow.py`
- Modify: `packages/backend/tests/test_crawler.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`

**Interfaces:**
- Changes: `run_all_sources(...)` response adds `delayed: int`
- Changes: `render_crawl_summary(report)` includes the delayed total
- Produces: `_delay_run_stale_postings(now: datetime | None = None) -> int`

- [ ] **Step 1: Add orchestration assertions**

In `test_crawl_all_continues_after_one_source_failure_and_preserves_labels`,
patch `_delay_run_stale_postings` with a function that appends `"delay"` to an
`events` list and returns `3`. Make the existing fake
`_capture_run_market_snapshot` append `"snapshot"` before returning. Assert:

```python
assert report["delayed"] == 3
assert events == ["delay", "snapshot"]
assert "검증 지연 전환: 3건" in crawler.render_crawl_summary(report)
```

Patch `_delay_run_stale_postings` to return `0` in the other
`run_all_sources` tests.

- [ ] **Step 2: Run focused orchestration tests and verify failure**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_crawler.py -k "run_all_sources" -q
```

Expected: failure because the report has no `delayed` key.

- [ ] **Step 3: Integrate the sweep**

Add this helper:

```python
def _delay_run_stale_postings(now: datetime | None = None) -> int:
    with SessionLocal() as session:
        return delay_stale_source_postings(
            session,
            now or datetime.now(timezone.utc),
        )
```

After all crawl results have finished and before
`_capture_run_market_snapshot`, call `_delay_run_stale_postings()`. Include
its result as `delayed` in the returned report. Append this exact sentence
after the result table:

```python
lines.extend(["", f"검증 지연 전환: {report.get('delayed', 0)}건"])
```

- [ ] **Step 4: Run focused workflow and crawler tests**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_crawl_workflow.py packages/backend/tests/test_crawler.py -q
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit orchestration**

```bash
git add packages/backend/src/ejikfit/crawler.py packages/backend/tests/test_crawler.py packages/backend/tests/test_crawl_workflow.py
git commit -m "feat(crawler): sweep unverifiable jobs after collection"
```

---

### Task 5: Explain delayed status on job details

**Files:**
- Modify: `apps/web/src/app/jobs/[id]/page.test.tsx`
- Modify: `apps/web/src/app/jobs/[id]/page.tsx`
- Modify: `apps/web/src/app/jobs/[id]/job-detail.module.css`
- Modify: `apps/web/src/features/jobs/job-detail-view.tsx`

**Interfaces:**
- Consumes: existing `PostingDetail.status`
- Produces: a visible status message for `status === "delayed"`
- Changes: active `JobPosting` JSON-LD is emitted only for `status === "open"`

- [ ] **Step 1: Add one behavior test**

Make `getPosting` return `{ ...job, status: "delayed" }`, render the page,
and assert:

```typescript
expect(
  screen.getByText("공식 출처 확인이 지연되고 있습니다."),
).toBeInTheDocument();
expect(screen.getByText("확인 지연")).toBeInTheDocument();
expect(
  container.querySelector('script[type="application/ld+json"]'),
).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd apps/web && npm test -- --run 'src/app/jobs/[id]/page.test.tsx'
```

Expected: the delayed-source message is absent.

- [ ] **Step 3: Add the compact warning**

In `JobDetailView`, import `WarningCircle` from the existing SSR icon entry
and render this block between the hero and facts section only for delayed
postings:

```tsx
{job.status === "delayed" && (
  <aside className={styles.verificationDelay} role="status">
    <WarningCircle aria-hidden="true" size={18} weight="fill" />
    <div>
      <strong>공식 출처 확인이 지연되고 있습니다.</strong>
      <p>
        마지막 확인 이후 채용 상태가 바뀌었을 수 있으니 지원 전 공식 원문을
        확인해주세요.
      </p>
    </div>
  </aside>
)}
```

Change `statusLabel("delayed")` to return `"확인 지연"`. In the page component,
render JSON-LD only when `job.status === "open"`. Style
`.verificationDelay` with the existing `--color-warning`,
`--color-surface`, `--color-line`, and typography tokens; do not add a
gradient or strong shadow.

- [ ] **Step 4: Run focused web tests and TypeScript**

Run:

```bash
cd apps/web
npm test -- --run 'src/app/jobs/[id]/page.test.tsx'
npm run lint
```

Expected: both commands exit successfully.

- [ ] **Step 5: Commit the detail state**

```bash
git add 'apps/web/src/app/jobs/[id]/page.tsx' 'apps/web/src/app/jobs/[id]/page.test.tsx' 'apps/web/src/app/jobs/[id]/job-detail.module.css' apps/web/src/features/jobs/job-detail-view.tsx
git commit -m "feat(web): label delayed official job verification"
```

---

### Task 6: Verify, push, and exercise production recovery

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/status/2026-07-09-current-implementation-status.md`

**Interfaces:**
- Produces: documented 72-hour delayed-posting policy and current source behavior

- [ ] **Step 1: Update operational documentation**

Document:

- `DELAYED` is not a closed posting.
- Non-runnable sources receive a 72-hour grace period.
- Normal search and statistics include only `OPEN`.
- Nexon uses ordinary headed Chromium under Xvfb and automatic source-state recovery.

- [ ] **Step 2: Run focused and full verification**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_seed_data.py packages/backend/tests/test_crawler.py packages/backend/tests/test_crawl_workflow.py -q
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests -q
cd apps/web
npm test -- --run
npm run lint
npm run build
```

Expected: every command exits with zero failures.

- [ ] **Step 3: Inspect the exact diff**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~5..HEAD
```

Expected: no whitespace errors and only source-reliability files plus the protected pre-existing untracked files.

- [ ] **Step 4: Commit documentation and push main**

```bash
git add README.md docs/superpowers/status/2026-07-09-current-implementation-status.md
git commit -m "docs: explain delayed source verification"
git push origin main
```

- [ ] **Step 5: Confirm CI and source sync**

Run:

```bash
gh run list --limit 10 --json databaseId,workflowName,status,conclusion,headSha,url
```

Wait for the pushed SHA's CI and source-sync workflows to finish and require `conclusion=success`.

- [ ] **Step 6: Trigger a scoped Nexon production crawl**

Run:

```bash
gh workflow run crawl.yml -f company_slug=nexon
```

Wait for the dispatched workflow. If ordinary Chromium succeeds, verify Nexon Korea is `collecting` and its current official jobs appear. If it receives an access challenge, verify the source is reported as access-limited without bypass and that older than 72-hour jobs remain delayed.

- [ ] **Step 7: Verify production contracts**

Read:

```text
https://ejik-fit-api.vercel.app/api/sources
https://ejik-fit-api.vercel.app/api/postings?limit=1
https://ejik-fit-api.vercel.app/api/skills/stats?limit=100
```

Expected:

- source directory open count equals normal posting API total;
- all collecting sources have policy and connector status consistent with execution;
- delayed Nexon postings do not affect normal job or skill totals;
- the API health endpoint remains 200.
