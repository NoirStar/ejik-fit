import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
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
  store = createStore(),
  viewerId = USER_ID,
}: {
  onCountChange?: (delta: number) => void;
  store?: CommentStore;
  viewerId?: string | null;
} = {}) {
  render(
    <ServerCommentList
      onCountChange={onCountChange}
      postId={POST_ID}
      store={store}
      totalCount={2}
      viewerId={viewerId}
    />,
  );
  return { onCountChange, store };
}

describe("ServerCommentList", () => {
  afterEach(cleanup);

  it("loads the first server page", async () => {
    const store = createStore();
    renderList({ store });

    expect(await screen.findByText("첫 댓글")).toBeInTheDocument();
    expect(store.listCommentPage).toHaveBeenCalledWith({
      postId: POST_ID,
      limit: 20,
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
      limit: 20,
      before,
    });
    expect(screen.queryByRole("button", { name: "댓글 더 보기" }))
      .not.toBeInTheDocument();
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
      "댓글을 수정하지 못했습니다",
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

    fireEvent.click(
      screen.getByRole("button", { name: "삭제할 댓글 댓글 삭제" }),
    );
    await waitFor(() => expect(screen.queryByText("삭제할 댓글")).not.toBeInTheDocument());
    expect(store.deleteComment).toHaveBeenCalledWith(USER_ID, FIRST_ID);
    expect(onCountChange).toHaveBeenCalledWith(-1);
  });
});
