import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthViewerProvider } from "@/features/auth/auth-viewer-context";
import type { CommunityStore } from "@/features/community/community-store";
import type {
  CommunityPost,
  CreateCommunityPostInput,
} from "@/lib/community-contract";
import { createLocalCommunityPost } from "@/lib/local-community-posts";

import { AuthoredQuestions } from "./authored-questions";

function renderGuest() {
  return render(
    <AuthViewerProvider ready viewer={null}>
      <AuthoredQuestions />
    </AuthViewerProvider>,
  );
}

function storePosts() {
  window.localStorage.setItem(
    "ejik-fit:local-community-posts",
    JSON.stringify([
      {
        id: "local-older-question",
        title: "먼저 작성한 이직 질문",
        body: "첫 번째 질문 본문입니다.",
        tags: ["이직 준비"],
        createdAt: "2026-07-13T01:00:00.000Z",
      },
      {
        id: "local-newer-question",
        category: "면접 후기",
        title: "최근 작성한 기술 질문",
        body: "실제 공고의 필수 기술을 어떻게 준비할지 궁금합니다.",
        tags: ["Kubernetes", "백엔드"],
        createdAt: "2026-07-14T01:00:00.000Z",
      },
    ]),
  );
  window.localStorage.setItem(
    "ejik-fit:social-interactions",
    JSON.stringify({
      reactedPostIds: ["local-newer-question"],
      savedPostIds: ["local-newer-question"],
      commentsByPostId: {
        "local-newer-question": [
          {
            id: "local-comment-one",
            body: "첫 댓글",
            createdAt: "2026-07-14T02:00:00.000Z",
          },
        ],
      },
    }),
  );
}

