import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  CommunityPostFeedItem,
  MarketInsightFeedItem,
  RecommendedJobFeedItem,
} from "./types";
import { useHomeFeedPagination } from "./use-home-feed-pagination";

function community(id: string): CommunityPostFeedItem {
  return {
    id,
    type: "community_post",
    category: "일반",
    authorId: "author",
    authorName: "작성자",
    authorHeadline: "커뮤니티 회원",
    authorTone: "violet",
    createdAt: "2026-07-27T00:00:00.000Z",
    createdLabel: "방금 전",
    title: id,
    body: "본문",
    tags: [],
    href: `/posts/${id}`,
    metrics: { reactions: 0, comments: 0, saves: 0 },
    source: "server",
  };
}

function job(id: string): RecommendedJobFeedItem {
  return {
    id,
    postingId: id,
    type: "recommended_job",
    companyName: "기업",
    title: id,
    location: "서울",
    careerLabel: "경력 무관",
    employmentLabel: "고용 형태 미기재",
    sourceUrl: `https://example.com/${id}`,
    firstSeenAt: "2026-07-27T00:00:00.000Z",
    verifiedLabel: "7월 27일",
    matchedRequiredSkills: [],
    missingRequiredSkills: [],
    matchedPreferredSkills: [],
    href: `/jobs/${id}`,
    source: "api",
  };
}

function insight(id: string): MarketInsightFeedItem {
  return {
    id,
    type: "market_insight",
    skillName: id,
    title: id,
    summary: "요약",
    postingCount: 1,
    requiredCount: 1,
    preferredCount: 0,
    unspecifiedCount: 0,
    sampleLabel: "1건",
    sourceLabel: "공식 채용페이지",
    href: `/skill-map?skill=${id}`,
    source: "api",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("useHomeFeedPagination", () => {
  it("continues updating after React's development effect replay", async () => {
    const loadJobs = vi.fn(async () => ({ items: [job("job-1")], total: 1 }));
    const { result } = renderHook(
      () =>
        useHomeFeedPagination({
          activeTab: "recommended",
          initialCommunity: [],
          initialCommunityHasMore: false,
          initialInsights: [],
          initialJobs: [],
          jobTotal: 1,
          loadJobs,
          ownedSkills: [],
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>{children}</StrictMode>
        ),
      },
    );

    await act(async () => {
      await result.current.loadNext("recommended");
    });

    expect(result.current.items.map(({ id }) => id)).toEqual(["job-1"]);
  });

  it("uses the server-rendered buffer before one guarded job request", async () => {
    const initialJobs = Array.from({ length: 18 }, (_, index) =>
      job(`job-${index + 1}`),
    );
    const loadJobs = vi.fn(async () => ({
      items: Array.from({ length: 7 }, (_, index) => job(`job-${index + 19}`)),
      total: 25,
    }));
    const { result } = renderHook(() =>
      useHomeFeedPagination({
        activeTab: "recommended",
        initialCommunity: [],
        initialCommunityHasMore: false,
        initialInsights: [insight("insight-1"), insight("insight-2")],
        initialJobs,
        jobTotal: 25,
        loadJobs,
        ownedSkills: [],
      }),
    );

    expect(result.current.items).toHaveLength(10);

    await act(async () => {
      await result.current.loadNext("recommended");
    });

    expect(result.current.items).toHaveLength(20);
    expect(loadJobs).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.all([
        result.current.loadNext("recommended"),
        result.current.loadNext("recommended"),
      ]);
    });

    expect(loadJobs).toHaveBeenCalledTimes(1);
    expect(loadJobs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 18 }),
    );
    expect(result.current.items).toHaveLength(27);
    expect(new Set(result.current.items.map(({ id }) => id)).size).toBe(
      result.current.items.length,
    );
  });

  it("keeps appended items on failure and retries the failed source", async () => {
    const loadJobs = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ items: [job("job-1")], total: 1 });
    const { result } = renderHook(() =>
      useHomeFeedPagination({
        activeTab: "recommended",
        initialCommunity: [],
        initialCommunityHasMore: false,
        initialInsights: [],
        initialJobs: [],
        jobTotal: 1,
        loadJobs,
        ownedSkills: [],
      }),
    );

    await act(async () => {
      await result.current.loadNext("recommended");
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe("피드를 더 불러오지 못했습니다.");

    await act(async () => {
      await result.current.retry("recommended");
    });

    expect(loadJobs).toHaveBeenCalledTimes(2);
    expect(result.current.items.map(({ id }) => id)).toEqual(["job-1"]);
    expect(result.current.error).toBe("");
    expect(result.current.complete).toBe(true);
  });

  it("prepends, refreshes, and removes a community post without duplicates", () => {
    const original = community("post-1");
    const { result, rerender } = renderHook(
      ({ liveCommunity }) =>
        useHomeFeedPagination({
          activeTab: "recommended",
          initialCommunity: [original],
          initialCommunityHasMore: false,
          initialInsights: [],
          initialJobs: [],
          jobTotal: 0,
          liveCommunity,
          ownedSkills: [],
        }),
      { initialProps: { liveCommunity: [original] } },
    );

    act(() => {
      result.current.prepend({
        ...original,
        id: "post-2",
        title: "새 글",
      });
      result.current.prepend(original);
    });

    expect(result.current.items.map(({ id }) => id)).toEqual([
      "post-2",
      "post-1",
    ]);

    rerender({
      liveCommunity: [
        {
          ...original,
          metrics: { reactions: 3, comments: 2, saves: 1 },
        },
      ],
    });
    expect(result.current.items[1]).toMatchObject({
      metrics: { reactions: 3, comments: 2, saves: 1 },
    });

    act(() => result.current.remove("post-2"));
    expect(result.current.items.map(({ id }) => id)).toEqual(["post-1"]);
  });

  it("ignores a page that finishes after its feed controller is disabled", async () => {
    const pending = deferred<{
      items: CommunityPostFeedItem[];
      hasMore: boolean;
    }>();
    const loadCommunity = vi.fn(() => pending.promise);
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useHomeFeedPagination({
          activeTab: "popular",
          enabled,
          initialCommunity: [],
          initialCommunityHasMore: true,
          initialInsights: [],
          initialJobs: [],
          jobTotal: 0,
          loadCommunity,
          ownedSkills: [],
        }),
      { initialProps: { enabled: true } },
    );

    let operation!: Promise<void>;
    act(() => {
      operation = result.current.loadNext("popular");
    });
    expect(result.current.loading).toBe(true);

    rerender({ enabled: false });
    expect(result.current.loading).toBe(false);

    await act(async () => {
      pending.resolve({ items: [community("stale-post")], hasMore: false });
      await operation;
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe("");
  });
});
