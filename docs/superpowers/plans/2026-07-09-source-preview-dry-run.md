# Source Preview Dry Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-persisting source preview command so operators can fetch and parse one official career source before promoting it to scheduled crawling.

**Architecture:** Reuse crawler fetchers and connector parsing, but split source parsing into a side-effect-free helper. `preview_source` fetches the listing, parses openings, and returns count plus title/url samples without calling ingestion, writing snapshots, reconciling missing postings, or mutating source status.

**Tech Stack:** Python 3.12, argparse CLI, pytest, existing crawler connector pipeline.

## Global Constraints

- Official source expansion follows `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`.
- Preview must never save postings, snapshots, source health state, or close missing postings.
- Preview must surface unsupported connectors, blocked pages, and temporary fetch failures as explicit errors.
- Existing crawl behavior and tests stay green.
- Every production behavior change starts with a failing test.

---

## File Structure

- `packages/backend/src/ejikfit/crawler.py`: add side-effect-free parsing helpers and `preview_source_by_id`.
- `packages/backend/src/ejikfit/cli.py`: add `preview-source` command.
- `packages/backend/tests/test_crawler.py`: prove preview parses without mutation or ingestion.
- `packages/backend/tests/test_cli.py`: prove CLI prints JSON preview.

---

### Task 1: Preview Function

- [x] **Step 1: Write failing crawler preview tests**

Add tests for previewing an HTML listing source and for unsupported source types returning explicit errors without mutating source state.

- [x] **Step 2: Run crawler preview tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_crawler.py -q
```

- [x] **Step 3: Implement side-effect-free preview**

Add parser helper and `preview_source`.

- [x] **Step 4: Run crawler tests to verify green**

Run the same crawler test command.

### Task 2: CLI Command

- [x] **Step 1: Write failing CLI preview test**

Add test for `ejikfit preview-source <uuid>` JSON output.

- [x] **Step 2: Run CLI test to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_cli.py -q
```

- [x] **Step 3: Implement CLI command**

Add `preview-source` parser and dispatch.

- [x] **Step 4: Run CLI tests to verify green**

Run the same CLI test command.

---

## Self-Review

- Spec coverage: this implements safer source promotion workflow, not a new connector family.
- Placeholder scan: no open placeholders remain.
- Type consistency: preview result fields are `source_id`, `source_label`, `source_type`, `discovered`, `sample_openings`, and optional `error`.
