import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_COMMUNITY_POST_BODY_LENGTH,
  type CommunityPost,
  type UpdateCommunityPostInput,
} from "@/lib/community-contract";

import type { CommunityStore } from "./community-store";
import { ServerPostEditor } from "./server-post-editor";

const AUTHOR_ID = "11111111-1111-4111-8111-111111111111";
const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const post: CommunityPost = {
  id: POST_ID,
  author: { id: AUTHOR_ID, nickname: "작성자" },
  category: "커리어 질문",
  title: "수정 전 제목",
  body: "수정 전 본문",
  tags: ["백엔드"],
  metrics: { reactions: 1, comments: 2, saves: 3 },
  createdAt: "2026-07-21T04:00:00.000Z",
  updatedAt: "2026-07-21T04:00:00.000Z",
};

type PostEditorStore = Pick<CommunityStore, "updatePost">;

function renderEditor({
  store = {
    updatePost: vi.fn(async () => post),
  },
  viewerId = AUTHOR_ID,
}: {
  store?: PostEditorStore;
  viewerId?: string | null;
} = {}) {
  const onCancel = vi.fn();
  const onSaved = vi.fn();
  render(
    <ServerPostEditor
      onCancel={onCancel}
      onSaved={onSaved}
      post={post}
      store={store}
      viewerId={viewerId}
    />,
  );
  return { onCancel, onSaved, store };
}

describe("ServerPostEditor", () => {
  afterEach(cleanup);

  it("is visible only to the post author", () => {
    const { rerender } = render(
      <ServerPostEditor
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        post={post}
        store={{ updatePost: vi.fn(async () => post) }}
        viewerId="22222222-2222-4222-8222-222222222222"
      />,
    );

    expect(screen.queryByRole("region", { name: "글 수정" })).not.toBeInTheDocument();

    rerender(
      <ServerPostEditor
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        post={post}
        store={{ updatePost: vi.fn(async () => post) }}
        viewerId={AUTHOR_ID}
      />,
    );
    expect(screen.getByRole("region", { name: "글 수정" })).toBeInTheDocument();
  });

  it("validates normalized title, body, and tags before mutation", () => {
    const { store } = renderEditor();

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "x".repeat(MAX_COMMUNITY_POST_BODY_LENGTH + 1) },
    });
    fireEvent.change(screen.getByLabelText("태그 (선택)"), {
      target: { value: "백엔드, 백엔드" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 내용 저장" }));

    expect(screen.getByText(/제목을 입력해 주세요/)).toBeInTheDocument();
    expect(screen.getByText(/본문은 .*자까지/)).toBeInTheDocument();
    expect(screen.getByText(/태그는 중복 없이/)).toBeInTheDocument();
    expect(store.updatePost).not.toHaveBeenCalled();
  });

  it("cancels without mutating the server", () => {
    const { onCancel, store } = renderEditor();

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "저장하지 않을 제목" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 취소" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(store.updatePost).not.toHaveBeenCalled();
  });

  it("saves normalized fields and returns the persisted server record", async () => {
    const updated: CommunityPost = {
      ...post,
      category: "커리어 고민",
      title: "수정한 제목",
      body: "수정한 본문",
      tags: ["백엔드", "이직 준비"],
      updatedAt: "2026-07-22T04:00:00.000Z",
    };
    const updatePost = vi.fn(
      async (
        _authorId: string,
        _postId: string,
        _input: UpdateCommunityPostInput,
      ) => updated,
    );
    const { onSaved } = renderEditor({ store: { updatePost } });

    fireEvent.change(screen.getByLabelText("카테고리"), {
      target: { value: "커리어 고민" },
    });
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "  수정한 제목  " },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "  수정한 본문  " },
    });
    fireEvent.change(screen.getByLabelText("태그 (선택)"), {
      target: { value: "백엔드, 이직 준비" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 내용 저장" }));

    await waitFor(() =>
      expect(updatePost).toHaveBeenCalledWith(AUTHOR_ID, POST_ID, {
        category: "커리어 고민",
        title: "수정한 제목",
        body: "수정한 본문",
        tags: ["백엔드", "이직 준비"],
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it("keeps typed content recoverable after a server failure", async () => {
    const updatePost = vi.fn(async () => {
      throw new Error("offline");
    });
    renderEditor({ store: { updatePost } });

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "서버 재시도용 제목" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 내용 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "글을 수정하지 못했습니다",
    );
    expect(screen.getByLabelText("제목")).toHaveValue("서버 재시도용 제목");
    expect(screen.getByRole("region", { name: "글 수정" })).toBeInTheDocument();
  });
});
