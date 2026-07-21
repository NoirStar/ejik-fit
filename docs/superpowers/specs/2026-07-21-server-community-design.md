# Server Community Persistence Design

## Outcome

Move real community activity from browser-only storage to authenticated Supabase
tables while preserving the current guest experience and clearly marked fixture
content. Logged-in users can publish posts, comment, react, save, follow authors,
report content, and receive community notifications across devices.

Profile-based job matching remains out of scope.

## Architecture decision

Use the existing Supabase browser/server clients directly, protected by PostgreSQL
RLS. The FastAPI service remains responsible for official hiring-market data; it
does not proxy authenticated community writes. This follows the current account
state, saved-search, notification, and profile architecture and avoids duplicating
Supabase session verification in FastAPI.

## Product states

- Guest: fixture posts remain visible, and a newly authored post stays in this
  browser so work is not lost.
- Logged in: real server posts are shown before fixtures, and new posts and
  interactions are saved to the account.
- Guest-to-account: valid browser-authored posts and their local comments are
  migrated idempotently after login. Browser data is removed only after the server
  confirms the corresponding rows.
- Unavailable server: fixture and browser-owned content remain usable with a compact
  error/retry state. No fixture metric is presented as real activity.

## Database model

### Public content

`community_posts`

- UUID primary key and `author_id` foreign key to `user_profiles.user_id`
- category, title, body, JSON tags, timestamps
- non-negative reaction, comment, and save counters maintained by triggers
- nullable `client_origin_id`, unique per author, for idempotent local migration
- public select; authenticated owner insert, bounded-field update, and delete

`community_comments`

- UUID primary key, post and author foreign keys, body, timestamps
- nullable `client_origin_id`, unique per author, for migration
- public select; authenticated owner insert, bounded-field update, and delete

Public reads expose only post/comment content, timestamps, counters, and the
already-public nickname relation. Emails never enter community tables.

### Private interaction state

- `community_post_reactions(post_id, user_id)`
- `community_post_saves(post_id, user_id)`
- `community_author_follows(follower_id, followed_id)`

Only the owner can select, insert, or delete these rows. Public aggregate counts are
stored on posts so private interaction membership is never exposed.

### Safety and moderation

`community_reports` stores one post or comment target, a bounded reason/detail,
reporter ID, status, and timestamps. Authenticated users may insert and read only
their own reports. Client roles cannot update moderation status.

Database constraints enforce the same length/category limits as the web client.
Column-level grants prevent users from writing counters, timestamps, another
author's identity, or report status. All trigger functions use `SECURITY DEFINER`
with an empty search path and have public execution revoked.

### Notifications

Extend `user_notifications.kind` to `job | community`. Database triggers create a
private community notification when another user comments on a post or follows an
author. Self-actions do not notify. Existing owner-only notification RLS remains in
force.

## Web data layer

Create a typed `CommunityStore` around a `SupabaseClient` with explicit methods for:

- public post list/detail and comment list
- current user's authored posts and interaction state
- post/comment creation and owner deletion
- reaction, save, and follow toggles
- report insertion
- idempotent browser-post migration

Rows are parsed through a strict mapper. Select lists are explicit; no community
query uses `select('*')`. Supabase errors are converted to stable Korean UI copy and
are never printed in the page.

## UI integration

- Home feed loads public server posts without blocking official job/market content.
- Composer copy and submit target change according to the authenticated viewer.
- Server post cards use real counters and `source: server`; fixture/local cards keep
  their existing transparent source labels.
- A server detail page shows actual body, author nickname, comments, account-backed
  actions, owner delete, and report controls.
- Guests see a login action for server writes with a safe `next` destination.
- `내 글` combines account posts and remaining browser posts.
- Notification center renders job and community notification kinds distinctly.

## Migration behavior

For each local post, upsert by `(author_id, client_origin_id)`, then migrate local
comments by their origin IDs. Reaction/save state for that local post is inserted
for the logged-in user when present. After all requested writes succeed, remove the
local post and its local interactions. Fixture reactions, fixture saves, and fixture
author follows remain browser-only because they do not identify real users.

## Validation and performance

- Post: title 1-80, body 1-1200, at most four unique tags of at most 40 characters.
- Comment: body 1-600.
- Feed: newest 20 server posts initially; detail comments capped at 50.
- Stable UUID keys, explicit indexes on created time and foreign keys.
- No realtime subscription in the first increment; mutations update local UI and a
  manual retry reloads failed reads. This keeps the release small and predictable.

## Verification strategy

Automated tests cover RLS/grants/triggers, strict row mapping, idempotent migration,
critical composer/action behavior, notification parsing, and one server-community
browser journey. CSS tuning and routine rendering are checked in Chromium rather
than duplicated with snapshot tests.
