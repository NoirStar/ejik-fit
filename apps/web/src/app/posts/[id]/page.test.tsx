import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocalCommunityPost } from "@/lib/local-community-posts";
import { readRecentCommunityTopics } from "@/lib/recent-community-topics";

import PostPage, { generateMetadata } from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));

describe("PostPage", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("builds post-specific metadata and a canonical URL", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "career-move-3y-backend" }),
    });

    expect(metadata.title).toBe(
      "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요? (이직핏 커뮤니티 가이드)",
    );
    expect(metadata.description).toContain("읽기 전용 예시");
    expect(metadata.description).toContain("성장 속도가 느린 것 같습니다");
    expect(metadata.alternates?.canonical).toBe(
      "/posts/career-move-3y-backend",
    );
    expect(metadata.robots).toMatchObject({ follow: true, index: false });
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.openGraph?.description).toBe(metadata.description);
  });

  it("labels interview metadata as synthetic rather than a real review", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "platform-backend-first-round" }),
    });

    expect(metadata.title).toBe(
      "플랫폼 기업 백엔드 1차 기술 면접 후기 (이직핏 커뮤니티 가이드)",
    );
    expect(metadata.description).toContain("이직핏이 구성한 읽기 전용 면접 예시");
    expect(metadata.description).toContain(
      "특정 기업의 실제 면접 기록이 아닙니다",
    );
    expect(metadata.robots).toMatchObject({ follow: true, index: false });
  });

  it("keeps browser-owned post metadata generic and out of search indexes", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "local-first-post" }),
    });

    expect(metadata.title).toBe("이 브라우저에 저장한 커뮤니티 글");
    expect(metadata.description).toContain("현재 브라우저에만 저장");
    expect(metadata.alternates?.canonical).toBe("/posts/local-first-post");
    expect(metadata.robots).toMatchObject({ follow: false, index: false });
  });

  it("renders built-in community content as an explicit read-only guide", async () => {
    render(
      await PostPage({
        params: Promise.resolve({ id: "career-move-3y-backend" }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("이직핏 커뮤니티 가이드", { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/실제 회원이 작성한 게시물이 아닌 읽기 전용 예시/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "글 반응과 댓글" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /팔로우|공감|저장|신고|수정/ }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "댓글 내용" }))
      .not.toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "이 글 안내" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "관련 글" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /읽기/ })).toHaveLength(2);
    expect(
      screen.queryByText(
        "지금 회사가 나쁘지는 않지만 비슷한 업무만 반복하고 있어 성장 속도가 느린 것 같습니다. 제안을 받은 팀은 기술적으로 매력적이지만 규모가 작아 고민이에요.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "현재 팀에서는 익숙한 서비스의 유지보수 비중이 커졌습니다. 문제를 안정적으로 처리하는 법은 배웠지만, 설계 선택의 폭을 넓힐 기회가 줄었다고 느낍니다.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(readRecentCommunityTopics()).toEqual([
        expect.objectContaining({
          postId: "career-move-3y-backend",
          title: "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?",
          topicLabel: "백엔드",
          source: "mock",
        }),
      ]),
    );
  });

  it("does not offer a browser-local follow action for a guide author", async () => {
    render(
      await PostPage({
        params: Promise.resolve({ id: "career-move-3y-backend" }),
      }),
    );

    expect(screen.queryByRole("button", { name: /팔로우/ })).not.toBeInTheDocument();
    expect(localStorage.getItem("ejik-fit:social-interactions")).toBeNull();
  });

  it("shows interview context only for a mock interview review", async () => {
    render(
      await PostPage({
        params: Promise.resolve({ id: "platform-backend-first-round" }),
      }),
    );

    expect(
      screen.getByRole("region", { name: "면접 후기 정보" }),
    ).toHaveTextContent("국내 플랫폼 기업");
    expect(
      screen.getByRole("region", { name: "면접 후기 정보" }),
    ).toHaveTextContent("백엔드 개발");
    expect(
      screen.getByRole("region", { name: "면접 후기 정보" }),
    ).toHaveTextContent("1차 기술 면접");
    expect(screen.getByText(/특정 기업의 실제 면접 기록이 아닙니다/)).toBeInTheDocument();
  });

  it("routes a local id to the browser-owned detail view", async () => {
    createLocalCommunityPost(
      { title: "로컬 상세 라우트", body: "현재 브라우저 본문", tags: [] },
      {
        id: "local-page-route",
        createdAt: "2026-07-14T00:00:00.000Z",
      },
    );

    render(
      await PostPage({
        params: Promise.resolve({ id: "local-page-route" }),
      }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "로컬 상세 라우트" }),
    ).toBeInTheDocument();
    expect(screen.getByText("이전 기기 저장 글", { exact: true })).toBeInTheDocument();
    await waitFor(() =>
      expect(readRecentCommunityTopics()).toEqual([
        expect.objectContaining({
          postId: "local-page-route",
          title: "로컬 상세 라우트",
          topicLabel: "커리어 질문",
          source: "local",
        }),
      ]),
    );
  });

  it("routes an unknown post to not found", async () => {
    await expect(
      PostPage({ params: Promise.resolve({ id: "missing-post" }) }),
    ).rejects.toThrow("not found");
  });
});
