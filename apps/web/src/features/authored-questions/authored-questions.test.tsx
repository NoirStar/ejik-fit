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
    render(<AuthoredQuestions />);

    expect(
      screen.getByRole("heading", { level: 1, name: "내 글" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("이 브라우저에서 작성한 글이 없습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "첫 글 작성" }),
    ).toHaveAttribute("href", "/?compose=1");
    expect(screen.getByText(/서버 계정과 동기화되지 않습니다/)).toBeInTheDocument();
  });

  it("lists newest questions with browser-owned interaction facts", async () => {
    storePosts();
    render(<AuthoredQuestions />);

    const articles = await screen.findAllByRole("article");
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveAccessibleName("최근 작성한 기술 질문");
    expect(articles[1]).toHaveAccessibleName("먼저 작성한 이직 질문");

    const newest = within(articles[0]);
    expect(
      newest.getByRole("link", { name: "최근 작성한 기술 질문" }),
    ).toHaveAttribute("href", "/posts/local-newer-question");
    expect(newest.getByText("Kubernetes")).toBeInTheDocument();
    expect(newest.getByText("면접 후기 · 이 브라우저에서 작성")).toBeInTheDocument();
    expect(newest.getByText("공감 1")).toBeInTheDocument();
    expect(newest.getByText("댓글 1")).toBeInTheDocument();
    expect(newest.getByText("저장됨")).toBeInTheDocument();
    expect(screen.getByText("이 브라우저에 2개 저장")).toBeInTheDocument();
  });

  it("reacts to a question created elsewhere in the same browser tab", async () => {
    render(<AuthoredQuestions />);
    await screen.findByText("이 브라우저에서 작성한 글이 없습니다.");

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

    expect(
      await screen.findByRole("article", { name: "보관함 동기화 질문" }),
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
    render(<AuthoredQuestions />);

    const newest = await screen.findByRole("article", {
      name: "최근 작성한 기술 질문",
    });
    fireEvent.click(
      within(newest).getByRole("button", {
        name: "최근 작성한 기술 질문 삭제",
      }),
    );
    expect(
      within(newest).getByText("삭제하면 댓글과 반응도 함께 지워집니다."),
    ).toBeInTheDocument();
    fireEvent.click(within(newest).getByRole("button", { name: "삭제 취소" }));
    expect(
      within(newest).queryByText("삭제하면 댓글과 반응도 함께 지워집니다."),
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
      "최근 작성한 기술 질문을 이 브라우저에서 삭제했습니다.",
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
    render(<AuthoredQuestions />);

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
    const store = {
      listPosts: vi.fn(async () => [post]),
      listSavedPosts: vi.fn(async () => [post]),
      getPost: vi.fn(async () => post),
      getComment: vi.fn(async () => null),
      listComments: vi.fn(async () => []),
      loadViewerState: vi.fn(async () => ({
        reactedPostIds: [],
        savedPostIds: [post.id],
        followedAuthorIds: [],
      })),
      createPost: vi.fn(
        async (_authorId: string, _input: CreateCommunityPostInput) => post,
      ),
      deletePost: vi.fn(async () => undefined),
      createComment: vi.fn(async () => {
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
    expect(store.listPosts).toHaveBeenCalledWith({ authorId: userId, limit: 50 });
    expect(within(article).getByText("공감 3")).toBeInTheDocument();
    expect(within(article).getByText("댓글 2")).toBeInTheDocument();
    expect(within(article).getByText("저장됨")).toBeInTheDocument();
    expect(screen.getByText("계정에 1개 작성")).toBeInTheDocument();

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
