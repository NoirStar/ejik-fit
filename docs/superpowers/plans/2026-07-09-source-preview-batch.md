# Source Preview Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `preview-sources` CLI command that batches non-mutating source previews for live smoke checks before promoting sources to `allowed`.

**Architecture:** Reuse existing source selectors and `preview_source_by_id`. The CLI selects `CareerSource` rows by optional status/source type filters, orders by priority and company name, previews each source sequentially, and prints one JSON report.

**Tech Stack:** Python 3.12, argparse, SQLAlchemy, pytest.

## Global Constraints

- Preview must not mutate source status, postings, snapshots, or missing-run counters.
- Batch preview is an operator tool for smoke checks, not a scheduled crawler path.
- Do not bypass CAPTCHA, login, Cloudflare challenge, or access control.
- Keep output machine-readable JSON by default.

---

### Task 1: CLI Contract Tests

**Files:**
- Modify: `packages/backend/tests/test_cli.py`

**Interfaces:**
- Consumes: `ejikfit.crawler.preview_source_by_id(source_id: str) -> dict`
- Produces: `ejikfit preview-sources [--status STATUS] [--source-type TYPE] [--limit N]`

- [ ] **Step 1: Write failing test**

Add a test that inserts multiple sources, monkeypatches `preview_source_by_id`, runs:

```bash
ejikfit preview-sources --status needs_connector --source-type static_next_data --limit 1
```

Expected JSON:

```json
{
  "sources": 1,
  "results": [
    {
      "source_id": "00000000-0000-0000-0000-000000000021",
      "source_label": "LG CNS / static_next_data",
      "source_type": "static_next_data",
      "discovered": 1,
      "sample_openings": [],
      "error": null
    }
  ]
}
```

- [ ] **Step 2: Run test to verify RED**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_cli.py::test_preview_sources_filters_targets_and_prints_json_report -q`

Expected: FAIL because the command does not exist.

### Task 2: CLI Implementation

**Files:**
- Modify: `packages/backend/src/ejikfit/cli.py`

**Interfaces:**
- Produces: `_preview_source_targets(session, status_value, source_type_value, limit) -> list[str]`
- Produces: `_preview_sources(status_value, source_type_value, limit) -> dict`

- [ ] **Step 1: Add parser**

Add `preview-sources` with `--status`, `--source-type`, and `--limit`.

- [ ] **Step 2: Add target selector**

Select sources joined with company, filter by status/source type when provided, order by priority descending then company name and base URL, and apply limit when provided.

- [ ] **Step 3: Add command handler**

Call `preview_source_by_id` for each selected source id and print:

```python
{"sources": len(results), "results": results}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_cli.py -q`

Expected: PASS.

### Task 3: Verification And Commit

- [ ] **Step 1: Run full backend tests**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests -q`

Expected: all tests pass.

- [ ] **Step 2: Check whitespace**

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-07-09-source-preview-batch.md packages/backend/src/ejikfit/cli.py packages/backend/tests/test_cli.py
git commit -m "feat: add batch source preview cli"
```
