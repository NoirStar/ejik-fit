import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FollowingPostList } from "./following-post-list";
import type { CommunityPostFeedItem } from "./types";

describe("FollowingPostList", () => {
  afterEach(() => cleanup());

  it("does not reserve rail space before browser follow data is hydrated", () => {
    render(
      <FollowingPostList
        followedAuthorIds={[]}
        hydrated={false}
        onShowFollowing={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "팔로우 중인 글" }),
    ).not.toBeInTheDocument();
  });

  it("does not reserve rail space for an empty followed list", () => {
    render(
      <FollowingPostList
        followedAuthorIds={[]}
        hydrated
        onShowFollowing={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "팔로우 중인 글" }),
    ).not.toBeInTheDocument();
  });

  it("renders only the two newest followed example posts and opens the following tab", () => {
    const onShowFollowing = vi.fn();
    render(
      <FollowingPostList
        followedAuthorIds={[
          "beyond-product",
          "query-cup",
          "code-walk",
          "night-builder",
          "server-garden",
        ]}
        hydrated
        onShowFollowing={onShowFollowing}
      />,
    );

    const region = screen.getByRole("region", {
      name: "팔로우 중인 글",
    });
    const links = within(region).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(
      "서버정원의 글: 3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?",
    );
    expect(links[0]).toHaveAttribute("href", "/posts/career-move-3y-backend");
    expect(links[1]).toHaveAccessibleName(
      "코드산책의 글: Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
    );
    expect(region).not.toHaveTextContent(
      "플랫폼 기업 백엔드 1차 기술 면접 후기",
    );

    fireEvent.click(
      within(region).getByRole("button", { name: "팔로잉 탭 보기" }),
    );
    expect(onShowFollowing).toHaveBeenCalledOnce();
  });

  it("renders a real server post from a followed account", () => {
    const serverPost: CommunityPostFeedItem = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: "community_post",
      category: "커리어 질문",
      authorId: "22222222-2222-4222-8222-222222222222",
      authorName: "서버정원",
      authorHeadline: "이직핏 커뮤니티 사용자",
      authorTone: "green",
      createdAt: "2026-07-21T05:00:00.000Z",
      createdLabel: "방금 전",
      title: "계정에서 팔로우한 작성자의 실제 글",
      body: "실제 계정 커뮤니티 본문입니다.",
      tags: ["백엔드"],
      href: "/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      metrics: { reactions: 1, comments: 0, saves: 0 },
      source: "server",
    };

    render(
      <FollowingPostList
        followedAuthorIds={[serverPost.authorId]}
        hydrated
        items={[serverPost]}
        onShowFollowing={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "서버정원의 글: 계정에서 팔로우한 작성자의 실제 글",
      }),
    ).toHaveAttribute("href", serverPost.href);
  });
});
