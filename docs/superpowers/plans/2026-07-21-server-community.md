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

- [x] Add focused migration security and SQLAlchemy model tests.
- [x] Add community models without PostgreSQL-only SQLAlchemy types.
- [x] Create migration `20260721_0021_server_community.py` with tables, indexes,
  validation, column grants, RLS, counter triggers, and notification triggers.
- [x] Extend `user_notifications.kind` to `job | community`.
- [x] Verify focused backend tests and offline SQL; commit and push.

### Task 2: Typed Supabase community store

- [x] Add strict public post/comment and private viewer-state row mappers.
- [x] Implement explicit-list/get/create/delete/toggle/report store methods.
- [x] Add focused tests for mapper rejection, owner scoping, and private columns.
- [x] Commit and push.

### Task 3: Guest-to-account migration and feed composer

- [x] Implement idempotent local post/comment migration with remove-after-success.
- [x] Add a viewer-aware community hook with loading/error/retry states.
- [x] Put server posts before fixtures while preserving guest local posts.
- [x] Submit to Supabase when logged in and local storage when logged out.
- [x] Add only focused migration/composer tests; inspect desktop/mobile Chromium.
- [x] Commit and push.

### Task 4: Server detail and account-backed interactions

- [x] Route UUID post IDs to a real server detail page with safe metadata.
- [x] Connect comments, reactions, saves, follows, owner deletion, and reporting.
- [x] Require login for server writes and preserve the detail `next` path.
- [x] Merge server and browser posts in `내 글`.
- [x] Add focused detail/action tests and one responsive E2E.
- [x] Commit and push.

### Task 5: Community notifications and privacy copy

- [x] Parse/render `community` notifications without weakening job notifications.
- [x] Update account export and privacy copy for server community fields.
- [x] Remove obsolete statements that all community activity is browser-only.
- [x] Verify focused notification/trust tests; commit and push.

### Task 6: Production verification

- [x] Run proportional backend/web tests, lint, production build, and community E2E.
- [x] Apply migration through the push-triggered crawler workflow.
- [x] Verify public/private RLS probes and authenticated UI states without creating
  disposable public content.
- [x] Verify CI and Vercel, restore generated `next-env.d.ts`, and leave a clean
  intended working tree.
