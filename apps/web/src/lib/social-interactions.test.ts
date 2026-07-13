import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_SOCIAL_INTERACTIONS,
  addLocalPostComment,
  normalizeSocialInteractions,
  readSocialInteractions,
  subscribeSocialInteractions,
  togglePostReaction,
  togglePostSave,
  writeSocialInteractions,
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

describe("social interaction storage", () => {
  afterEach(() => window.localStorage.clear());

  it("normalizes ids and removes malformed or oversized comments", () => {
    expect(
      normalizeSocialInteractions({
        reactedPostIds: [" post-b ", "post-a", "post-b", 3],
        savedPostIds: ["post-c", "", null],
        commentsByPostId: {
          " post-a ": [
            {
              id: " comment-1 ",
              body: " 좋은 질문입니다. ",
              createdAt: "2026-07-14T00:00:00.000Z",
            },
            {
              id: "broken-date",
              body: "보이지 않음",
              createdAt: "not-a-date",
            },
            {
              id: "too-long",
              body: "가".repeat(601),
              createdAt: "2026-07-14T00:01:00.000Z",
            },
          ],
        },
      }),
    ).toEqual({
      reactedPostIds: ["post-a", "post-b"],
      savedPostIds: ["post-c"],
      commentsByPostId: {
        "post-a": [
          {
            id: "comment-1",
            body: "좋은 질문입니다.",
            createdAt: "2026-07-14T00:00:00.000Z",
          },
        ],
      },
    });
  });

  it("merges normalized post aliases without duplicating comment ids", () => {
    expect(
      normalizeSocialInteractions({
        commentsByPostId: {
          " post-a ": [
            {
              id: "comment-1",
              body: "먼저 읽은 값",
              createdAt: "2026-07-14T00:00:00.000Z",
            },
          ],
          "post-a": [
            {
              id: "comment-1",
              body: "나중에 읽은 값",
              createdAt: "2026-07-14T00:01:00.000Z",
            },
          ],
        },
      }).commentsByPostId["post-a"],
    ).toEqual([
      {
        id: "comment-1",
        body: "나중에 읽은 값",
        createdAt: "2026-07-14T00:01:00.000Z",
      },
    ]);
  });

  it("persists reaction and save toggles", () => {
    const fake = storage();

    expect(togglePostReaction("post-b", fake).reactedPostIds).toEqual([
      "post-b",
    ]);
    expect(togglePostReaction("post-b", fake).reactedPostIds).toEqual([]);
    expect(togglePostSave("post-a", fake).savedPostIds).toEqual(["post-a"]);
    expect(readSocialInteractions(fake).savedPostIds).toEqual(["post-a"]);
  });

  it("adds a trimmed local comment and rejects invalid input", () => {
    const fake = storage();
    const added = addLocalPostComment(" post-a ", " 질문 감사합니다. ", {
      createdAt: "2026-07-14T01:02:03.000Z",
      id: "comment-1",
      storage: fake,
    });

    expect(added.comment).toEqual({
      id: "comment-1",
      body: "질문 감사합니다.",
      createdAt: "2026-07-14T01:02:03.000Z",
    });
    expect(added.state.commentsByPostId["post-a"]).toEqual([added.comment]);
    expect(
      addLocalPostComment("post-a", " ", { storage: fake }).comment,
    ).toBeNull();
    expect(
      addLocalPostComment("post-a", "가".repeat(601), { storage: fake })
        .comment,
    ).toBeNull();
  });

  it("does not claim writes succeeded when storage is blocked", () => {
    const blocked = {
      ...storage(),
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;

    expect(readSocialInteractions(blocked)).toEqual(EMPTY_SOCIAL_INTERACTIONS);
    expect(togglePostReaction("post-a", blocked)).toEqual(
      EMPTY_SOCIAL_INTERACTIONS,
    );
    expect(
      addLocalPostComment("post-a", "저장되지 않음", {
        id: "comment-1",
        storage: blocked,
      }).comment,
    ).toBeNull();
  });

  it("notifies same-tab listeners and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSocialInteractions(listener);

    writeSocialInteractions({
      ...EMPTY_SOCIAL_INTERACTIONS,
      savedPostIds: ["post-a"],
    });
    expect(listener).toHaveBeenCalledWith({
      ...EMPTY_SOCIAL_INTERACTIONS,
      savedPostIds: ["post-a"],
    });

    unsubscribe();
    togglePostReaction("post-b");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("notifies only for matching changes from another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSocialInteractions(listener);
    localStorage.setItem(
      "ejik-fit:social-interactions",
      JSON.stringify({ savedPostIds: ["post-a"] }),
    );

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ejik-fit:social-interactions",
        storageArea: localStorage,
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "another-key" }),
    );

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      ...EMPTY_SOCIAL_INTERACTIONS,
      savedPostIds: ["post-a"],
    });
    unsubscribe();
  });
});
