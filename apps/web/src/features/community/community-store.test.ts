import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { CommunityStoreError } from "@/lib/community-contract";

import { createSupabaseCommunityStore } from "./community-store";

const AUTHOR_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER_ID = "22222222-2222-4222-8222-222222222222";
const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const postRow = {
  id: POST_ID,
  author_id: AUTHOR_ID,
  category: "커리어 질문",
  title: "서버 커뮤니티 질문",
  body: "실제 계정에 저장되는 질문 본문입니다.",
  tags: ["Python"],
  reaction_count: 0,
  comment_count: 0,
  save_count: 0,
  created_at: "2026-07-21T01:02:03.000Z",
  updated_at: "2026-07-21T01:02:03.000Z",
  author: { user_id: AUTHOR_ID, nickname: "작성자" },
};

type QueryResult = { data?: unknown; error?: unknown };

function createQuery(result: QueryResult = { data: null, error: null }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const query: Record<string, ReturnType<typeof vi.fn>> & {
    then?: Promise<QueryResult>["then"];
  } = {};
  for (const method of [
    "delete",
    "eq",
    "in",
    "insert",
    "limit",
    "order",
    "select",
    "upsert",
  ]) {
    query[method] = vi.fn(() => query);
  }
  query.single = vi.fn().mockResolvedValue(resolved);
  query.maybeSingle = vi.fn().mockResolvedValue(resolved);
  query.then = (onFulfilled, onRejected) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected);
  return query;
}

function createClient(
  queries: Record<string, ReturnType<typeof createQuery>>,
) {
  const from = vi.fn((table: string) => {
    const query = queries[table];
    if (!query) throw new Error(`missing query for ${table}`);
    return query;
  });
  return {
    client: { from } as unknown as SupabaseClient,
    from,
  };
}

