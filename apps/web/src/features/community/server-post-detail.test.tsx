import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthViewerProvider } from "@/features/auth/auth-viewer-context";
import type {
  CommunityComment,
  CommunityPost,
  CreateCommunityCommentInput,
} from "@/lib/community-contract";
import { CommunityStoreError } from "@/lib/community-contract";

import type { CommunityStore } from "./community-store";
import { ServerPostDetail } from "./server-post-detail";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const post: CommunityPost = {
  id: POST_ID,
  author: { id: AUTHOR_ID, nickname: "실제작성자" },
  category: "커리어 질문",
  title: "서버 커뮤니티 상세",
  body: "실제 사용자가 계정에 저장한 본문입니다.",
  tags: ["백엔드"],
  metrics: { reactions: 4, comments: 1, saves: 2 },
  createdAt: "2026-07-21T04:00:00.000Z",
  updatedAt: "2026-07-21T04:00:00.000Z",
};

const comment: CommunityComment = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  postId: POST_ID,
  author: { id: AUTHOR_ID, nickname: "실제작성자" },
  body: "첫 번째 실제 댓글입니다.",
  createdAt: "2026-07-21T04:10:00.000Z",
  updatedAt: "2026-07-21T04:10:00.000Z",
};

function createStore() {
  return {
    searchPosts: vi.fn(async () => ({ items: [post], nextCursor: null })),
    listPostPage: vi.fn(async () => ({ items: [post], nextCursor: null })),
    listFollowingPostPage: vi.fn(async () => ({
      items: [post],
      nextCursor: null,
    })),
    listSavedPostPage: vi.fn(async () => ({ items: [post], nextCursor: null })),
    listPosts: vi.fn(async () => [post]),
    listSavedPosts: vi.fn(async () => [post]),
    getPost: vi.fn(async () => post),
    getComment: vi.fn(async () => comment),
    listCommentPage: vi.fn(async () => ({ items: [comment], nextCursor: null })),
    listComments: vi.fn(async () => [comment]),
    loadViewerState: vi.fn(async () => ({
      reactedPostIds: [POST_ID],
      savedPostIds: [],
      followedAuthorIds: [],
    })),
    createPost: vi.fn(async () => post),
    updatePost: vi.fn(async () => post),
    deletePost: vi.fn(async () => undefined),
    createComment: vi.fn(
      async (
        authorId: string,
        postId: string,
        input: CreateCommunityCommentInput,
      ): Promise<CommunityComment> => ({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        postId,
        author: { id: authorId, nickname: "나" },
        body: input.body,
        createdAt: "2026-07-21T05:00:00.000Z",
        updatedAt: "2026-07-21T05:00:00.000Z",
      }),
    ),
    updateComment: vi.fn(async () => comment),
    deleteComment: vi.fn(async () => undefined),
    setPostReaction: vi.fn(async () => undefined),
    setPostSaved: vi.fn(async () => undefined),
    setAuthorFollowed: vi.fn(async () => undefined),
    createReport: vi.fn(async () => undefined),
  } satisfies CommunityStore;
}

