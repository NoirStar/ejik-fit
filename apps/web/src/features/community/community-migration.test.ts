import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CommunityStoreError,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/community-contract";
import { createLocalCommunityPost, readLocalCommunityPosts } from "@/lib/local-community-posts";
import {
  addLocalPostComment,
  readSocialInteractions,
  togglePostReaction,
  togglePostSave,
} from "@/lib/social-interactions";

import type { CommunityStore } from "./community-store";
import {
  deterministicCommunityUuid,
  migrateLocalCommunityContent,
} from "./community-migration";

const USER_ID = "11111111-1111-4111-8111-111111111111";

type MigrationStore = Pick<
  CommunityStore,
  | "createComment"
  | "createPost"
  | "getComment"
  | "getPost"
  | "setPostReaction"
  | "setPostSaved"
>;

function serverPost(id: string): CommunityPost {
  return {
    id,
    author: { id: USER_ID, nickname: "작성자" },
    category: "커리어 질문",
    title: "서버 이전 글",
    body: "브라우저에서 계정으로 이전한 본문입니다.",
    tags: ["Python"],
    metrics: { reactions: 0, comments: 0, saves: 0 },
    createdAt: "2026-07-21T01:00:00.000Z",
    updatedAt: "2026-07-21T01:00:00.000Z",
  };
}

function serverComment(id: string, postId: string): CommunityComment {
  return {
    id,
    postId,
    author: { id: USER_ID, nickname: "작성자" },
    body: "이전한 댓글",
    createdAt: "2026-07-21T01:01:00.000Z",
    updatedAt: "2026-07-21T01:01:00.000Z",
  };
}

function createStore(): MigrationStore {
  return {
    createPost: vi.fn(async (_userId, input) => serverPost(input.id!)),
    getPost: vi.fn(async (postId) => serverPost(postId)),
    createComment: vi.fn(async (_userId, postId, input) =>
      serverComment(input.id!, postId),
    ),
    getComment: vi.fn(async (commentId) =>
      serverComment(commentId, "unused"),
    ),
    setPostReaction: vi.fn(async () => undefined),
    setPostSaved: vi.fn(async () => undefined),
  };
}

function seedBrowserContent() {
  createLocalCommunityPost(
    {
      category: "커리어 질문",
      title: "서버 이전 글",
      body: "브라우저에서 계정으로 이전한 본문입니다.",
      tags: ["Python"],
    },
    {
      id: "local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      createdAt: "2026-07-21T01:00:00.000Z",
    },
  );
  addLocalPostComment(
    "local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "이전한 댓글",
    {
      id: "local-comment-1",
      createdAt: "2026-07-21T01:01:00.000Z",
    },
  );
  togglePostReaction("local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  togglePostSave("local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
}

describe("local community migration", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("derives stable custom UUIDs without exposing local ids as database ids", async () => {
    const first = await deterministicCommunityUuid("post:local-1");
    const second = await deterministicCommunityUuid("post:local-1");
    const different = await deterministicCommunityUuid("post:local-2");

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("removes local content only after every server write succeeds", async () => {
    seedBrowserContent();
    const store = createStore();

    const result = await migrateLocalCommunityContent(store, USER_ID);

    expect(result).toEqual({ migratedPostIds: [
      "local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ], failedPostIds: [] });
    expect(store.createPost).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        clientOriginId: "local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
    const postId = vi.mocked(store.createPost).mock.calls[0]?.[1].id;
    expect(store.createComment).toHaveBeenCalledWith(
      USER_ID,
      postId,
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        clientOriginId: "local-comment-1",
      }),
    );
    expect(store.setPostReaction).toHaveBeenCalledWith(USER_ID, postId, true);
    expect(store.setPostSaved).toHaveBeenCalledWith(USER_ID, postId, true);
    expect(readLocalCommunityPosts()).toEqual([]);
    expect(readSocialInteractions().reactedPostIds).toEqual([]);
    expect(readSocialInteractions().savedPostIds).toEqual([]);
    expect(readSocialInteractions().commentsByPostId).toEqual({});
  });

  it("keeps browser content on partial failure and safely resumes conflicts", async () => {
    seedBrowserContent();
    const store = createStore();
    vi.mocked(store.createComment).mockRejectedValueOnce(
      new CommunityStoreError("unavailable", "일시 오류"),
    );

    const first = await migrateLocalCommunityContent(store, USER_ID);
    const firstServerId = vi.mocked(store.createPost).mock.calls[0]?.[1].id!;
    expect(first.failedPostIds).toEqual([
      "local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
    expect(readLocalCommunityPosts()).toHaveLength(1);
    expect(readSocialInteractions().commentsByPostId).not.toEqual({});

    vi.mocked(store.createPost).mockRejectedValueOnce(
      new CommunityStoreError("conflict", "이미 이전됨"),
    );
    vi.mocked(store.getPost).mockResolvedValueOnce(serverPost(firstServerId));
    const second = await migrateLocalCommunityContent(store, USER_ID);

    expect(second.failedPostIds).toEqual([]);
    expect(second.migratedPostIds).toHaveLength(1);
    expect(vi.mocked(store.createPost).mock.calls[1]?.[1].id).toBe(firstServerId);
    expect(store.getPost).toHaveBeenCalledWith(firstServerId);
    expect(readLocalCommunityPosts()).toEqual([]);
  });
});
