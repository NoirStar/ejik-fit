# Skill Catalog and Official Source Expansion Implementation Plan

**Goal:** Expand verified technology demand coverage, automatically re-analyze existing postings after catalog changes, and add Bear Robotics and Atlassian through public official sources.

**Architecture:** Keep the existing contextual extraction engine and source registry. Add only manually reviewed skills with risk-aware aliases, trigger the existing backfill command on catalog deployments, and introduce small source-specific parsers for Breezy HTML/JSON-LD and Atlassian JSON.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, BeautifulSoup, pytest, GitHub Actions, Next.js 16.

## Constraints

- Preserve unrelated tracked and untracked files.
- Use focused tests for extraction, connector parsing, seed metadata, and workflow behavior.
- Use official public pages only; no login, stealth, proxy, CAPTCHA solving, or access-control bypass.
- Do not add a company unless a current domestic technical role can be verified.
- Push only after the cohesive change passes backend tests and the web production build.

### Task 1: Expand the reviewed technology catalog

**Files:**
- Modify: `packages/backend/tests/test_skill_catalog.py`
- Modify: `packages/backend/tests/test_skill_extraction.py`
- Modify: `packages/backend/src/ejikfit/skill_catalog.py`

- [ ] Add expected canonical names, categories, kinds, and domains to focused tests.
- [ ] Add positive and negative golden cases for new contextual aliases.
- [ ] Verify the focused tests fail.
- [ ] Add the reviewed skills and metadata.
- [ ] Run skill catalog and extraction tests.

### Task 2: Backfill skills when extraction code is deployed

**Files:**
- Modify: `packages/backend/tests/test_crawl_workflow.py`
- Modify: `.github/workflows/crawl.yml`

- [ ] Assert the workflow watches the catalog/extractor and invokes `backfill-skills` on push.
- [ ] Verify the workflow test fails.
- [ ] Add push paths and a push-only backfill step.
- [ ] Run the workflow contract test.

### Task 3: Add a reusable Breezy public connector

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/breezy.py`
- Create: `packages/backend/tests/test_breezy_connector.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`

- [ ] Add minimal representative listing and detail fixtures inline in connector tests.
- [ ] Assert domestic technical listing rows are kept and other rows are rejected.
- [ ] Assert JSON-LD detail preserves HTML, location, employment type, and external ID.
- [ ] Verify tests fail before implementation.
- [ ] Implement parser functions and crawler listing/detail routing.
- [ ] Add a crawler integration test for detail fetching.

### Task 4: Add the Atlassian official careers connector

**Files:**
- Create: `packages/backend/src/ejikfit/connectors/atlassian.py`
- Create: `packages/backend/tests/test_atlassian_connector.py`
- Modify: `packages/backend/src/ejikfit/crawler.py`

- [ ] Test Korean technical filtering, non-Korean/non-technical rejection, URL mapping, and HTML preservation.
- [ ] Verify the tests fail before implementation.
- [ ] Implement the official root-array parser and crawler routing.
- [ ] Treat a valid root array as a complete listing after source-specific parsing.

### Task 5: Register verified company sources

**Files:**
- Modify: `packages/backend/tests/test_seed_data.py`
- Modify: `packages/backend/src/ejikfit/seed_data.py`

- [ ] Add failing source metadata assertions for Bear Robotics and Atlassian.
- [ ] Register both official sources as allowed with accurate notes and priorities.
- [ ] Run seed and connector tests.

### Task 6: Verify, commit, and deploy

- [ ] Run formatter/lint checks provided by the repository.
- [ ] Run the complete backend test suite.
- [ ] Run frontend tests, TypeScript check, and production build.
- [ ] Preview both live official sources without writing production data.
- [ ] Review `git diff` and preserve unrelated files.
- [ ] Commit the cohesive implementation and push `main`.
- [ ] Check the resulting GitHub/Vercel build state when available.

### Task 7: Continue the next completion item

- [ ] Add a catalog API and accessible skill autocomplete so account/career inputs use canonical skills while retaining a controlled custom-value fallback.
- [ ] Follow with account onboarding/email verification polish and remaining server-backed guest-state migration, excluding profile-based job matching as requested.
