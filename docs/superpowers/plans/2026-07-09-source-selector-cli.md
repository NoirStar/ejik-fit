# Source Selector CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow source operation CLI commands to target a career source by company slug and source type instead of requiring the UUID every time.

**Architecture:** Keep UUID positionals backward compatible and add optional selector arguments to `crawl-source`, `preview-source`, and `set-source-status`. Resolve selectors inside `ejikfit.cli` before calling crawler/status operations so the crawler API can stay UUID-based.

**Tech Stack:** Python argparse, SQLAlchemy, pytest.

## Global Constraints

- Existing UUID-based CLI calls must keep working.
- Company slug selection must be unambiguous; multiple sources require `--source-type`.
- `set-source-status` must still clear stale errors when promoting to `allowed`.
- Use TDD: write failing tests before production code.

---

### Task 1: Company Slug Source Selector

**Files:**
- Modify: `packages/backend/src/ejikfit/cli.py`
- Modify: `packages/backend/tests/test_cli.py`

**Interfaces:**
- Produces: `_resolve_source_id(session, source_id: str | None, company_slug: str | None, source_type_value: str | None) -> str`
- Produces: `crawl-source [source_id] [--company-slug SLUG] [--source-type TYPE]`
- Produces: `preview-source [source_id] [--company-slug SLUG] [--source-type TYPE]`
- Produces: `set-source-status [source_id] [status] --status STATUS [--company-slug SLUG] [--source-type TYPE]`

- [x] **Step 1: Write failing CLI tests**

Expected coverage:
- `preview-source --company-slug lg-cns --source-type static_next_data` resolves to the source UUID and calls `preview_source_by_id`.
- `crawl-source --company-slug lg-cns --source-type static_next_data` resolves to the source UUID and calls `run_source_by_id`.
- `set-source-status --company-slug lg-cns --source-type static_next_data --status allowed` updates the source and clears stale errors.
- Slug lookup without source type raises when a company has multiple sources.

- [x] **Step 2: Run CLI tests to verify red**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_cli.py -q`

Expected: FAIL because the CLI does not accept the selector arguments yet.

- [x] **Step 3: Implement resolver and argparse wiring**

Implementation requirements:
- Keep existing positional UUID calls working.
- Reject passing both positional source ID and `--company-slug`.
- Validate `--source-type` against `SourceType` values.
- Require `--status` when using slug form for `set-source-status`.

- [x] **Step 4: Run selected and full verification**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests/test_cli.py -q`

Expected: PASS.

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin packages/backend/tests -q`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-source-selector-cli.md packages/backend/src/ejikfit/cli.py packages/backend/tests/test_cli.py
git commit -m "feat: add source selector cli"
```
