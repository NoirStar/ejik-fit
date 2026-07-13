import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_LOCAL_COMMENT_LENGTH,
  addLocalPostComment,
  togglePostReaction,
  togglePostSave,
} from "@/lib/social-interactions";

import { PostDetailActions } from "./post-detail-actions";

const props = {
  postId: "career-move-3y-backend",
  postTitle: "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?",
  metrics: { reactions: 32, comments: 47, saves: 18 },
  sampleComments: [
    {
      id: "sample-comment-1",
      authorName: "배포전확인",
      authorHeadline: "서버 개발자 · 6년차",
      authorTone: "blue" as const,
      body: "역할 범위를 먼저 확인했습니다.",
      createdLabel: "1시간 전",
    },
  ],
};

describe("PostDetailActions", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("hydrates saved reactions, saves, and browser comments", async () => {
    togglePostReaction(props.postId);
    togglePostSave(props.postId);
    addLocalPostComment(props.postId, "이 브라우저 댓글", {
      createdAt: "2026-07-14T01:02:03.000Z",
      id: "local-comment-1",
    });

    render(<PostDetailActions {...props} />);

    expect(
      await screen.findByRole("button", { name: `${props.postTitle} 공감 취소` }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: `${props.postTitle} 저장 해제` }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("이 브라우저 댓글")).toBeInTheDocument();
    expect(screen.getByText("공감 33")).toBeInTheDocument();
    expect(screen.getByText("댓글 48")).toBeInTheDocument();
    expect(screen.getByText("저장 19")).toBeInTheDocument();
  });

  it("persists reaction and save toggles", () => {
    render(<PostDetailActions {...props} />);

    const reaction = screen.getByRole("button", {
      name: `${props.postTitle} 공감`,
    });
    const save = screen.getByRole("button", {
      name: `${props.postTitle} 저장`,
    });
    fireEvent.click(reaction);
    fireEvent.click(save);

    expect(reaction).toHaveAttribute("aria-pressed", "true");
    expect(save).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("ejik-fit:social-interactions")).toContain(
      props.postId,
    );
  });

  it("validates and stores a browser-only comment", async () => {
    render(<PostDetailActions {...props} />);

    const textarea = screen.getByRole("textbox", { name: "댓글 내용" });
    const submit = screen.getByRole("button", { name: "댓글 등록" });
    fireEvent.click(submit);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "댓글 내용을 입력해 주세요.",
    );

    fireEvent.change(textarea, { target: { value: " 경험 공유 감사합니다. " } });
    fireEvent.click(submit);

    expect(await screen.findByText("경험 공유 감사합니다.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "이 브라우저에 댓글을 저장했습니다.",
    );
    expect(textarea).toHaveValue("");
    expect(screen.getByText("댓글 48")).toBeInTheDocument();
  });

  it("does not claim a blocked browser write succeeded", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    render(<PostDetailActions {...props} />);

    const save = screen.getByRole("button", {
      name: `${props.postTitle} 저장`,
    });
    fireEvent.click(save);
    expect(save).toHaveAttribute("aria-pressed", "false");

    const textarea = screen.getByRole("textbox", { name: "댓글 내용" });
    fireEvent.change(textarea, {
      target: { value: "저장 시도" },
    });
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "브라우저 저장소를 사용할 수 없습니다.",
    );
    expect(textarea).toHaveValue("저장 시도");
    expect(screen.getByRole("list", { name: "댓글 목록" })).not.toHaveTextContent(
      "저장 시도",
    );
  });

  it("defensively rejects a comment beyond the browser input limit", () => {
    render(<PostDetailActions {...props} />);

    const textarea = screen.getByRole("textbox", { name: "댓글 내용" });
    fireEvent.change(textarea, {
      target: { value: "가".repeat(MAX_LOCAL_COMMENT_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      `댓글은 ${MAX_LOCAL_COMMENT_LENGTH}자까지 입력할 수 있습니다.`,
    );
    expect(localStorage.getItem("ejik-fit:social-interactions")).toBeNull();
  });

  it("reacts to interaction changes elsewhere in the same tab", async () => {
    render(<PostDetailActions {...props} />);

    act(() => {
      togglePostReaction(props.postId);
      togglePostSave(props.postId);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: `${props.postTitle} 공감 취소` }),
      ).toHaveAttribute("aria-pressed", "true");
    });
    expect(
      screen.getByRole("button", { name: `${props.postTitle} 저장 해제` }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("labels all built-in discussion as sample content", () => {
    render(<PostDetailActions {...props} />);

    expect(screen.getByText("대표 예시 댓글")).toBeInTheDocument();
    expect(
      screen.getByText(/실제 사용자가 작성한 댓글이 아닙니다/),
    ).toBeInTheDocument();
  });
});
