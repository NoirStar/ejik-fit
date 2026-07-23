import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CommunityStoreError,
  MAX_COMMUNITY_COMMENT_LENGTH,
  type CommunityComment,
  type CommunityCursor,
} from "@/lib/community-contract";

import type { CommunityStore } from "./community-store";
import { ServerCommentList } from "./server-comment-list";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function comment(
  id: string,
  body: string,
  authorId = OTHER_ID,
  createdAt = "2026-07-21T04:10:00.000Z",
): CommunityComment {
  return {
    id,
    postId: POST_ID,
    author: {
      id: authorId,
      nickname: authorId === USER_ID ? "나" : "다른작성자",
    },
    body,
    createdAt,
    updatedAt: createdAt,
  };
}

const FIRST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECOND_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const THIRD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SECOND_POST_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

type CommentStore = Pick<
  CommunityStore,
  "createComment" | "deleteComment" | "listCommentPage" | "updateComment"
>;

function createStore(overrides: Partial<CommentStore> = {}): CommentStore {
  return {
    createComment: vi.fn(async (_viewerId, postId, input) => ({
      ...comment(THIRD_ID, input.body, USER_ID, "2026-07-21T05:00:00.000Z"),
      postId,
    })),
    deleteComment: vi.fn(async () => undefined),
    listCommentPage: vi.fn(async () => ({
      items: [comment(FIRST_ID, "첫 댓글")],
      nextCursor: null as CommunityCursor | null,
    })),
    updateComment: vi.fn(async (_viewerId, id, body) => ({
      ...comment(id, body, USER_ID),
      updatedAt: "2026-07-21T05:10:00.000Z",
    })),
    ...overrides,
  };
}

function renderList({
  onCountChange = vi.fn(),
  postId = POST_ID,
  store = createStore(),
  viewerId = USER_ID,
}: {
  onCountChange?: (delta: number) => void;
  postId?: string;
  store?: CommentStore;
  viewerId?: string | null;
} = {}) {
  const rendered = render(
    <ServerCommentList
      onCountChange={onCountChange}
      postId={postId}
      store={store}
      totalCount={2}
      viewerId={viewerId}
    />,
  );
  return { ...rendered, onCountChange, store };
}

