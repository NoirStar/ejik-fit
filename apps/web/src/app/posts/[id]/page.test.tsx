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

  it("keeps browser-owned post metadata generic and out of search indexes", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "local-first-post" }),
    });

    expect(metadata.title).toBe("이 기기에 남은 커뮤니티 글");
    expect(metadata.description).toContain("이 기기에만 남아 있는");
    expect(metadata.alternates?.canonical).toBe("/posts/local-first-post");
    expect(metadata.robots).toMatchObject({ follow: false, index: false });
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
    expect(
      screen.getAllByText("이 기기에 남은 글", { exact: true }).length,
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(readRecentCommunityTopics()).toEqual([
        expect.objectContaining({
          postId: "local-page-route",
          title: "로컬 상세 라우트",
          topicLabel: "일반",
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

  it("routes a former built-in example slug to not found", async () => {
    await expect(
      PostPage({
        params: Promise.resolve({ id: "career-move-3y-backend" }),
      }),
    ).rejects.toThrow("not found");
  });

  it("does not build metadata for a former built-in example slug", async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({ id: "career-move-3y-backend" }),
      }),
    ).rejects.toThrow("not found");
  });
});
