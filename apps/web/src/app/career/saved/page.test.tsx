import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import SavedPage, { metadata } from "./page";

describe("SavedPage", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("renders the browser-owned saved library", async () => {
    render(await SavedPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "저장 목록" }),
    ).toBeInTheDocument();
  });

  it("opens a valid collection scope from the account hub", async () => {
    render(
      await SavedPage({
        searchParams: Promise.resolve({ scope: "applications" }),
      }),
    );

    expect(screen.getByRole("tab", { name: /지원 관리/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps the personalized local page out of search indexes", () => {
    expect(metadata).toMatchObject({
      title: "저장 목록",
      robots: { index: false, follow: false },
    });
  });
});
