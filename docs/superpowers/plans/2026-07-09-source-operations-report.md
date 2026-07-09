# Source Operations Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operational source report that shows source status distribution, connector coverage, policy state, error causes, priority, and open posting counts from the database.

**Architecture:** Create a reusable `source_report.py` module that builds JSON-safe report data from `CareerSource`, `Company`, and `JobPosting`. CLI exposes `source-report --format json|markdown`, and `crawl-all` appends the source report to `GITHUB_STEP_SUMMARY` after the crawl summary.

**Tech Stack:** Python 3.12, SQLAlchemy ORM, argparse CLI, pytest.

## Global Constraints

- Official source expansion follows `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`.
- Reports must be read-only.
- Reports must include source status distribution, policy status distribution, connector family distribution, error code counts, per-source open posting counts, and top-priority sources.
- Existing crawl, preview, and status commands stay green.
- Every production behavior change starts with a failing test.

---

## File Structure

- `packages/backend/src/ejikfit/source_report.py`: build JSON-safe source report and markdown renderer.
- `packages/backend/src/ejikfit/cli.py`: add `source-report` command and append source report to GitHub summary in `crawl-all`.
- `packages/backend/tests/test_source_report.py`: report builder and markdown tests.
- `packages/backend/tests/test_cli.py`: CLI JSON/markdown and GitHub summary tests.

---

### Task 1: Report Builder

- [x] **Step 1: Write failing source report tests**

Add tests that build a small DB with multiple source statuses, open/closed postings, error codes, and priorities, then assert JSON and markdown output.

- [x] **Step 2: Run tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_source_report.py -q
```

- [x] **Step 3: Implement source report module**

Add `build_source_report(session) -> dict[str, Any]` and `render_source_report_markdown(report) -> str`.

- [x] **Step 4: Run source report tests to verify green**

Run the same report test command.

### Task 2: CLI And GitHub Summary

- [x] **Step 1: Write failing CLI tests**

Add tests for `source-report --format json`, `source-report --format markdown`, and `crawl-all` appending the source report markdown to `GITHUB_STEP_SUMMARY`.

- [x] **Step 2: Run CLI tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_cli.py -q
```

- [x] **Step 3: Implement CLI wiring**

Add CLI parser branch and summary appending.

- [x] **Step 4: Run CLI tests to verify green**

Run the same CLI test command.

---

## Self-Review

- Spec coverage: implements the requested operational observability layer for source health; it does not add an admin UI.
- Placeholder scan: no open placeholders remain.
- Type consistency: report field names are stable across builder, renderer, and CLI.
