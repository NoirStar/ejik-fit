import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CommunityPost,
  CommunityViewerState,
} from "@/lib/community-contract";

import type { CommunityStore } from "./community-store";
import { useCommunityFeed } from "./use-community-feed";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function post(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: POST_ID,
    author: { id: AUTHOR_ID, nickname: "서버정원" },
    category: "커리어 질문",
    title: "서버에 저장된 커뮤니티 글",
    body: "로그인 사용자와 비로그인 사용자가 함께 읽는 본문입니다.",
    tags: ["백엔드"],
    metrics: { reactions: 4, comments: 2, saves: 1 },
    createdAt: "2026-07-21T04:00:00.000Z",
    updatedAt: "2026-07-21T04:00:00.000Z",
    ...overrides,
  };
}

function storeWith(
  posts: CommunityPost[] = [post()],
  viewerState: CommunityViewerState = {
    reactedPostIds: [POST_ID],
    savedPostIds: [],
    followedAuthorIds: [AUTHOR_ID],
  },
) {
  return {
    searchPosts: vi.fn(async () => ({
      items: posts,
      nextCursor: null as { createdAt: string; id: string } | null,
    })),
    listPostPage: vi.fn(async () => ({
      items: posts,
      nextCursor: null as { createdAt: string; id: string } | null,
    })),
    listFollowingPostPage: vi.fn(async () => ({
      items: posts,
      nextCursor: null as { createdAt: string; id: string } | null,
    })),
    listSavedPostPage: vi.fn(async () => ({
      items: posts,
      nextCursor: null as { createdAt: string; id: string } | null,
    })),
    listPosts: vi.fn(async () => posts),
    listSavedPosts: vi.fn(async () => posts),
    getPost: vi.fn(async () => null),
    getComment: vi.fn(async () => null),
    listCommentPage: vi.fn(async () => ({ items: [], nextCursor: null })),
    listComments: vi.fn(async () => []),
    loadViewerState: vi.fn(async () => viewerState),
    createPost: vi.fn(async (_authorId, input) =>
      post({ id: input.id ?? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    ),
    updatePost: vi.fn(async () => post()),
    deletePost: vi.fn(async () => undefined),
    createComment: vi.fn(async () => {
      throw new Error("not used");
    }),
    updateComment: vi.fn(async () => {
      throw new Error("not used");
    }),
    deleteComment: vi.fn(async () => undefined),
    setPostReaction: vi.fn(async () => undefined),
    setPostSaved: vi.fn(async () => undefined),
    setAuthorFollowed: vi.fn(async () => undefined),
    createReport: vi.fn(async () => undefined),
  } satisfies CommunityStore;
}

describe("useCommunityFeed", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("loads public posts without querying private viewer state for guests", async () => {
    const store = storeWith();
    const { result } = renderHook(() =>
      useCommunityFeed({ authReady: true, store, viewer: null }),
    );

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.state.posts).toEqual([post()]);
    expect(store.listPostPage).toHaveBeenCalledWith({ limit: 20 });
    expect(store.loadViewerState).not.toHaveBeenCalled();
  });

  it("loads the signed-in viewer saved collection without falling back to the public feed", async () => {
    const store = storeWith([post()], {
      reactedPostIds: [],
      savedPostIds: [POST_ID],
      followedAuthorIds: [],
    });
    const { result } = renderHook(() =>
      useCommunityFeed({
        authReady: true,
        limit: 50,
        savedOnly: true,
        store,
        viewer: { id: USER_ID, email: "viewer@example.com" },
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(store.listSavedPostPage).toHaveBeenCalledWith({ limit: 50 });
    expect(store.listSavedPosts).not.toHaveBeenCalled();
    expect(store.listPosts).not.toHaveBeenCalled();
    expect(result.current.state.viewerState.savedPostIds).toEqual([POST_ID]);
  });

  it("loads and paginates the complete auth-scoped following feed", async () => {
    const olderPost = post({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      title: "공개 첫 페이지 밖의 팔로잉 글",
      createdAt: "2026-07-01T04:00:00.000Z",
      updatedAt: "2026-07-01T04:00:00.000Z",
    });
    const store = storeWith();
    store.listFollowingPostPage
      .mockResolvedValueOnce({
        items: [post()],
        nextCursor: { createdAt: post().createdAt, id: POST_ID },
      })
      .mockResolvedValueOnce({ items: [olderPost], nextCursor: null });
    const { result } = renderHook(() =>
      useCommunityFeed({
        authReady: true,
        followingOnly: true,
        store,
        viewer: { id: USER_ID, email: "viewer@example.com" },
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(store.listFollowingPostPage).toHaveBeenCalledWith({ limit: 20 });
    expect(store.listPostPage).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.loadMore();
    });

    expect(store.listFollowingPostPage).toHaveBeenLastCalledWith({
      before: { createdAt: post().createdAt, id: POST_ID },
      limit: 20,
    });
    expect(result.current.state.posts.map((item) => item.id)).toEqual([
      POST_ID,
      olderPost.id,
    ]);
  });

  it("keeps visible posts and viewer membership when a manual reload fails", async () => {
    const store = storeWith([post()], {
      reactedPostIds: [],
      savedPostIds: [POST_ID],
      followedAuthorIds: [],
    });
    const { result } = renderHook(() =>
      useCommunityFeed({
        authReady: true,
        savedOnly: true,
        store,
        viewer: { id: USER_ID, email: "viewer@example.com" },
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    store.listSavedPostPage.mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toBe(
      "커뮤니티에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(result.current.state.posts).toEqual([post()]);
    expect(result.current.state.viewerState.savedPostIds).toEqual([POST_ID]);
  });

  it("appends a cursor page without duplicating overlapping posts", async () => {
    const nextPost = post({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      title: "두 번째 서버 글",
      createdAt: "2026-07-20T04:00:00.000Z",
      updatedAt: "2026-07-20T04:00:00.000Z",
    });
    const store = storeWith();
    store.listPostPage
      .mockResolvedValueOnce({
        items: [post()],
        nextCursor: { createdAt: post().createdAt, id: POST_ID },
      })
      .mockResolvedValueOnce({
        items: [post(), nextPost],
        nextCursor: null,
      });
    const { result } = renderHook(() =>
      useCommunityFeed({ authReady: true, store, viewer: null }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.state.nextCursor).toEqual({
      createdAt: post().createdAt,
      id: POST_ID,
    });
    await act(async () => {
      await result.current.loadMore();
    });

    expect(store.listPostPage).toHaveBeenLastCalledWith({
      before: { createdAt: post().createdAt, id: POST_ID },
      limit: 20,
    });
    expect(result.current.state.posts.map((item) => item.id)).toEqual([
      POST_ID,
      nextPost.id,
    ]);
    expect(result.current.state.nextCursor).toBeNull();
    expect(result.current.state.loadingMore).toBe(false);
  });

  it("ignores an older load-more response after a reload starts", async () => {
    const stalePage = deferred<{
      items: CommunityPost[];
      nextCursor: null;
    }>();
    const refreshed = post({ title: "새로고침으로 받은 최신 목록" });
    const stale = post({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      title: "늦게 도착한 이전 페이지",
    });
    const store = storeWith();
    store.listPostPage
      .mockResolvedValueOnce({
        items: [post()],
        nextCursor: { createdAt: post().createdAt, id: POST_ID },
      })
      .mockImplementationOnce(() => stalePage.promise)
      .mockResolvedValueOnce({ items: [refreshed], nextCursor: null });
    const { result } = renderHook(() =>
      useCommunityFeed({ authReady: true, store, viewer: null }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let pendingLoadMore!: Promise<void>;
    act(() => {
      pendingLoadMore = result.current.loadMore();
    });
    await waitFor(() => expect(store.listPostPage).toHaveBeenCalledTimes(2));
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

  it("updates server membership and already-inclusive counters together", async () => {
    const store = storeWith();
    const { result } = renderHook(() =>
      useCommunityFeed({
        authReady: true,
        store,
        viewer: { id: USER_ID, email: "viewer@example.com" },
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(async () => {
      expect(await result.current.toggleReaction(POST_ID)).toBe(true);
      expect(await result.current.toggleSaved(POST_ID)).toBe(true);
      expect(await result.current.toggleFollowed(AUTHOR_ID)).toBe(true);
    });

    expect(store.setPostReaction).toHaveBeenCalledWith(USER_ID, POST_ID, false);
    expect(store.setPostSaved).toHaveBeenCalledWith(USER_ID, POST_ID, true);
    expect(store.setAuthorFollowed).toHaveBeenCalledWith(
      USER_ID,
      AUTHOR_ID,
      false,
    );
    expect(result.current.state.posts[0]?.metrics).toEqual({
      reactions: 3,
      comments: 2,
      saves: 2,
    });
    expect(result.current.state.viewerState).toEqual({
      reactedPostIds: [],
      savedPostIds: [POST_ID],
      followedAuthorIds: [],
    });
  });

  it("keeps a failed mutation unchanged and exposes a retryable message", async () => {
    const store = storeWith();
    store.setPostReaction.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() =>
      useCommunityFeed({
        authReady: true,
        store,
        viewer: { id: USER_ID, email: "viewer@example.com" },
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(async () => {
      expect(await result.current.toggleReaction(POST_ID)).toBe(false);
    });

    expect(result.current.state.posts[0]?.metrics.reactions).toBe(4);
    expect(result.current.state.viewerState.reactedPostIds).toEqual([POST_ID]);
    expect(result.current.state.actionError).toBe(
      "커뮤니티에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
