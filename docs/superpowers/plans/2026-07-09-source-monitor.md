# Source Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operational source monitor that reports recent source activity, stale/failing sources, connector-family health, and technical-job coverage.

**Architecture:** Keep the existing `source_report` as a current-state registry snapshot and add `source_monitor` for time-windowed operational health. Expose the monitor through a `source-monitor` CLI command and append its markdown to `crawl-all` GitHub summaries.

**Tech Stack:** Python, SQLAlchemy ORM, pytest.

## Global Constraints

- Do not mutate source, posting, or revision data while building reports.
- Default monitoring window is 24 hours.
- Treat naive datetimes from SQLite tests as UTC for comparisons.
- Keep source-report output backward compatible.
- Use TDD: write failing tests before production code.

---

### Task 1: Source Monitor Report And CLI

**Files:**
- Create: `packages/backend/src/ejikfit/source_monitor.py`
- Modify: `packages/backend/src/ejikfit/cli.py`
- Create: `packages/backend/tests/test_source_monitor.py`
- Modify: `packages/backend/tests/test_cli.py`

**Interfaces:**
- Produces: `build_source_monitor_report(session: Session, now: datetime | None = None, window_hours: int = 24) -> dict[str, Any]`
- Produces: `render_source_monitor_markdown(report: dict[str, Any]) -> str`
- Produces: `source-monitor --hours HOURS --format json|markdown`
- Updates: `crawl-all` GitHub summary appends monitor markdown after the existing source report.

- [x] **Step 1: Write failing source monitor tests**

Expected coverage:
- Counts sources, allowed sources, open postings, new postings, recently seen postings, recently changed postings, recently closed postings.
- Classifies healthy, stale, failing, blocked, and pending sources.
- Computes connector-family health.
- Computes tech job ratio from open postings with extracted skills.
- Renders markdown with key operational tables.

- [x] **Step 2: Write failing CLI tests**

Expected coverage:
- `source-monitor --hours 12` prints JSON.
- `source-monitor --format markdown` prints markdown.
- `crawl-all` GitHub summary includes the source monitor markdown.

- [x] **Step 3: Run tests to verify red**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_source_monitor.py packages/backend/tests/test_cli.py -q`

Expected: FAIL because `source_monitor` and the CLI command are missing.

- [x] **Step 4: Implement monitor and CLI**

Implementation requirements:
- Use Python-side datetime comparison helpers so SQLite timezone behavior does not make tests flaky.
- Count `changed_postings` by distinct `JobRevision.posting_id` in the window.
- Count `closed_postings` by `PostingStatus.CLOSED` and `last_verified_at` in the window.
- `health_status` order: `blocked`, `failing`, `healthy`, `stale`, `pending`.
- Add `source-monitor` parser options: `--hours` integer default `24`, `--format json|markdown` default `json`.
- Append monitor markdown in `crawl-all` only when `GITHUB_STEP_SUMMARY` is set.

- [x] **Step 5: Run selected and full verification**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_source_monitor.py packages/backend/tests/test_cli.py -q`

Expected: PASS.

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -q`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-source-monitor.md packages/backend/src/ejikfit/source_monitor.py packages/backend/src/ejikfit/cli.py packages/backend/tests/test_source_monitor.py packages/backend/tests/test_cli.py
git commit -m "feat: add source monitor report"
```
