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
        items={[]}
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
        items={[]}
        onShowFollowing={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "팔로우 중인 글" }),
    ).not.toBeInTheDocument();
  });

  it("renders only real server posts and opens the following tab", () => {
    const onShowFollowing = vi.fn();
    const serverPosts: CommunityPostFeedItem[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "community_post",
        category: "커리어 질문",
        authorId: "22222222-2222-4222-8222-222222222222",
        authorName: "서버정원",
        authorHeadline: "이직핏 커뮤니티 사용자",
        authorTone: "green",
        createdAt: "2026-07-21T05:00:00.000Z",
        createdLabel: "방금 전",
        title: "계정에서 팔로우한 작성자의 최신 글",
        body: "실제 계정 커뮤니티 본문입니다.",
        tags: ["백엔드"],
        href: "/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        metrics: { reactions: 1, comments: 0, saves: 0 },
        source: "server",
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "community_post",
        category: "커리어 고민",
        authorId: "22222222-2222-4222-8222-222222222222",
        authorName: "서버정원",
        authorHeadline: "이직핏 커뮤니티 사용자",
        authorTone: "green",
        createdAt: "2026-07-20T05:00:00.000Z",
        createdLabel: "어제",
        title: "계정에서 팔로우한 작성자의 이전 글",
        body: "이전 서버 글입니다.",
        tags: ["이직"],
        href: "/posts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        metrics: { reactions: 1, comments: 0, saves: 0 },
        source: "server",
      },
      {
        id: "local-recovery",
        type: "community_post",
        category: "일반",
        authorId: "22222222-2222-4222-8222-222222222222",
        authorName: "서버정원",
        authorHeadline: "이 기기에서 작성",
        authorTone: "violet",
        createdAt: "2026-07-22T05:00:00.000Z",
        createdLabel: "방금 전",
        title: "팔로잉 영역에 노출되면 안 되는 로컬 글",
        body: "로컬 본문",
        tags: ["로컬"],
        href: "/posts/local-recovery",
        metrics: { reactions: 0, comments: 0, saves: 0 },
        source: "local",
      },
    ];
    render(
      <FollowingPostList
        followedAuthorIds={["22222222-2222-4222-8222-222222222222"]}
        hydrated
        items={serverPosts}
        onShowFollowing={onShowFollowing}
      />,
    );

    const region = screen.getByRole("region", {
      name: "팔로우 중인 글",
    });
    const links = within(region).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(within(region).queryByText("최대 2개")).not.toBeInTheDocument();
    expect(links[0]).toHaveAccessibleName(
      "서버정원의 글: 계정에서 팔로우한 작성자의 최신 글",
    );
    expect(links[0]).toHaveAttribute(
      "href",
      "/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(links[1]).toHaveAccessibleName(
      "서버정원의 글: 계정에서 팔로우한 작성자의 이전 글",
    );
    expect(region).not.toHaveTextContent(
      "팔로잉 영역에 노출되면 안 되는 로컬 글",
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
