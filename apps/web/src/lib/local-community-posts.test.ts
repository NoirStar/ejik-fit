import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_LOCAL_COMMUNITY_POSTS,
  clearLocalCommunityPosts,
  createLocalCommunityPost,
  deleteLocalCommunityPost,
  normalizeLocalCommunityPosts,
  readLocalCommunityPosts,
  removeLocalCommunityPost,
  subscribeLocalCommunityPosts,
} from "./local-community-posts";
import {
  addLocalPostComment,
  readSocialInteractions,
  togglePostReaction,
} from "./social-interactions";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  } satisfies Storage;
}

function post(index: number) {
  return {
    id: `local-post-${index}`,
    title: `글 ${index}`,
    body: `본문 ${index}`,
    tags: ["백엔드"],
    createdAt: new Date(Date.UTC(2026, 6, 1, index)).toISOString(),
  };
}

describe("local community post storage", () => {
  afterEach(() => window.localStorage.clear());

  it("normalizes valid posts, tags, ordering, and storage bounds", () => {
    const posts = Array.from(
      { length: MAX_LOCAL_COMMUNITY_POSTS + 2 },
      (_, index) => post(index),
    );
    const normalized = normalizeLocalCommunityPosts([
      ...posts,
      {
        ...post(31),
        title: "중복된 오래된 값",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
      {
        ...post(50),
        id: "server-owned-id",
      },
      {
        ...post(51),
        body: " ",
      },
      {
        ...post(40),
        tags: [" Java ", "java", "백엔드", "Kubernetes", "Docker", "초과"],
      },
    ]);

    expect(normalized).toHaveLength(MAX_LOCAL_COMMUNITY_POSTS);
    expect(normalized[0]).toEqual({
      ...post(40),
      tags: ["Java", "백엔드", "Kubernetes", "Docker"],
    });
    expect(normalized.filter((item) => item.id === "local-post-31")).toEqual([
      post(31),
    ]);
    expect(normalized.some((item) => item.id === "server-owned-id")).toBe(false);
  });

  it("recovers from malformed and blocked storage", () => {
    const malformed = storage();
    malformed.setItem("ejik-fit:local-community-posts", "{broken");
    const blocked = {
      ...storage(),
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;

    expect(readLocalCommunityPosts(malformed)).toEqual([]);
    expect(readLocalCommunityPosts(blocked)).toEqual([]);
    expect(
      createLocalCommunityPost(
        { title: "저장 실패", body: "본문", tags: [] },
        {
          id: "local-blocked",
          createdAt: "2026-07-14T00:00:00.000Z",
          storage: blocked,
        },
      ).post,
    ).toBeNull();
  });

  it("creates a trimmed post and rejects invalid drafts", () => {
    const fake = storage();
    const result = createLocalCommunityPost(
      {
        category: "면접 후기",
        title: " 첫 이직 질문 ",
        body: " 준비 순서가 궁금합니다. ",
        tags: [" Java ", "java", "백엔드"],
      },
      {
        id: "local-first-post",
        createdAt: "2026-07-14T01:02:03.000Z",
        storage: fake,
      },
    );

    expect(result.post).toEqual({
      id: "local-first-post",
      category: "면접 후기",
      title: "첫 이직 질문",
      body: "준비 순서가 궁금합니다.",
      tags: ["Java", "백엔드"],
      createdAt: "2026-07-14T01:02:03.000Z",
    });
    expect(readLocalCommunityPosts(fake)).toEqual([result.post]);
    expect(
      createLocalCommunityPost(
        { title: " ", body: "본문", tags: [] },
        { storage: fake },
      ).post,
    ).toBeNull();
    expect(
      createLocalCommunityPost(
        { title: "제목", body: "가".repeat(1201), tags: [] },
        { storage: fake },
      ).post,
    ).toBeNull();
  });

  it("removes a post only when the new state was persisted", () => {
    const fake = storage();
    createLocalCommunityPost(
      { title: "삭제할 글", body: "본문", tags: [] },
      {
        id: "local-remove-me",
        createdAt: "2026-07-14T00:00:00.000Z",
        storage: fake,
      },
    );
    expect(removeLocalCommunityPost("local-remove-me", fake)).toEqual({
      posts: [],
      removed: true,
    });

    const blocked = {
      ...fake,
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;
    createLocalCommunityPost(
      { title: "남아야 할 글", body: "본문", tags: [] },
      {
        id: "local-stays",
        createdAt: "2026-07-14T00:00:00.000Z",
        storage: fake,
      },
    );
    expect(removeLocalCommunityPost("local-stays", blocked)).toEqual({
      posts: [
        {
          id: "local-stays",
          title: "남아야 할 글",
          body: "본문",
          tags: [],
          createdAt: "2026-07-14T00:00:00.000Z",
        },
      ],
      removed: false,
    });
  });

  it("deletes a post only after its local interactions are cleared", () => {
    const fake = storage();
    createLocalCommunityPost(
      { title: "함께 삭제", body: "본문", tags: [] },
      {
        id: "local-delete-all",
        createdAt: "2026-07-14T00:00:00.000Z",
        storage: fake,
      },
    );
    togglePostReaction("local-delete-all", fake);
    addLocalPostComment("local-delete-all", "댓글", {
      id: "local-comment",
      createdAt: "2026-07-14T01:00:00.000Z",
      storage: fake,
    });

    expect(deleteLocalCommunityPost("local-delete-all", fake)).toEqual({
      posts: [],
      status: "removed",
    });
    expect(readSocialInteractions(fake).reactedPostIds).toEqual([]);
    expect(readSocialInteractions(fake).commentsByPostId).toEqual({});
  });

  it("keeps the post when its local interactions cannot be cleared", () => {
    const fake = storage();
    createLocalCommunityPost(
      { title: "삭제 중단", body: "본문", tags: [] },
      {
        id: "local-delete-blocked",
        createdAt: "2026-07-14T00:00:00.000Z",
        storage: fake,
      },
    );
    togglePostReaction("local-delete-blocked", fake);
    const blocked = {
      ...fake,
      setItem: (key: string, value: string) => {
        if (key === "ejik-fit:social-interactions") {
          throw new DOMException("blocked", "SecurityError");
        }
        fake.setItem(key, value);
      },
    } satisfies Storage;

    expect(deleteLocalCommunityPost("local-delete-blocked", blocked)).toEqual({
      posts: readLocalCommunityPosts(fake),
      status: "interactions_failed",
    });
    expect(readLocalCommunityPosts(fake)[0]?.id).toBe("local-delete-blocked");
  });

  it("notifies same-tab and matching cross-tab subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocalCommunityPosts(listener);
    createLocalCommunityPost(
      { title: "동기화", body: "본문", tags: [] },
      {
        id: "local-sync",
        createdAt: "2026-07-14T00:00:00.000Z",
      },
    );
    expect(listener).toHaveBeenCalledWith([
      {
        id: "local-sync",
        title: "동기화",
        body: "본문",
        tags: [],
        createdAt: "2026-07-14T00:00:00.000Z",
      },
    ]);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ejik-fit:local-community-posts",
        storageArea: localStorage,
      }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "another-key" }));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    clearLocalCommunityPosts();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("clears the storage key and reports the actual remaining state", () => {
    createLocalCommunityPost(
      { title: "전체 삭제", body: "본문", tags: [] },
      {
        id: "local-clear",
        createdAt: "2026-07-14T00:00:00.000Z",
      },
    );

    expect(clearLocalCommunityPosts()).toEqual([]);
    expect(localStorage.getItem("ejik-fit:local-community-posts")).toBeNull();
  });
});
