# Actual-Data Company Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `/companies/[companyId]` as an evidence-first company hiring profile built only from current official posting API data, then link it from job discovery surfaces.

**Architecture:** Extend the shared posting summary contract with a stable company slug. Keep fetching and route validation in the server page, aggregate company evidence in pure feature models, render a server-only profile view, and reuse the existing verified `CompanyMark` registry with initials fallback.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, Next.js App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Use only official posting API facts; do not invent company descriptions or metrics.
- Keep the web contract compatible while backend and frontend deployments can overlap.
- Count a skill at most once per posting and preserve required/preferred/unspecified evidence.
- Use verified static logo mappings only; retain initials fallback.
- Treat API failure as unknown, never as zero.
- Keep all interactive targets at least 44px and add no fixed mobile action bar.
- Add no runtime dependency.

### Task 1: Extend the Posting Contract

**Files:**
- Modify: `packages/backend/src/ejikfit/api/schemas.py`
- Modify: `packages/backend/src/ejikfit/api/postings.py`
- Modify: `packages/backend/tests/test_postings_api.py`
- Modify: `packages/backend/tests/test_posting_list_evidence.py`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/posting-contract.ts`
- Create: `apps/web/src/lib/posting-contract.test.ts`

- [ ] Add failing API assertions for `company_slug` in list/detail/database summaries.
- [ ] Add failing web contract tests that preserve a valid optional slug and remain compatible with a missing slug.
- [ ] Return `Company.slug` from both backend summary paths.
- [ ] Normalize the optional frontend value without trusting non-strings or empty strings.
- [ ] Run focused backend and frontend tests.

### Task 2: Model Company Hiring Evidence

**Files:**
- Create: `apps/web/src/features/companies/model.ts`
- Create: `apps/web/src/features/companies/model.test.ts`

- [ ] Write failing tests for summary metrics, latest verification, skill aggregation and requirement precedence.
- [ ] Implement deterministic aggregation over validated `PostingSummary[]`.
- [ ] Keep labels factual and return empty collections for missing evidence.
- [ ] Run focused model tests.

### Task 3: Build the Company Profile Route

**Files:**
- Create: `apps/web/src/app/companies/[companyId]/page.tsx`
- Create: `apps/web/src/app/companies/[companyId]/page.test.tsx`
- Create: `apps/web/src/features/companies/company-profile.tsx`
- Create: `apps/web/src/features/companies/company-profile.test.tsx`
- Create: `apps/web/src/features/companies/company-profile.module.css`

- [ ] Write failing tests for actual-data, empty and API-error states.
- [ ] Validate the company slug and return 404 for malformed paths.
- [ ] Fetch up to 100 current postings through the existing API client.
- [ ] Render the enterprise identity, current jobs, skill evidence, distributions and trust note.
- [ ] Use official source links and existing job detail/skill-map routes.
- [ ] Add factual metadata without a second divergent data source.
- [ ] Run focused route and component tests.

### Task 4: Connect Existing Discovery Surfaces

**Files:**
- Modify: `apps/web/src/features/jobs/job-list.tsx`
- Modify: `apps/web/src/features/jobs/job-list.test.tsx`
- Modify: `apps/web/src/app/jobs/[id]/page.tsx`
- Modify: `apps/web/src/app/jobs/[id]/page.test.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.tsx`
- Modify: `apps/web/src/components/app-shell/app-shell.test.tsx`

- [ ] Link company names only when a validated slug exists.
- [ ] Keep plain text fallback for responses deployed without a slug.
- [ ] Mark global “공고” navigation active on company routes.
- [ ] Run focused integration tests.

### Task 5: Browser Coverage and Responsive Verification

**Files:**
- Modify: `apps/web/e2e/dashboard.spec.ts`
- Modify: `apps/web/e2e/fixtures/server.mjs`

- [ ] Add slugs to posting fixtures and implement the fixture company filter.
- [ ] Cover list-to-company-to-job navigation and official-source labeling.
- [ ] Assert zero horizontal overflow at 1440, 820 and 390px.
- [ ] Assert representative action targets are at least 44px.
- [ ] Visually inspect desktop and mobile screenshots.

### Task 6: Full Verification and Delivery

- [ ] Run all backend tests.
- [ ] Run all web unit tests, TypeScript and lint.
- [ ] Run all Playwright tests using the CI fixture configuration.
- [ ] Run the Vercel production build with production-required environment variables.
- [ ] Review the diff for factual integrity, accessibility and deployment ordering.
- [ ] Commit intentionally, merge into `main`, push `origin/main`, and verify the remote CI/deployment state.
