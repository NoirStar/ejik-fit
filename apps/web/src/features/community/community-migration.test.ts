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
  writeSocialInteractions,
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

    expect(result).toEqual({
      migratedPostIds: ["local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      failures: [],
    });
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
    expect(first.failures).toEqual([
      {
        localPostId: "local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        message:
          "이 기기에 남은 글을 계정으로 옮기지 못했습니다. 글은 그대로 두었습니다.",
      },
    ]);
    expect(readLocalCommunityPosts()).toHaveLength(1);
    expect(readSocialInteractions().commentsByPostId).not.toEqual({});

    vi.mocked(store.createPost).mockRejectedValueOnce(
      new CommunityStoreError("conflict", "이미 이전됨"),
    );
    vi.mocked(store.getPost).mockResolvedValueOnce(serverPost(firstServerId));
    const second = await migrateLocalCommunityContent(store, USER_ID);

    expect(second.failures).toEqual([]);
    expect(second.migratedPostIds).toHaveLength(1);
    expect(vi.mocked(store.createPost).mock.calls[1]?.[1].id).toBe(firstServerId);
    expect(store.getPost).toHaveBeenCalledWith(firstServerId);
    expect(readLocalCommunityPosts()).toEqual([]);
  });

  it("retains a post when another tab adds an interaction during migration", async () => {
    seedBrowserContent();
    const localPostId = "local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const store = createStore();
    vi.mocked(store.setPostSaved).mockImplementationOnce(async () => {
      const current = readSocialInteractions();
      writeSocialInteractions({
        ...current,
        commentsByPostId: {
          ...current.commentsByPostId,
          [localPostId]: [
            ...(current.commentsByPostId[localPostId] ?? []),
            {
              id: "local-comment-from-another-tab",
              body: "이관 도중 다른 탭에서 남긴 댓글",
              createdAt: "2026-07-21T01:02:00.000Z",
            },
          ],
        },
      });
    });

    const first = await migrateLocalCommunityContent(store, USER_ID);

    expect(first.migratedPostIds).toEqual([]);
    expect(first.failures).toEqual([
      {
        localPostId,
        message:
          "옮기는 동안 새 활동이 있어 이 기기에 남은 글을 그대로 두었습니다.",
      },
    ]);
    expect(readLocalCommunityPosts()).toHaveLength(1);
    expect(
      readSocialInteractions().commentsByPostId[localPostId]?.map(
        (comment) => comment.id,
      ),
    ).toEqual(["local-comment-1", "local-comment-from-another-tab"]);

    const second = await migrateLocalCommunityContent(store, USER_ID);

    expect(second).toEqual({ migratedPostIds: [localPostId], failures: [] });
    expect(readLocalCommunityPosts()).toEqual([]);
    expect(readSocialInteractions().commentsByPostId[localPostId]).toBeUndefined();
  });

  it("continues with independent posts and reports structured failures", async () => {
    seedBrowserContent();
    createLocalCommunityPost(
      {
        category: "커리어 고민",
        title: "별개의 두 번째 글",
        body: "첫 번째 글이 실패해도 이 글은 계정으로 옮겨져야 합니다.",
        tags: ["재시도"],
      },
      {
        id: "local-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        createdAt: "2026-07-21T02:00:00.000Z",
      },
    );
    const store = createStore();
    vi.mocked(store.createPost)
      .mockRejectedValueOnce(
        new CommunityStoreError("unavailable", "첫 글 저장 실패"),
      )
      .mockImplementationOnce(async (_userId, input) => serverPost(input.id!));

    const result = await migrateLocalCommunityContent(store, USER_ID);

    expect(result.failures).toEqual([
      {
        localPostId: "local-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        message:
          "이 기기에 남은 글을 계정으로 옮기지 못했습니다. 글은 그대로 두었습니다.",
      },
    ]);
    expect(result.migratedPostIds).toEqual([
      "local-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
    expect(readLocalCommunityPosts().map((post) => post.id)).toEqual([
      "local-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ]);
  });
});
