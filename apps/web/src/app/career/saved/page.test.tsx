import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import SavedPage, { metadata } from "./page";

describe("SavedPage", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("renders the browser-owned saved library", () => {
    render(<SavedPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "저장 보관함" }),
    ).toBeInTheDocument();
  });

  it("keeps the personalized local page out of search indexes", () => {
    expect(metadata).toMatchObject({
      title: "저장 보관함",
      robots: { index: false, follow: false },
    });
  });
});