describe("Supabase community store", () => {
  it("lists bounded public fields without selecting migration metadata", async () => {
    const posts = createQuery({ data: [postRow], error: null });
    const query = createClient({ community_posts: posts });
    const store = createSupabaseCommunityStore(query.client);

    await expect(
      store.listPosts({ authorId: AUTHOR_ID, limit: 999 }),
    ).resolves.toHaveLength(1);

    const selected = posts.select.mock.calls[0]?.[0] as string;
    expect(selected).toContain("author:user_profiles(user_id,nickname)");
    expect(selected).not.toContain("client_origin_id");
    expect(selected).not.toContain("*");
    expect(posts.eq).toHaveBeenCalledWith("author_id", AUTHOR_ID);
    expect(posts.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(posts.limit).toHaveBeenCalledWith(50);
  });

  it("loads viewer-owned saved posts in save order without exposing other memberships", async () => {
    const saves = createQuery({
      data: [{ post_id: POST_ID, user_id: VIEWER_ID }],
      error: null,
    });
    const posts = createQuery({ data: [postRow], error: null });
    const store = createSupabaseCommunityStore(
      createClient({
        community_post_saves: saves,
        community_posts: posts,
      }).client,
    );

    await expect(store.listSavedPosts(VIEWER_ID, 999)).resolves.toEqual([
      expect.objectContaining({ id: POST_ID }),
    ]);

    expect(saves.select).toHaveBeenCalledWith("post_id,user_id");
    expect(saves.eq).toHaveBeenCalledWith("user_id", VIEWER_ID);
    expect(saves.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(saves.limit).toHaveBeenCalledWith(50);
    expect(posts.in).toHaveBeenCalledWith("id", [POST_ID]);
    expect(posts.select.mock.calls[0]?.[0]).not.toContain("client_origin_id");
  });

  it("creates posts with writable fields only", async () => {
    const posts = createQuery({ data: postRow, error: null });
    const query = createClient({ community_posts: posts });
    const store = createSupabaseCommunityStore(query.client);

    await store.createPost(AUTHOR_ID, {
      id: POST_ID,
      category: "커리어 질문",
      title: "  서버 커뮤니티 질문  ",
      body: "  실제 계정에 저장되는 질문 본문입니다.  ",
      tags: [" Python "],
      clientOriginId: "local-post-1",
    });

    expect(posts.insert).toHaveBeenCalledWith({
      id: POST_ID,
      author_id: AUTHOR_ID,
      category: "커리어 질문",
      title: "서버 커뮤니티 질문",
      body: "실제 계정에 저장되는 질문 본문입니다.",
      tags: ["Python"],
      client_origin_id: "local-post-1",
    });
    const inserted = posts.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted).not.toHaveProperty("reaction_count");
    expect(inserted).not.toHaveProperty("created_at");
    expect(inserted).not.toHaveProperty("updated_at");
  });

  it("gets one comment by its explicit public id", async () => {
    const comments = createQuery({
      data: {
        id: COMMENT_ID,
        post_id: POST_ID,
        author_id: VIEWER_ID,
        body: "계정에 저장된 댓글입니다.",
        created_at: "2026-07-21T03:04:05.000Z",
        updated_at: "2026-07-21T03:04:05.000Z",
        author: { user_id: VIEWER_ID, nickname: "댓글러" },
      },
      error: null,
    });
    const store = createSupabaseCommunityStore(
      createClient({ community_comments: comments }).client,
    );

    await expect(store.getComment(COMMENT_ID)).resolves.toMatchObject({
      id: COMMENT_ID,
      postId: POST_ID,
      author: { id: VIEWER_ID },
    });
    expect(comments.select.mock.calls[0]?.[0]).not.toContain("client_origin_id");
    expect(comments.eq).toHaveBeenCalledWith("id", COMMENT_ID);
  });

  it("loads only viewer-owned private interaction rows", async () => {
    const reactions = createQuery({
      data: [{ post_id: POST_ID, user_id: VIEWER_ID }],
      error: null,
    });
    const saves = createQuery({ data: [], error: null });
    const follows = createQuery({
      data: [{ follower_id: VIEWER_ID, followed_id: AUTHOR_ID }],
      error: null,
    });
    const query = createClient({
      community_post_reactions: reactions,
      community_post_saves: saves,
      community_author_follows: follows,
    });
    const store = createSupabaseCommunityStore(query.client);

    await expect(
      store.loadViewerState(VIEWER_ID, {
        postIds: [POST_ID, POST_ID],
        authorIds: [AUTHOR_ID],
      }),
    ).resolves.toEqual({
      reactedPostIds: [POST_ID],
      savedPostIds: [],
      followedAuthorIds: [AUTHOR_ID],
    });

    expect(reactions.select).toHaveBeenCalledWith("post_id,user_id");
    expect(reactions.eq).toHaveBeenCalledWith("user_id", VIEWER_ID);
    expect(reactions.in).toHaveBeenCalledWith("post_id", [POST_ID]);
    expect(follows.eq).toHaveBeenCalledWith("follower_id", VIEWER_ID);
  });

  it("scopes toggles, deletes, and reports to explicit owner fields", async () => {
    const reactions = createQuery();
    const saves = createQuery();
    const follows = createQuery();
    const comments = createQuery();
    const reports = createQuery();
    const query = createClient({
      community_post_reactions: reactions,
      community_post_saves: saves,
      community_author_follows: follows,
      community_comments: comments,
      community_reports: reports,
    });
    const store = createSupabaseCommunityStore(query.client);

    await store.setPostReaction(VIEWER_ID, POST_ID, true);
    await store.setPostReaction(VIEWER_ID, POST_ID, false);
    await store.setPostSaved(VIEWER_ID, POST_ID, true);
    await store.setAuthorFollowed(VIEWER_ID, AUTHOR_ID, true, COMMENT_ID);
    await store.deleteComment(VIEWER_ID, COMMENT_ID);
    await store.createReport(VIEWER_ID, {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      targetType: "post",
      targetId: POST_ID,
      reason: "other",
      details: "추가 검토가 필요합니다.",
    });

    expect(reactions.upsert).toHaveBeenCalledWith(
      { post_id: POST_ID, user_id: VIEWER_ID },
      { ignoreDuplicates: true, onConflict: "post_id,user_id" },
    );
    expect(reactions.delete).toHaveBeenCalledTimes(1);
    expect(reactions.eq).toHaveBeenCalledWith("user_id", VIEWER_ID);
    expect(reactions.eq).toHaveBeenCalledWith("post_id", POST_ID);
    expect(saves.upsert).toHaveBeenCalled();
    expect(follows.upsert).toHaveBeenCalledWith(
      {
        id: COMMENT_ID,
        follower_id: VIEWER_ID,
        followed_id: AUTHOR_ID,
      },
      { ignoreDuplicates: true, onConflict: "follower_id,followed_id" },
    );
    expect(comments.eq).toHaveBeenCalledWith("author_id", VIEWER_ID);
    expect(comments.eq).toHaveBeenCalledWith("id", COMMENT_ID);
    expect(reports.insert).toHaveBeenCalledWith({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      reporter_id: VIEWER_ID,
      target_type: "post",
      target_id: POST_ID,
      reason: "other",
      details: "추가 검토가 필요합니다.",
    });
  });

  it("maps database failures to stable user-safe errors", async () => {
    const posts = createQuery({
      data: null,
      error: { code: "42501", message: "raw database policy detail" },
    });
    const store = createSupabaseCommunityStore(
      createClient({ community_posts: posts }).client,
    );

    const promise = store.listPosts();
    await expect(promise).rejects.toBeInstanceOf(CommunityStoreError);
    await expect(promise).rejects.toMatchObject({ code: "permission" });
    await expect(promise).rejects.not.toThrow("raw database policy detail");
  });
});
