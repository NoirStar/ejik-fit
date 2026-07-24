# Home Community SSR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the real public community first page in the home server response so hydration never inserts it above jobs afterward.

**Architecture:** A server-only loader converts the Supabase store result into a serializable discriminated state. `Home` loads it in the existing `Promise.all`, `HomeFeed` passes it to `useCommunityFeed`, and the hook consumes that page once while loading only viewer membership after authentication.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase SSR, Testing Library, Vitest

## Global Constraints

- The server and first client render use the exact same community post array and cursor.
- Public community data, postings, market data, graph data, and fit data load in parallel.
- A ready initial public page must not trigger an immediate duplicate `listPostPage` request.
- A signed-in viewer may load membership after hydration without changing post order.
- A community failure must not remove successfully loaded jobs or market data.
- No sample community activity may be inserted into the live feed.

---

### Task 1: Define and load the serializable initial state

**Files:**
- Create: `apps/web/src/features/community/community-feed-initial.ts`
- Create: `apps/web/src/features/community/server-community-feed.ts`
- Test: `apps/web/src/features/community/server-community-feed.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient()` and `CommunityStore.listPostPage({ limit })`.
- Produces: `InitialCommunityFeed = { status: "ready"; page: CommunityPage<CommunityPost> } | { status: "error"; error: string }` and `loadInitialCommunityFeed(limit?: number): Promise<InitialCommunityFeed>`.

- [ ] **Step 1: Write failing loader tests**

Mock the server client and store factory, then assert both branches:

```ts
expect(await loadInitialCommunityFeed()).toEqual({
  status: "ready",
  page: { items: [post], nextCursor: null },
});
expect(store.listPostPage).toHaveBeenCalledWith({ limit: 20 });

store.listPostPage.mockRejectedValueOnce(new Error("offline"));
expect(await loadInitialCommunityFeed()).toEqual({
  status: "error",
  error: COMMUNITY_FAILURE_COPY.load,
});
```

- [ ] **Step 2: Run the new test and verify the modules do not exist**

Run: `npm test -- --run src/features/community/server-community-feed.test.ts`

Expected: FAIL with module resolution errors.

- [ ] **Step 3: Add the shared type and server loader**

Create `community-feed-initial.ts`:

```ts
import type { CommunityPage, CommunityPost } from "@/lib/community-contract";

export type InitialCommunityFeed =
  | { status: "ready"; page: CommunityPage<CommunityPost> }
  | { status: "error"; error: string };
```

Create `server-community-feed.ts`:

```ts
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  COMMUNITY_FAILURE_COPY,
  communityFailureMessage,
  createSupabaseCommunityStore,
} from "./community-store";
import type { InitialCommunityFeed } from "./community-feed-initial";

export async function loadInitialCommunityFeed(
  limit = 20,
): Promise<InitialCommunityFeed> {
  const client = await createServerSupabaseClient();
  if (!client) {
    return { status: "error", error: COMMUNITY_FAILURE_COPY.load };
  }
  try {
    const page = await createSupabaseCommunityStore(client).listPostPage({ limit });
    return { status: "ready", page };
  } catch (error) {
    console.error("[community] server feed request failed", error);
    return {
      status: "error",
      error: communityFailureMessage(error, COMMUNITY_FAILURE_COPY.load),
    };
  }
}
```

- [ ] **Step 4: Run loader tests**

Run: `npm test -- --run src/features/community/server-community-feed.test.ts`

Expected: PASS for ready, unavailable-client, and safe-error branches.

- [ ] **Step 5: Commit the server boundary**

```bash
git add apps/web/src/features/community/community-feed-initial.ts apps/web/src/features/community/server-community-feed.ts apps/web/src/features/community/server-community-feed.test.ts
git commit -m "feat: load the public community feed on the server"
```

### Task 2: Hydrate the hook without refetching public posts

**Files:**
- Modify: `apps/web/src/features/community/use-community-feed.ts`
- Test: `apps/web/src/features/community/use-community-feed.test.tsx`

**Interfaces:**
- Consumes: optional `initialFeed?: InitialCommunityFeed` in `UseCommunityFeedOptions`.
- Produces: ready/error first state, one-time public-page consumption, membership-only hydration for a signed-in viewer.

- [ ] **Step 1: Write failing hook tests**

Use a ready initial page and assert the synchronous state and post request suppression:

```tsx
const { result } = renderHook(() => useCommunityFeed({
  authReady: true,
  initialFeed: { status: "ready", page: { items: [post()], nextCursor: null } },
  store,
  viewer: null,
}));
expect(result.current.state.status).toBe("ready");
expect(result.current.state.posts).toEqual([post()]);
await waitFor(() => expect(store.listPostPage).not.toHaveBeenCalled());
```

