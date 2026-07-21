# Server Community Persistence Implementation Plan

**Goal:** Ship account-backed community posts, comments, reactions, saves, follows,
reports, notifications, and safe migration of browser-authored content.

**Architecture:** Direct Supabase data access with PostgreSQL RLS and explicit
column grants. Keep fixture content for discovery and browser storage for guests;
use strict TypeScript stores to connect authenticated UI.

## Constraints

- Do not add profile-based job matching.
- Never expose email or private interaction membership through public community
  queries.
- Keep fixtures visibly separate from real user content.
- Do not delete local content before every corresponding server write succeeds.
- Test only security/data boundaries and critical user flows.
- Do not stage protected handoff files or the root `package-lock.json`.

### Task 1: Database contract and notification kind

- [ ] Add focused migration security and SQLAlchemy model tests.
- [ ] Add community models without PostgreSQL-only SQLAlchemy types.
- [ ] Create migration `20260721_0021_server_community.py` with tables, indexes,
  validation, column grants, RLS, counter triggers, and notification triggers.
- [ ] Extend `user_notifications.kind` to `job | community`.
- [ ] Verify focused backend tests and offline SQL; commit and push.

### Task 2: Typed Supabase community store

- [ ] Add strict public post/comment and private viewer-state row mappers.
- [ ] Implement explicit-list/get/create/delete/toggle/report store methods.
- [ ] Add focused tests for mapper rejection, owner scoping, and private columns.
- [ ] Commit and push.

### Task 3: Guest-to-account migration and feed composer

- [ ] Implement idempotent local post/comment migration with remove-after-success.
- [ ] Add a viewer-aware community hook with loading/error/retry states.
- [ ] Put server posts before fixtures while preserving guest local posts.
- [ ] Submit to Supabase when logged in and local storage when logged out.
- [ ] Add only focused migration/composer tests; inspect desktop/mobile Chromium.
- [ ] Commit and push.

### Task 4: Server detail and account-backed interactions

- [ ] Route UUID post IDs to a real server detail page with safe metadata.
- [ ] Connect comments, reactions, saves, follows, owner deletion, and reporting.
- [ ] Require login for server writes and preserve the detail `next` path.
- [ ] Merge server and browser posts in `내 글`.
- [ ] Add focused detail/action tests and one responsive E2E.
- [ ] Commit and push.

### Task 5: Community notifications and privacy copy

- [ ] Parse/render `community` notifications without weakening job notifications.
- [ ] Update account export and privacy copy for server community fields.
- [ ] Remove obsolete statements that all community activity is browser-only.
- [ ] Verify focused notification/trust tests; commit and push.

### Task 6: Production verification

- [ ] Run proportional backend/web tests, lint, production build, and community E2E.
- [ ] Apply migration through the push-triggered crawler workflow.
- [ ] Verify public/private RLS probes and authenticated UI states without creating
  disposable public content.
- [ ] Verify CI and Vercel, restore generated `next-env.d.ts`, and leave a clean
  intended working tree.
