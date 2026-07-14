import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocalCommunityPost } from "@/lib/local-community-posts";

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
      "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요? (커뮤니티 글 예시)",
    );
    expect(metadata.description).toContain("화면 검증용 mock 커뮤니티 글");
    expect(metadata.description).toContain("실제 사용자가 작성한 경험이 아닙니다");
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
      "플랫폼 기업 백엔드 1차 기술 면접 후기 (면접 후기 예시)",
    );
    expect(metadata.description).toContain("화면 검증용 mock 면접 후기");
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

  it("renders a transparent mock community reading experience", async () => {
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
      screen.getByText("커뮤니티 예시 콘텐츠", { exact: true }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/mock 데이터/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("region", { name: "글 반응과 댓글" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "이 글 안내" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "관련 글" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /읽기/ })).toHaveLength(2);
  });

  it("persists the mock author's browser-local follow choice", async () => {
    render(
      await PostPage({
        params: Promise.resolve({ id: "career-move-3y-backend" }),
      }),
    );

    const follow = screen.getByRole("button", { name: "서버정원 팔로우" });
    await waitFor(() => expect(follow).toBeEnabled());
    fireEvent.click(follow);

    expect(follow).toHaveAttribute("aria-pressed", "true");
    expect(
      JSON.parse(localStorage.getItem("ejik-fit:social-interactions")!),
    ).toMatchObject({ followedAuthorIds: ["server-garden"] });
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
    expect(screen.getByText("로컬 글", { exact: true })).toBeInTheDocument();
  });

  it("routes an unknown post to not found", async () => {
    await expect(
      PostPage({ params: Promise.resolve({ id: "missing-post" }) }),
    ).rejects.toThrow("not found");
  });
});
