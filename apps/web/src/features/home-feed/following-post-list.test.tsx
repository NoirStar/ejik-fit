import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FollowingPostList } from "./following-post-list";

describe("FollowingPostList", () => {
  afterEach(() => cleanup());

  it("does not claim an empty state before browser follow data is hydrated", () => {
    render(
      <FollowingPostList
        followedAuthorIds={[]}
        hydrated={false}
        onShowFollowing={vi.fn()}
        onShowRecommended={vi.fn()}
      />,
    );

    const region = screen.getByRole("region", {
      name: "팔로우 중인 예시 글",
    });
    expect(region).toHaveTextContent("팔로우 정보를 확인 중입니다.");
    expect(region).not.toHaveTextContent("아직 팔로우한 예시 작성자가 없습니다.");
  });

  it("shows an honest empty state and returns to recommended authors", () => {
    const onShowRecommended = vi.fn();
    render(
      <FollowingPostList
        followedAuthorIds={[]}
        hydrated
        onShowFollowing={vi.fn()}
        onShowRecommended={onShowRecommended}
      />,
    );

    const region = screen.getByRole("region", {
      name: "팔로우 중인 예시 글",
    });
    expect(region).toHaveTextContent("아직 팔로우한 예시 작성자가 없습니다.");
    fireEvent.click(
      within(region).getByRole("button", { name: "추천 탭에서 찾기" }),
    );
    expect(onShowRecommended).toHaveBeenCalledOnce();
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
        onShowRecommended={vi.fn()}
      />,
    );

    const region = screen.getByRole("region", {
      name: "팔로우 중인 예시 글",
    });
    const links = within(region).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(
      "서버정원의 글: 3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?",
    );
    expect(links[0]).toHaveAttribute("href", "/posts/career-move-3y-backend");
    expect(links[1]).toHaveAccessibleName(
      "빌드하는밤의 글: 플랫폼 기업 백엔드 1차 기술 면접 후기",
    );
    expect(region).not.toHaveTextContent(
      "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
    );

    fireEvent.click(
      within(region).getByRole("button", { name: "팔로잉 탭 보기" }),
    );
    expect(onShowFollowing).toHaveBeenCalledOnce();
  });
});
