# Browser Renderer Operational Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the optional browser renderer installable and available in the production crawler workflow when operators promote public-rendered sources.

**Architecture:** Add a `browser` optional dependency group to the backend package, update the production crawl workflow to install that extra and Chromium, and document local/remote enablement steps. Keep default backend and CI installs lightweight.

**Tech Stack:** Python 3.12 packaging metadata, GitHub Actions, Playwright Chromium runtime, pytest file-contract tests.

## Global Constraints

- Browser rendering remains limited to public JavaScript-rendered pages.
- Do not add CAPTCHA solving, login handling, access-control bypass, session spoofing, or stealth behavior.
- Keep `packages/backend[dev]` as the default test install; `packages/backend[browser]` is opt-in except for the production crawler workflow.
- Source promotion stays explicit through `set-source-status`.

---

### Task 1: Metadata And Workflow Contract Tests

**Files:**
- Create: `packages/backend/tests/test_backend_metadata.py`
- Modify: `packages/backend/tests/test_crawl_workflow.py`

**Interfaces:**
- Consumes: `packages/backend/pyproject.toml`
- Consumes: `.github/workflows/crawl.yml`
- Produces: test coverage for the `browser` optional dependency and crawler workflow browser setup.

- [ ] **Step 1: Write failing metadata test**

```python
import tomllib
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def test_backend_browser_extra_declares_playwright_runtime_dependency() -> None:
    pyproject = tomllib.loads(
        (REPOSITORY_ROOT / "packages" / "backend" / "pyproject.toml").read_text()
    )

    browser_deps = pyproject["project"]["optional-dependencies"]["browser"]

    assert any(dependency.startswith("playwright>=") for dependency in browser_deps)
```

- [ ] **Step 2: Update workflow test with browser setup expectations**

Add assertions that the workflow installs `./packages/backend[browser]` and runs `python -m playwright install --with-deps chromium`.

- [ ] **Step 3: Run tests to verify RED**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_backend_metadata.py packages/backend/tests/test_crawl_workflow.py -q`

Expected: FAIL because the `browser` extra and workflow setup do not exist.

### Task 2: Browser Install Surface

**Files:**
- Modify: `packages/backend/pyproject.toml`
- Modify: `.github/workflows/crawl.yml`
- Modify: `README.md`
- Modify: `docs/deployment/access-and-auth.md`
- Modify: `docs/deployment/vercel.md`

**Interfaces:**
- Produces: `pip install './packages/backend[browser]'`
- Produces: workflow Chromium install before `ejikfit crawl-all`

- [ ] **Step 1: Add backend browser extra**

Add:

```toml
browser = [
  "playwright>=1.45,<2",
]
```

- [ ] **Step 2: Update crawl workflow**

Change production crawler install from:

```yaml
- run: pip install ./packages/backend
```

to:

```yaml
- run: pip install './packages/backend[browser]'
- run: python -m playwright install --with-deps chromium
```

- [ ] **Step 3: Document local and production enablement**

Document local install, Chromium installation, preview, explicit source promotion, and the no-bypass policy.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest packages/backend/tests/test_backend_metadata.py packages/backend/tests/test_crawl_workflow.py -q`

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
git add docs/superpowers/plans/2026-07-09-browser-renderer-operational-readiness.md packages/backend/tests/test_backend_metadata.py packages/backend/tests/test_crawl_workflow.py packages/backend/pyproject.toml .github/workflows/crawl.yml README.md docs/deployment/access-and-auth.md docs/deployment/vercel.md
git commit -m "chore: prepare browser renderer runtime"
```
