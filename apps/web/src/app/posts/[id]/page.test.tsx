import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PostPage, { generateMetadata } from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));

describe("PostPage", () => {
  afterEach(() => cleanup());

  it("builds post-specific metadata and a canonical URL", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "career-move-3y-backend" }),
    });

    expect(metadata.title).toBe(
      "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?",
    );
    expect(metadata.description).toContain("성장 속도가 느린 것 같습니다");
    expect(metadata.alternates?.canonical).toBe(
      "/posts/career-move-3y-backend",
    );
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

  it("routes an unknown post to not found", async () => {
    await expect(
      PostPage({ params: Promise.resolve({ id: "missing-post" }) }),
    ).rejects.toThrow("not found");
  });
});
