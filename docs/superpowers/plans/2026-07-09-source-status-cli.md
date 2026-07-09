# Source Status CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small operational CLI command to promote or demote a career source after previewing it.

**Architecture:** Keep status updates in the backend CLI layer. `set-source-status <source_id> <status>` updates `CareerSource.status`, optionally updates `policy_status`, clears stale errors when a source is promoted to `allowed`, commits the change, and prints a JSON summary.

**Tech Stack:** Python 3.12, argparse CLI, SQLAlchemy ORM, pytest.

## Global Constraints

- Official source expansion follows `docs/superpowers/specs/2026-07-09-official-company-source-expansion-design.md`.
- Status changes must be explicit operator actions.
- Promoting to `allowed` clears stale source error metadata.
- The command must return machine-readable JSON.
- Existing crawl and preview behavior stays green.
- Every production behavior change starts with a failing test.

---

## File Structure

- `packages/backend/src/ejikfit/cli.py`: add `set-source-status` parser and implementation helper.
- `packages/backend/tests/test_cli.py`: prove status promotion and policy-status override behavior.

---

### Task 1: Source Status Update CLI

- [x] **Step 1: Write failing CLI tests**

Add tests for promoting a source to `allowed`, clearing stale errors, and optionally setting `policy_status`.

- [x] **Step 2: Run CLI tests to verify red**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /root/work/ejik-fit/.venv/bin/pytest -p pytest_asyncio.plugin \
  packages/backend/tests/test_cli.py -q
```

- [x] **Step 3: Implement command**

Add `set-source-status <source_id> <status> [--policy-status <policy_status>]`, enum parsing, DB update, and JSON output.

- [x] **Step 4: Run CLI tests to verify green**

Run the same CLI test command.

---

## Self-Review

- Spec coverage: implements the operator path needed after preview; it does not auto-promote sources.
- Placeholder scan: no open placeholders remain.
- Type consistency: uses `SourceStatus.value` and `PolicyStatus.value` for CLI input/output.