describe("AuthoredQuestions", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows an honest empty state with a route to the existing composer", async () => {
    renderGuest();

    expect(
      screen.getByRole("heading", { level: 1, name: "내 글" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("계정에 연결하면 내 글을 모든 기기에서 볼 수 있습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "로그인하고 내 글 보기" }),
    ).toHaveAttribute("href", "/login?next=%2Fcareer%2Fquestions");
    expect(
      screen.queryByText(/커뮤니티 새 글을 불러오지 못했습니다/),
    ).not.toBeInTheDocument();
  });

  it("does not present an authentication outage as a signed-out empty state", () => {
    render(
      <AuthViewerProvider
        error="로그인 상태를 확인하지 못했습니다."
        ready
        status="error"
        viewer={null}
      >
        <AuthoredQuestions />
      </AuthViewerProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "로그인 상태를 확인하지 못했습니다.",
    );
    expect(
      screen.queryByRole("link", { name: /로그인하고 내 글 보기/ }),
    ).not.toBeInTheDocument();
  });

  it("shows one writing action when the account has no authored posts", async () => {
    const store = {
      listPostPage: vi.fn(async () => ({ items: [], nextCursor: null })),
      loadViewerState: vi.fn(async () => ({
        reactedPostIds: [],
        savedPostIds: [],
        followedAuthorIds: [],
      })),
    } as unknown as CommunityStore;

    render(
      <AuthViewerProvider
        ready
        viewer={{ id: "viewer-1", email: "viewer@example.com" }}
      >
        <AuthoredQuestions communityStore={store} />
      </AuthViewerProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "작성한 글이 없습니다." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute(
      "href",
      "/?compose=1",
    );
    expect(screen.getAllByRole("link", { name: "글쓰기" })).toHaveLength(1);
  });

  it("keeps legacy browser questions in a recovery-only section", async () => {
    storePosts();
    renderGuest();

    const recovery = await screen.findByRole("region", {
      name: "이전 기기 저장 글",
    });
    const articles = within(recovery).getAllByRole("article");
    expect(articles).toHaveLength(2);

    const newest = within(articles[0]);
    expect(
      newest.getByRole("link", { name: "최근 작성한 기술 질문" }),
    ).toHaveAttribute("href", "/posts/local-newer-question");
    expect(newest.getByText("Kubernetes")).toBeInTheDocument();
    expect(newest.getByText("면접 후기 · 이전 기기 저장")).toBeInTheDocument();
    expect(newest.queryByText(/공감|댓글|저장됨/)).not.toBeInTheDocument();
    expect(screen.getByText("복구할 글 2개")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "계정에 작성한 글" }))
        .queryByRole("article"),
    ).not.toBeInTheDocument();
  });

  it("reacts to a question created elsewhere in the same browser tab", async () => {
    renderGuest();
    await screen.findByRole("link", { name: "로그인하고 내 글 보기" });

    createLocalCommunityPost(
      {
        title: "보관함 동기화 질문",
        body: "다른 화면에서 작성했습니다.",
        tags: ["동기화"],
      },
      {
        id: "local-synced-question",
        createdAt: "2026-07-14T03:00:00.000Z",
      },
    );

    const recovery = await screen.findByRole("region", {
      name: "이전 기기 저장 글",
    });
    expect(
      within(recovery).getByRole("article", { name: "보관함 동기화 질문" }),
    ).toBeInTheDocument();
  });

  it("requires confirmation and removes the post, interactions, and recent topic", async () => {
    storePosts();
    window.localStorage.setItem(
      "ejik-fit:recent-community-topics",
      JSON.stringify([
        {
          postId: "local-newer-question",
          title: "최근 작성한 기술 질문",
          topicLabel: "Kubernetes",
          source: "local",
          viewedAt: "2026-07-14T03:00:00.000Z",
        },
      ]),
    );
    renderGuest();

    const newest = await screen.findByRole("article", {
      name: "최근 작성한 기술 질문",
    });
    fireEvent.click(
      within(newest).getByRole("button", {
        name: "최근 작성한 기술 질문 삭제",
      }),
    );
    expect(
      within(newest).getByText(/삭제하면 .*댓글과 반응도 함께 지워집니다/),
    ).toBeInTheDocument();
    fireEvent.click(within(newest).getByRole("button", { name: "삭제 취소" }));
    expect(
      within(newest).queryByText(/삭제하면 .*댓글과 반응도 함께 지워집니다/),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(newest).getByRole("button", {
        name: "최근 작성한 기술 질문 삭제",
      }),
    );
    fireEvent.click(within(newest).getByRole("button", { name: "정말 삭제" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("article", { name: "최근 작성한 기술 질문" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "최근 작성한 기술 질문을 이 기기에서 삭제했습니다.",
    );
    expect(
      JSON.parse(
        window.localStorage.getItem("ejik-fit:social-interactions") ?? "{}",
      ),
    ).not.toMatchObject({
      reactedPostIds: ["local-newer-question"],
      savedPostIds: ["local-newer-question"],
      commentsByPostId: { "local-newer-question": expect.anything() },
    });
    expect(
      JSON.parse(
        window.localStorage.getItem("ejik-fit:recent-community-topics") ??
          "[]",
      ),
    ).toEqual([]);
  });

  it.each([
    { expected: "기술을 이 기기에서 삭제했습니다.", id: "local-particle-1", title: "기술" },
    { expected: "자바를 이 기기에서 삭제했습니다.", id: "local-particle-2", title: "자바" },
    { expected: "React를 이 기기에서 삭제했습니다.", id: "local-particle-3", title: "React" },
  ])("uses the correct object particle when deleting $title", async ({ expected, id, title }) => {
    window.localStorage.setItem(
      "ejik-fit:local-community-posts",
      JSON.stringify([
        {
          id,
          title,
          body: "조사 메시지를 확인하는 글입니다.",
          tags: [],
          createdAt: "2026-07-14T01:00:00.000Z",
        },
      ]),
    );
    renderGuest();
    const article = await screen.findByRole("article", { name: title });

    fireEvent.click(
      within(article).getByRole("button", { name: `${title} 삭제` }),
    );
    fireEvent.click(
      within(article).getByRole("button", { name: "정말 삭제" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(expected);
  });

  it("keeps a question visible when interaction cleanup cannot be persisted", async () => {
    storePosts();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === "ejik-fit:social-interactions") {
        throw new DOMException("blocked", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    });
    renderGuest();

    const newest = await screen.findByRole("article", {
      name: "최근 작성한 기술 질문",
    });
    fireEvent.click(
      within(newest).getByRole("button", {
        name: "최근 작성한 기술 질문 삭제",
      }),
    );
    fireEvent.click(within(newest).getByRole("button", { name: "정말 삭제" }));

    expect(newest).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "댓글과 반응을 정리하지 못해 삭제를 중단했습니다.",
    );
  });

  it("lists and deletes signed-in account posts from the server store", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const post: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: { id: userId, nickname: "나" },
      category: "커리어 질문",
      title: "계정에 작성한 질문",
      body: "어느 기기에서도 확인할 수 있는 본문입니다.",
      tags: ["백엔드"],
      metrics: { reactions: 3, comments: 2, saves: 1 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };
    const olderPost: CommunityPost = {
      ...post,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "계정에 작성한 두 번째 질문",
      createdAt: "2026-07-20T04:00:00.000Z",
      updatedAt: "2026-07-20T04:00:00.000Z",
    };
    const firstCursor = { createdAt: post.createdAt, id: post.id };
    const store = {
      searchPosts: vi.fn(async () => ({ items: [post], nextCursor: null })),
      listPostPage: vi
        .fn()
        .mockResolvedValueOnce({ items: [post], nextCursor: firstCursor })
        .mockResolvedValueOnce({ items: [olderPost], nextCursor: null }),
      listFollowingPostPage: vi.fn(async () => ({
        items: [post],
        nextCursor: null,
      })),
      listSavedPostPage: vi.fn(async () => ({
        items: [post],
        nextCursor: null,
      })),
      listPosts: vi.fn(async () => [post]),
      listSavedPosts: vi.fn(async () => [post]),
      getPost: vi.fn(async () => post),
      getComment: vi.fn(async () => null),
      listCommentPage: vi.fn(async () => ({ items: [], nextCursor: null })),
      listComments: vi.fn(async () => []),
      loadViewerState: vi.fn(async () => ({
        reactedPostIds: [],
        savedPostIds: [post.id],
        followedAuthorIds: [],
      })),
      createPost: vi.fn(
        async (_authorId: string, _input: CreateCommunityPostInput) => post,
      ),
      updatePost: vi.fn(async () => post),
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

    render(
      <AuthViewerProvider
        ready
        viewer={{ id: userId, email: "viewer@example.com" }}
      >
        <AuthoredQuestions communityStore={store} />
      </AuthViewerProvider>,
    );

    const article = await screen.findByRole("article", {
      name: post.title,
    });
    expect(store.listPostPage).toHaveBeenCalledWith({ authorId: userId, limit: 20 });
    expect(within(article).getByText("공감 3")).toBeInTheDocument();
    expect(within(article).getByText("댓글 2")).toBeInTheDocument();
    expect(within(article).getByText("저장됨")).toBeInTheDocument();
    expect(screen.getByText("계정 글 1+개")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "내 글 더 보기" }));
    expect(
      await screen.findByRole("article", { name: olderPost.title }),
    ).toBeInTheDocument();
    expect(store.listPostPage).toHaveBeenLastCalledWith({
      authorId: userId,
      before: firstCursor,
      limit: 20,
    });
    expect(screen.getByText("계정 글 2개")).toBeInTheDocument();

    fireEvent.click(
      within(article).getByRole("button", { name: `${post.title} 삭제` }),
    );
    fireEvent.click(within(article).getByRole("button", { name: "정말 삭제" }));

    await waitFor(() => {
      expect(store.deletePost).toHaveBeenCalledWith(userId, post.id);
      expect(
        screen.queryByRole("article", { name: post.title }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      `${post.title}을 계정에서 삭제했습니다.`,
    );
  });
});
