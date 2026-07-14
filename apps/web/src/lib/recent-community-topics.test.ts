import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_RECENT_COMMUNITY_TOPICS,
  clearRecentCommunityTopics,
  normalizeRecentCommunityTopics,
  readRecentCommunityTopics,
  recordRecentCommunityTopic,
  removeRecentCommunityTopic,
  subscribeRecentCommunityTopics,
} from "./recent-community-topics";

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

function topic(index: number) {
  return {
    postId: `topic-${index}`,
    title: `커뮤니티 글 ${index}`,
    topicLabel: `주제 ${index}`,
    source: "mock" as const,
    viewedAt: new Date(Date.UTC(2026, 6, 1, index)).toISOString(),
  };
}

describe("recent community topic storage", () => {
  afterEach(() => window.localStorage.clear());

  it("validates, trims, deduplicates, sorts, and bounds recent topics", () => {
    const normalized = normalizeRecentCommunityTopics([
      ...Array.from(
        { length: MAX_RECENT_COMMUNITY_TOPICS + 2 },
        (_, index) => topic(index),
      ),
      {
        ...topic(4),
        title: "  다시 본 글  ",
        topicLabel: "  백엔드  ",
        source: "local",
        viewedAt: "2026-07-14T05:00:00.000Z",
      },
      { ...topic(20), postId: "../unsafe" },
      { ...topic(21), source: "official" },
      { ...topic(22), viewedAt: "not-a-date" },
      { ...topic(23), title: " " },
    ]);

    expect(normalized).toHaveLength(MAX_RECENT_COMMUNITY_TOPICS);
    expect(normalized[0]).toEqual({
      postId: "topic-4",
      title: "다시 본 글",
      topicLabel: "백엔드",
      source: "local",
      viewedAt: "2026-07-14T05:00:00.000Z",
    });
    expect(normalized.filter((item) => item.postId === "topic-4")).toHaveLength(1);
    expect(normalized.some((item) => item.postId === "../unsafe")).toBe(false);
    expect(normalized.at(-1)?.postId).toBe("topic-2");
  });

  it("moves a revisited post to the front and stores no arbitrary href", () => {
    const fake = storage();
    recordRecentCommunityTopic(
      {
        postId: "career-move-3y-backend",
        title: "처음 본 글",
        topicLabel: "백엔드",
        source: "mock",
      },
      { storage: fake, viewedAt: "2026-07-14T01:00:00.000Z" },
    );
    recordRecentCommunityTopic(
      {
        postId: "kubernetes-experience",
        title: "두 번째 글",
        topicLabel: "Kubernetes",
        source: "mock",
      },
      { storage: fake, viewedAt: "2026-07-14T02:00:00.000Z" },
    );
    const recent = recordRecentCommunityTopic(
      {
        postId: "career-move-3y-backend",
        title: "다시 본 글",
        topicLabel: "백엔드",
        source: "mock",
      },
      { storage: fake, viewedAt: "2026-07-14T03:00:00.000Z" },
    );

    expect(recent.map((item) => item.postId)).toEqual([
      "career-move-3y-backend",
      "kubernetes-experience",
    ]);
    expect(recent[0]?.title).toBe("다시 본 글");
    expect(readRecentCommunityTopics(fake)).toEqual(recent);
    expect(fake.getItem("ejik-fit:recent-community-topics")).not.toContain("href");
  });

  it("ignores malformed values, invalid records, and blocked storage", () => {
    const malformed = storage();
    malformed.setItem("ejik-fit:recent-community-topics", "{broken");
    const blocked = {
      ...storage(),
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;

    expect(readRecentCommunityTopics(malformed)).toEqual([]);
    expect(readRecentCommunityTopics(blocked)).toEqual([]);
    expect(
      recordRecentCommunityTopic(
        {
          postId: "javascript:alert-1",
          title: "위험한 값",
          topicLabel: "보안",
          source: "mock",
        },
        { storage: malformed },
      ),
    ).toEqual([]);
    expect(
      recordRecentCommunityTopic(
        {
          postId: "safe-post",
          title: "저장 실패",
          topicLabel: "백엔드",
          source: "mock",
        },
        { storage: blocked, viewedAt: "2026-07-14T04:00:00.000Z" },
      ),
    ).toEqual([]);
  });

  it("notifies same-tab and matching cross-tab subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRecentCommunityTopics(listener);
    recordRecentCommunityTopic(
      {
        postId: "career-move-3y-backend",
        title: "최근 글",
        topicLabel: "백엔드",
        source: "mock",
      },
      { viewedAt: "2026-07-14T05:00:00.000Z" },
    );
    expect(listener).toHaveBeenCalledWith([
      {
        postId: "career-move-3y-backend",
        title: "최근 글",
        topicLabel: "백엔드",
        source: "mock",
        viewedAt: "2026-07-14T05:00:00.000Z",
      },
    ]);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ejik-fit:recent-community-topics",
        storageArea: localStorage,
      }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "another-key" }));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    clearRecentCommunityTopics();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("removes one record and clears the storage key", () => {
    recordRecentCommunityTopic(
      {
        postId: "career-move-3y-backend",
        title: "남길 글",
        topicLabel: "백엔드",
        source: "mock",
      },
      { viewedAt: "2026-07-14T01:00:00.000Z" },
    );
    recordRecentCommunityTopic(
      {
        postId: "local-remove-topic",
        title: "지울 글",
        topicLabel: "이직 준비",
        source: "local",
      },
      { viewedAt: "2026-07-14T02:00:00.000Z" },
    );

    expect(removeRecentCommunityTopic("local-remove-topic")).toEqual([
      expect.objectContaining({ postId: "career-move-3y-backend" }),
    ]);
    expect(clearRecentCommunityTopics()).toEqual([]);
    expect(localStorage.getItem("ejik-fit:recent-community-topics")).toBeNull();
  });
});