describe("ServerPostDetail", () => {
  afterEach(() => {
    cleanup();
    navigation.push.mockReset();
  });

  it("renders persisted content and keeps server counters consistent", async () => {
    const store = createStore();
    render(
      <AuthViewerProvider
        ready
        viewer={{ id: USER_ID, email: "viewer@example.com" }}
      >
        <ServerPostDetail postId={POST_ID} store={store} />
      </AuthViewerProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "서버 커뮤니티 상세",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(post.body)).toBeInTheDocument();
    expect(screen.queryByText(/예시 콘텐츠/)).not.toBeInTheDocument();

    const actions = screen.getByRole("region", { name: "글 반응과 댓글" });
    const reaction = within(actions).getByRole("button", { name: /공감 취소/ });
    expect(reaction).toHaveTextContent("공감 4");
    fireEvent.click(reaction);
    await waitFor(() =>
      expect(store.setPostReaction).toHaveBeenCalledWith(USER_ID, POST_ID, false),
    );
    expect(reaction).toHaveTextContent("공감 3");
  });

  it("creates an account comment and updates the visible count", async () => {
    const store = createStore();
    render(
      <AuthViewerProvider
        ready
        viewer={{ id: USER_ID, email: "viewer@example.com" }}
      >
        <ServerPostDetail postId={POST_ID} store={store} />
      </AuthViewerProvider>,
    );
    await screen.findByRole("heading", { level: 1, name: post.title });

    fireEvent.change(screen.getByRole("textbox", { name: "댓글 내용" }), {
      target: { value: "계정에 남길 댓글입니다." },
    });
    const submit = screen.getByRole("button", { name: "댓글 등록" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(await screen.findByText("계정에 남길 댓글입니다.")).toBeInTheDocument();
    expect(store.createComment).toHaveBeenCalledWith(USER_ID, POST_ID, {
      body: "계정에 남길 댓글입니다.",
    });
    expect(screen.getByText("댓글 2")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "댓글을 계정에 등록했습니다.",
    );
  });

  it("returns guest reactions and comments to the same post after login", async () => {
    const store = createStore();
    render(
      <AuthViewerProvider ready viewer={null}>
        <ServerPostDetail postId={POST_ID} store={store} />
      </AuthViewerProvider>,
    );
    await screen.findByRole("heading", { level: 1, name: post.title });

    fireEvent.click(screen.getByRole("button", { name: /공감$/ }));
    expect(navigation.push).toHaveBeenLastCalledWith(
      `/login?next=${encodeURIComponent(`/posts/${POST_ID}`)}`,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "댓글 내용" }), {
      target: { value: "로그인 뒤 남길 댓글" },
    });
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
    expect(navigation.push).toHaveBeenLastCalledWith(
      `/login?next=${encodeURIComponent(`/posts/${POST_ID}`)}`,
    );
    expect(store.setPostReaction).not.toHaveBeenCalled();
    expect(store.createComment).not.toHaveBeenCalled();
  });

  it("updates an author's rendered post immediately from the saved server record", async () => {
    const updated: CommunityPost = {
      ...post,
      category: "커리어 고민",
      title: "서버에서 돌아온 수정 제목",
      body: "서버에서 돌아온 수정 본문",
      tags: ["이직 준비"],
      updatedAt: "2026-07-22T04:00:00.000Z",
    };
    const store = createStore();
    store.updatePost.mockResolvedValue(updated);
    render(
      <AuthViewerProvider
        ready
        viewer={{ id: AUTHOR_ID, email: "author@example.com" }}
      >
        <ServerPostDetail postId={POST_ID} store={store} />
      </AuthViewerProvider>,
    );
    await screen.findByRole("heading", { level: 1, name: post.title });

    fireEvent.click(screen.getByRole("button", { name: "이 글 수정" }));
    fireEvent.change(screen.getByLabelText("카테고리"), {
      target: { value: "커리어 고민" },
    });
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "보낸 수정 제목" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "보낸 수정 본문" },
    });
    fireEvent.change(screen.getByLabelText("태그 (선택)"), {
      target: { value: "이직 준비" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 내용 저장" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "서버에서 돌아온 수정 제목",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("서버에서 돌아온 수정 본문")).toBeInTheDocument();
    expect(screen.getByText("#이직 준비")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "글 수정" }))
      .not.toBeInTheDocument();
    expect(store.updatePost).toHaveBeenCalledWith(AUTHOR_ID, POST_ID, {
      category: "커리어 고민",
      title: "보낸 수정 제목",
      body: "보낸 수정 본문",
      tags: ["이직 준비"],
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "글 수정 내용을 서버에 저장했습니다.",
    );
  });

  it("keeps the home-feed route available after an author deletes a post", async () => {
    const store = createStore();
    render(
      <AuthViewerProvider
        ready
        viewer={{ id: AUTHOR_ID, email: "author@example.com" }}
      >
        <ServerPostDetail postId={POST_ID} store={store} />
      </AuthViewerProvider>,
    );
    await screen.findByRole("heading", { level: 1, name: post.title });

    fireEvent.click(screen.getByRole("button", { name: "이 글 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 삭제" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "글을 삭제했습니다." }),
    ).toBeInTheDocument();
    expect(store.deletePost).toHaveBeenCalledWith(AUTHOR_ID, POST_ID);
    expect(screen.getByRole("link", { name: "홈 피드로 돌아가기" }))
      .toHaveAttribute("href", "/");
  });

  it("treats an already-removed post as missing instead of reporting a retryable failure", async () => {
    const store = createStore();
    store.deletePost.mockRejectedValueOnce(
      new CommunityStoreError("not_found", "이미 삭제됨"),
    );
    render(
      <AuthViewerProvider
        ready
        viewer={{ id: AUTHOR_ID, email: "author@example.com" }}
      >
        <ServerPostDetail postId={POST_ID} store={store} />
      </AuthViewerProvider>,
    );
    await screen.findByRole("heading", { level: 1, name: post.title });

    fireEvent.click(screen.getByRole("button", { name: "이 글 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 삭제" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "글을 찾을 수 없습니다.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/글을 삭제하지 못했습니다/)).not.toBeInTheDocument();
  });
});
