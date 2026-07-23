import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommunityPost } from "@/lib/community-contract";

import type { CommunityStore } from "./community-store";
import { useCommunitySearch } from "./use-community-search";

const POST: CommunityPost = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  author: {
    id: "22222222-2222-4222-8222-222222222222",
    nickname: "검색정원",
  },
  category: "커리어 질문",
  title: "Python 검색 결과",
  body: "서버 전체에서 찾은 글입니다.",
  tags: ["Python"],
  metrics: { reactions: 1, comments: 0, saves: 0 },
  createdAt: "2026-07-23T03:00:00.000Z",
  updatedAt: "2026-07-23T03:00:00.000Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function searchStore() {
  const searchPosts = vi.fn<CommunityStore["searchPosts"]>();
  searchPosts.mockResolvedValue({ items: [POST], nextCursor: null });
  return { searchPosts } as unknown as CommunityStore & {
    searchPosts: typeof searchPosts;
  };
}

describe("useCommunitySearch", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits queries shorter than two characters", async () => {
    const store = searchStore();
    const { result } = renderHook(() =>
      useCommunitySearch("P", { store }),
    );

    await act(async () => undefined);
    expect(result.current.state).toMatchObject({ status: "idle", posts: [] });
    expect(store.searchPosts).not.toHaveBeenCalled();
  });

  it("ignores a stale response after the query changes", async () => {
    const resolvers = new Map<
      string,
      (page: { items: CommunityPost[]; nextCursor: null }) => void
    >();
    const store = searchStore();
    store.searchPosts.mockImplementation(
      ({ query }) =>
        new Promise((resolve) => {
          resolvers.set(query, resolve);
        }),
    );
    const { result, rerender } = renderHook(
      ({ query }) => useCommunitySearch(query, { store }),
      { initialProps: { query: "Python" } },
    );
    await waitFor(() => expect(resolvers.has("Python")).toBe(true));

    rerender({ query: "React" });
    await waitFor(() => expect(resolvers.has("React")).toBe(true));
    await act(async () => {
      resolvers.get("React")?.({
        items: [{ ...POST, title: "React 검색 결과" }],
        nextCursor: null,
      });
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(async () => {
      resolvers.get("Python")?.({ items: [POST], nextCursor: null });
    });

    expect(result.current.state.posts[0]?.title).toBe("React 검색 결과");
  });

  it("loads and deduplicates the next RPC cursor page", async () => {
    const second = {
      ...POST,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "두 번째 검색 결과",
      createdAt: "2026-07-22T03:00:00.000Z",
      updatedAt: "2026-07-22T03:00:00.000Z",
    };
    const store = searchStore();
    store.searchPosts
      .mockResolvedValueOnce({
        items: [POST],
        nextCursor: { createdAt: POST.createdAt, id: POST.id },
      })
      .mockResolvedValueOnce({ items: [POST, second], nextCursor: null });
    const { result } = renderHook(() =>
      useCommunitySearch("Python", { limit: 20, store }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(store.searchPosts).toHaveBeenLastCalledWith({
      query: "Python",
      before: { createdAt: POST.createdAt, id: POST.id },
      limit: 20,
    });
    expect(result.current.state.posts.map((post) => post.id)).toEqual([
      POST.id,
      second.id,
    ]);
    expect(result.current.state.nextCursor).toBeNull();
  });

  it("ignores an older load-more response after the same query reloads", async () => {
    const stalePage = deferred<{ items: CommunityPost[]; nextCursor: null }>();
    const refreshed = { ...POST, title: "새로고침한 검색 결과" };
    const stale = {
      ...POST,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "늦게 도착한 검색 결과",
    };
    const store = searchStore();
    store.searchPosts
      .mockResolvedValueOnce({
        items: [POST],
        nextCursor: { createdAt: POST.createdAt, id: POST.id },
      })
      .mockImplementationOnce(() => stalePage.promise)
      .mockResolvedValueOnce({ items: [refreshed], nextCursor: null });
    const { result } = renderHook(() =>
      useCommunitySearch("Python", { store }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let pendingLoadMore!: Promise<void>;
    act(() => {
      pendingLoadMore = result.current.loadMore();
    });
    await waitFor(() => expect(store.searchPosts).toHaveBeenCalledTimes(2));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.state.posts).toEqual([refreshed]);

    await act(async () => {
      stalePage.resolve({ items: [stale], nextCursor: null });
      await pendingLoadMore;
    });

    expect(result.current.state.posts).toEqual([refreshed]);
  });

  it("exposes a safe retryable error without provider details", async () => {
    const store = searchStore();
    store.searchPosts.mockRejectedValueOnce(
      new Error("raw search provider failure"),
    );

    const { result } = renderHook(() =>
      useCommunitySearch("Python", { store }),
    );

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state.error).toBe(
      "커뮤니티 검색 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(result.current.state.error).not.toContain(
      "raw search provider failure",
    );
  });
});