Repeat with a viewer and assert `loadViewerState` is called once for the initial IDs while `listPostPage` remains uncalled. Add an error initial state test that stays visible until `reload()` and then calls `listPostPage`.

- [ ] **Step 2: Run the hook tests and verify the new option fails**

Run: `npm test -- --run src/features/community/use-community-feed.test.tsx`

Expected: FAIL because `initialFeed` is unknown and initial posts are empty.

- [ ] **Step 3: Initialize state and consume the initial public page once**

Add a pure initializer:

```ts
function stateFromInitial(initialFeed?: InitialCommunityFeed): CommunityFeedState {
  if (!initialFeed) return INITIAL_STATE;
  if (initialFeed.status === "error") {
    return { ...INITIAL_STATE, status: "error", error: initialFeed.error };
  }
  return {
    ...INITIAL_STATE,
    status: "ready",
    posts: initialFeed.page.items,
    nextCursor: initialFeed.page.nextCursor,
  };
}
```

Initialize the hook with `useState(() => stateFromInitial(initialFeed))`, retain the initial value in a ref, and in `load(false)` use it only for the unscoped public feed. When authenticated, call only:

```ts
const viewerState = activeViewerId
  ? await resolvedStore.loadViewerState(activeViewerId, {
      postIds: page.items.map((post) => post.id),
      authorIds: page.items.map((post) => post.author.id),
    })
  : EMPTY_VIEWER_STATE;
```

Consume the ref before awaiting so effect reruns cannot duplicate the operation. Preserve the initial state while `authReady` is false. A manual `reload()` bypasses the consumed initial value and performs the normal list request.

- [ ] **Step 4: Run all community hook tests**

Run: `npm test -- --run src/features/community/use-community-feed.test.tsx`

Expected: PASS, including existing following/saved scope, pagination, stale request, and mutations.

- [ ] **Step 5: Commit hydration behavior**

```bash
git add apps/web/src/features/community/use-community-feed.ts apps/web/src/features/community/use-community-feed.test.tsx
git commit -m "fix: hydrate community posts without a duplicate request"
```

### Task 3: Wire the server page into HomeFeed

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/page.test.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.tsx`
- Modify: `apps/web/src/features/home-feed/home-feed.test.tsx`

**Interfaces:**
- Consumes: `loadInitialCommunityFeed()` in `Home`, `initialCommunityFeed: InitialCommunityFeed` in `HomeFeedProps`.
- Produces: community article markup in the server-rendered `Home` tree before job and market cards.

- [ ] **Step 1: Write failing page and HomeFeed tests**

Mock `loadInitialCommunityFeed` to return one real post, render `await Home()`, and assert its article precedes the job article:

```ts
const articles = screen.getAllByRole("article");
expect(articles[0]).toHaveAccessibleName("서버 첫 HTML 글");
expect(articles.findIndex((article) => article.getAttribute("aria-labelledby")?.includes("job")))
  .toBeGreaterThan(0);
expect(loadInitialCommunityFeed).toHaveBeenCalledTimes(1);
```

In `home-feed.test.tsx`, pass the ready initial state with an injected store and assert the post is present immediately and `store.listPostPage` is never called.

- [ ] **Step 2: Run the focused tests and verify missing props fail**

Run: `npm test -- --run src/app/page.test.tsx src/features/home-feed/home-feed.test.tsx`

Expected: FAIL because `Home` does not load or pass community data.

- [ ] **Step 3: Load in parallel and pass through**

Extend the existing array:

```ts
const [postings, skillStats, graph, fit, initialCommunityFeed] = await Promise.all([
  postingsRequest,
  skillStatsRequest,
  graphRequest,
  fitRequest,
  loadInitialCommunityFeed(),
]);
```

Add `initialCommunityFeed` to `HomeFeedProps` and pass it unchanged to:

```ts
useCommunityFeed({
  authReady,
  followingOnly: activeTab === "following",
  initialFeed: initialCommunityFeed,
  store: communityStore,
  viewer,
});
```

- [ ] **Step 4: Run page, feed, hook, and type checks**

Run: `npm test -- --run src/app/page.test.tsx src/features/home-feed/home-feed.test.tsx src/features/community/use-community-feed.test.tsx`

Run: `npm run lint`

Expected: all tests PASS and TypeScript exits with code 0.

- [ ] **Step 5: Commit the home integration**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/page.test.tsx apps/web/src/features/home-feed/home-feed.tsx apps/web/src/features/home-feed/home-feed.test.tsx
git commit -m "feat: render community posts in the initial home feed"
```
