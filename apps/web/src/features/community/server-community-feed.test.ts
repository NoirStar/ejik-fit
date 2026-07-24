import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommunityPost } from "@/lib/community-contract";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  COMMUNITY_FAILURE_COPY,
  createSupabaseCommunityStore,
  type CommunityStore,
} from "./community-store";
import { loadInitialCommunityFeed } from "./server-community-feed";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("./community-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./community-store")>();
  return {
    ...actual,
    createSupabaseCommunityStore: vi.fn(),
  };
});

const post: CommunityPost = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  author: {
    id: "22222222-2222-4222-8222-222222222222",
    nickname: "서버작성자",
  },
  category: "커리어 질문",
  title: "서버 첫 페이지 글",
  body: "서버 렌더링에 사용할 공개 글입니다.",
  tags: ["백엔드"],
  metrics: { reactions: 1, comments: 2, saves: 3 },
  createdAt: "2026-07-24T04:00:00.000Z",
  updatedAt: "2026-07-24T04:00:00.000Z",
};

function storeWithList() {
  return {
    listPostPage: vi.fn(async () => ({ items: [post], nextCursor: null })),
  } as unknown as CommunityStore;
}

describe("loadInitialCommunityFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the public first page with the shared community store", async () => {
    const client = {};
    const store = storeWithList();
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never);
    vi.mocked(createSupabaseCommunityStore).mockReturnValue(store);

    await expect(loadInitialCommunityFeed()).resolves.toEqual({
      status: "ready",
      page: { items: [post], nextCursor: null },
    });
    expect(createSupabaseCommunityStore).toHaveBeenCalledWith(client);
    expect(store.listPostPage).toHaveBeenCalledWith({ limit: 20 });
  });

  it("returns a safe error when public Supabase configuration is unavailable", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(null);

    await expect(loadInitialCommunityFeed()).resolves.toEqual({
      status: "error",
      error: COMMUNITY_FAILURE_COPY.load,
    });
    expect(createSupabaseCommunityStore).not.toHaveBeenCalled();
  });

  it("does not expose a raw provider failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = storeWithList();
    vi.mocked(createServerSupabaseClient).mockResolvedValue({} as never);
    vi.mocked(createSupabaseCommunityStore).mockReturnValue(store);
    vi.mocked(store.listPostPage).mockRejectedValueOnce(
      new Error("provider table details"),
    );

    await expect(loadInitialCommunityFeed()).resolves.toEqual({
      status: "error",
      error: COMMUNITY_FAILURE_COPY.load,
    });
    expect(log).toHaveBeenCalledWith(
      "[community] server feed request failed",
      expect.any(Error),
    );
  });
});
