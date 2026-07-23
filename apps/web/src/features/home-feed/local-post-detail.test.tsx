import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalCommunityPost } from "@/lib/local-community-posts";
import { readRecentCommunityTopics } from "@/lib/recent-community-topics";
import {
  addLocalPostComment,
  togglePostReaction,
  togglePostSave,
} from "@/lib/social-interactions";

import { LocalPostDetail } from "./local-post-detail";

const postId = "local-detail-post";

function createPost() {
  return createLocalCommunityPost(
    {
      title: "브라우저에 저장한 이직 질문",
      body: "실제 공고를 비교한 다음 준비 순서가 궁금합니다.",
      tags: ["이직 준비", "백엔드"],
    },
    {
      id: postId,
      createdAt: "2026-07-14T01:02:03.000Z",
    },
  );
}

describe("LocalPostDetail", () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a transparent browser-owned reading experience", async () => {
    createPost();
    render(<LocalPostDetail postId={postId} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "브라우저에 저장한 이직 질문",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("이 기기에 남은 글", { exact: true }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { level: 2, name: "이 기기에 남은 글" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("실제 공고를 비교한 다음 준비 순서가 궁금합니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("이 브라우저에서 직접 작성하고 저장한 커뮤니티 글입니다."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "글 반응과 댓글" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "댓글" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /공감|댓글 등록/ }))
      .not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "브라우저에 저장한 이직 질문 저장",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/예시 콘텐츠/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /팔로우/ })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(readRecentCommunityTopics()).toEqual([
        expect.objectContaining({
          postId,
          title: "브라우저에 저장한 이직 질문",
          topicLabel: "이직 준비",
          source: "local",
        }),
      ]),
    );
  });

  it("shows an honest local empty state when the post is unavailable", async () => {
    render(<LocalPostDetail postId="local-missing-post" />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "이 기기에서 글을 찾을 수 없습니다.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈 피드로 돌아가기" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("deletes the post and every interaction owned by it", async () => {
    createPost();
    togglePostReaction(postId);
    togglePostSave(postId);
    addLocalPostComment(postId, "함께 지워질 댓글", {
      id: "local-owned-comment",
      createdAt: "2026-07-14T02:00:00.000Z",
    });
    render(<LocalPostDetail postId={postId} />);
    await screen.findByRole("heading", {
      level: 1,
      name: "브라우저에 저장한 이직 질문",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "브라우저에 저장한 이직 질문 삭제" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "글을 삭제했습니다." }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("ejik-fit:local-community-posts")).toBe("[]");
    expect(localStorage.getItem("ejik-fit:social-interactions")).toBe("{\"reactedPostIds\":[],\"savedPostIds\":[],\"followedAuthorIds\":[],\"commentsByPostId\":{}}");
    expect(readRecentCommunityTopics()).toEqual([]);
  });

  it("does not claim deletion when browser storage rejects the write", async () => {
    createPost();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === "ejik-fit:local-community-posts") {
        throw new DOMException("blocked", "SecurityError");
      }
      return originalSetItem.call(this, key, value);
    });
    render(<LocalPostDetail postId={postId} />);
    await screen.findByRole("heading", {
      level: 1,
      name: "브라우저에 저장한 이직 질문",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "브라우저에 저장한 이직 질문 삭제" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "글을 삭제하지 못했습니다. 글은 그대로 두었습니다.",
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "브라우저에 저장한 이직 질문",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem("ejik-fit:local-community-posts")).toContain(postId),
    );
  });

  it("keeps the post when its local interactions cannot be cleared", async () => {
    createPost();
    togglePostReaction(postId);
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === "ejik-fit:social-interactions") {
        throw new DOMException("blocked", "SecurityError");
      }
      return originalSetItem.call(this, key, value);
    });
    render(<LocalPostDetail postId={postId} />);
    await screen.findByRole("heading", {
      level: 1,
      name: "브라우저에 저장한 이직 질문",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "브라우저에 저장한 이직 질문 삭제" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "글과 반응·댓글을 함께 삭제하지 못했습니다. 글은 그대로 두었습니다.",
    );
    expect(localStorage.getItem("ejik-fit:local-community-posts")).toContain(
      postId,
    );
  });
});
