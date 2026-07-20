import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import QuestionsPage, { metadata } from "./page";

describe("QuestionsPage", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("renders the browser-owned authored question library", () => {
    render(<QuestionsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "내 글" }),
    ).toBeInTheDocument();
  });

  it("keeps the personalized local page out of search indexes", () => {
    expect(metadata).toMatchObject({
      title: "내 글",
      robots: { index: false, follow: false },
    });
  });
});