describe("ServerCommentList", () => {
  afterEach(cleanup);

  it("loads the first server page", async () => {
    const store = createStore();
    renderList({ store });

    expect(await screen.findByText("첫 댓글")).toBeInTheDocument();
    expect(store.listCommentPage).toHaveBeenCalledWith({
      postId: POST_ID,
      limit: 30,
    });
    expect(screen.getByText("1개 표시 · 전체 2개")).toBeInTheDocument();
  });

  it("loads later pages, deduplicates records, and keeps newest-first order", async () => {
    const before = {
      createdAt: "2026-07-21T04:10:00.000Z",
      id: FIRST_ID,
    };
    const first = comment(
      FIRST_ID,
      "최신 댓글",
      OTHER_ID,
      "2026-07-21T04:10:00.000Z",
    );
    const older = comment(
      SECOND_ID,
      "이전 댓글",
      OTHER_ID,
      "2026-07-20T04:10:00.000Z",
    );
    const listCommentPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [first], nextCursor: before })
      .mockResolvedValueOnce({ items: [first, older], nextCursor: null });
    const store = createStore({ listCommentPage });
    renderList({ store });

    await screen.findByText("최신 댓글");
    fireEvent.click(screen.getByRole("button", { name: "댓글 더 보기" }));

    expect(await screen.findByText("이전 댓글")).toBeInTheDocument();
    expect(screen.getAllByText("최신 댓글")).toHaveLength(1);
    expect(
      within(screen.getByRole("list", { name: "댓글 목록" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("최신 댓글"),
      expect.stringContaining("이전 댓글"),
    ]);
    expect(listCommentPage).toHaveBeenLastCalledWith({
      postId: POST_ID,
      limit: 30,
      before,
    });
    expect(screen.queryByRole("button", { name: "댓글 더 보기" }))
      .not.toBeInTheDocument();
  });

  it("ignores an older page after the component moves to another post", async () => {
    const before = { createdAt: comment(FIRST_ID, "첫 댓글").createdAt, id: FIRST_ID };
    const stalePage = deferred<{
      items: CommunityComment[];
      nextCursor: null;
    }>();
    const listCommentPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [comment(FIRST_ID, "첫 글의 댓글")],
        nextCursor: before,
      })
      .mockImplementationOnce(() => stalePage.promise)
      .mockResolvedValueOnce({
        items: [
          {
            ...comment(SECOND_ID, "두 번째 글의 댓글"),
            postId: SECOND_POST_ID,
          },
        ],
        nextCursor: null,
      });
    const store = createStore({ listCommentPage });
    const rendered = renderList({ store });
    await screen.findByText("첫 글의 댓글");

    fireEvent.click(screen.getByRole("button", { name: "댓글 더 보기" }));
    await waitFor(() => expect(listCommentPage).toHaveBeenCalledTimes(2));
    rendered.rerender(
      <ServerCommentList
        onCountChange={rendered.onCountChange}
        postId={SECOND_POST_ID}
        store={store}
        totalCount={1}
        viewerId={USER_ID}
      />,
    );
    expect(await screen.findByText("두 번째 글의 댓글")).toBeInTheDocument();

    await act(async () => {
      stalePage.resolve({
        items: [comment(THIRD_ID, "늦게 도착한 첫 글의 댓글")],
        nextCursor: null,
      });
      await stalePage.promise;
    });
    await waitFor(() =>
      expect(
        screen.queryByText("늦게 도착한 첫 글의 댓글"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("두 번째 글의 댓글")).toBeInTheDocument();
  });

  it("offers edit and delete controls only for the comment author", async () => {
    const mine = comment(FIRST_ID, "내 댓글", USER_ID);
    const theirs = comment(SECOND_ID, "다른 댓글", OTHER_ID);
    renderList({
      store: createStore({
        listCommentPage: vi.fn(async () => ({
          items: [mine, theirs],
          nextCursor: null,
        })),
      }),
    });

    await screen.findByText("내 댓글");
    expect(screen.getByRole("button", { name: "내 댓글 댓글 수정" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 댓글 댓글 삭제" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다른 댓글 댓글 수정" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다른 댓글 댓글 삭제" }))
      .not.toBeInTheDocument();
  });

  it("validates edits and cancels without a mutation", async () => {
    const mine = comment(FIRST_ID, "내 댓글", USER_ID);
    const store = createStore({
      listCommentPage: vi.fn(async () => ({ items: [mine], nextCursor: null })),
    });
    renderList({ store });
    await screen.findByText("내 댓글");

    fireEvent.click(screen.getByRole("button", { name: "내 댓글 댓글 수정" }));
    const editor = screen.getByRole("textbox", { name: "댓글 수정 내용" });
    fireEvent.change(editor, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(screen.getByRole("alert")).toHaveTextContent("댓글 내용을 입력해 주세요");

    fireEvent.change(editor, {
      target: { value: "x".repeat(MAX_COMMUNITY_COMMENT_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      `${MAX_COMMUNITY_COMMENT_LENGTH}자까지`,
    );

    fireEvent.click(screen.getByRole("button", { name: "수정 취소" }));
    expect(screen.queryByRole("textbox", { name: "댓글 수정 내용" }))
      .not.toBeInTheDocument();
    expect(store.updateComment).not.toHaveBeenCalled();
  });

  it("uses the returned server record after a successful edit", async () => {
    const mine = comment(FIRST_ID, "수정 전 댓글", USER_ID);
    const updated = {
      ...mine,
      body: "서버가 반환한 수정 댓글",
      updatedAt: "2026-07-21T06:00:00.000Z",
    };
    const updateComment = vi.fn(async () => updated);
    renderList({
      store: createStore({
        listCommentPage: vi.fn(async () => ({ items: [mine], nextCursor: null })),
        updateComment,
      }),
    });
    await screen.findByText("수정 전 댓글");

    fireEvent.click(
      screen.getByRole("button", { name: "수정 전 댓글 댓글 수정" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "댓글 수정 내용" }), {
      target: { value: "  보낼 수정 댓글  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    expect(await screen.findByText("서버가 반환한 수정 댓글")).toBeInTheDocument();
    expect(updateComment).toHaveBeenCalledWith(USER_ID, FIRST_ID, "보낼 수정 댓글");
    expect(screen.queryByRole("textbox", { name: "댓글 수정 내용" }))
      .not.toBeInTheDocument();
  });

  it("keeps a failed edit open with the typed content", async () => {
    const mine = comment(FIRST_ID, "수정 전 댓글", USER_ID);
    const updateComment = vi.fn(async () => {
      throw new Error("offline");
    });
    renderList({
      store: createStore({
        listCommentPage: vi.fn(async () => ({ items: [mine], nextCursor: null })),
        updateComment,
      }),
    });
    await screen.findByText("수정 전 댓글");

    fireEvent.click(
      screen.getByRole("button", { name: "수정 전 댓글 댓글 수정" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "댓글 수정 내용" }), {
      target: { value: "실패해도 남아야 하는 댓글" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "댓글을 수정하지 못했습니다. 작성 내용은 그대로 두었습니다.",
    );
    expect(screen.getByRole("textbox", { name: "댓글 수정 내용" }))
      .toHaveValue("실패해도 남아야 하는 댓글");
  });

  it("creates and deletes server comments while reporting count changes", async () => {
    const mine = comment(FIRST_ID, "삭제할 댓글", USER_ID);
    const onCountChange = vi.fn();
    const store = createStore({
      listCommentPage: vi.fn(async () => ({ items: [mine], nextCursor: null })),
    });
    renderList({ onCountChange, store });
    await screen.findByText("삭제할 댓글");

    fireEvent.change(screen.getByRole("textbox", { name: "댓글 내용" }), {
      target: { value: "새 서버 댓글" },
    });
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
    expect(await screen.findByText("새 서버 댓글")).toBeInTheDocument();
    expect(onCountChange).toHaveBeenCalledWith(1);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("댓글을 등록했습니다.");
    expect(status.className).toContain("srOnly");

    fireEvent.click(
      screen.getByRole("button", { name: "삭제할 댓글 댓글 삭제" }),
    );
    await waitFor(() => expect(screen.queryByText("삭제할 댓글")).not.toBeInTheDocument());
    expect(store.deleteComment).toHaveBeenCalledWith(USER_ID, FIRST_ID);
    expect(onCountChange).toHaveBeenCalledWith(-1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps a failed comment draft and announces only a successful retry", async () => {
    let attempt = 0;
    const createComment: CommentStore["createComment"] = vi.fn(
      async (_viewerId, postId, input) => {
        attempt += 1;
        if (attempt === 1) throw new Error("offline");
        return {
          ...comment(THIRD_ID, input.body, USER_ID),
          postId,
        };
      },
    );
    renderList({ store: createStore({ createComment }) });
    await screen.findByText("첫 댓글");

    const textarea = screen.getByRole("textbox", { name: "댓글 내용" });
    fireEvent.change(textarea, { target: { value: "재시도할 댓글" } });
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "댓글을 등록하지 못했습니다. 작성 내용은 그대로 두었습니다.",
    );
    expect(textarea).toHaveValue("재시도할 댓글");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
    expect(await screen.findByText("재시도할 댓글")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("댓글을 등록했습니다.");
    expect(status.className).toContain("srOnly");
    expect(createComment).toHaveBeenCalledTimes(2);
  });

  it("uses a Unicode ellipsis while comment registration is pending", async () => {
    const pending = deferred<CommunityComment>();
    const store = createStore({
      createComment: vi.fn(() => pending.promise),
    });
    renderList({ store });
    await screen.findByText("첫 댓글");

    fireEvent.change(screen.getByRole("textbox", { name: "댓글 내용" }), {
      target: { value: "등록을 기다리는 댓글" },
    });
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));

    expect(screen.getByRole("button", { name: "등록 중…" })).toBeDisabled();
    expect(screen.queryByText(/등록 중\.\.\./)).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve(comment(THIRD_ID, "등록을 기다리는 댓글", USER_ID));
      await pending.promise;
    });
    expect(await screen.findByText("등록을 기다리는 댓글")).toBeInTheDocument();
  });

  it("removes a stale comment when the server reports it was already deleted", async () => {
    const mine = comment(FIRST_ID, "이미 지워진 댓글", USER_ID);
    const onCountChange = vi.fn();
    const store = createStore({
      deleteComment: vi.fn(async () => {
        throw new CommunityStoreError("not_found", "이미 삭제됨");
      }),
      listCommentPage: vi.fn(async () => ({ items: [mine], nextCursor: null })),
    });
    renderList({ onCountChange, store });
    await screen.findByText(mine.body);

    fireEvent.click(
      screen.getByRole("button", { name: `${mine.body} 댓글 삭제` }),
    );

    await waitFor(() => expect(screen.queryByText(mine.body)).not.toBeInTheDocument());
    expect(onCountChange).toHaveBeenCalledWith(-1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이미 삭제된 댓글이라 목록에서 정리했습니다.",
    );
  });
});
