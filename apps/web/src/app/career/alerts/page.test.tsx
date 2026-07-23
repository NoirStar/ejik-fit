import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AlertsPage, { metadata } from "./page";

vi.mock("@/features/saved-searches/saved-search-manager", () => ({
  SavedSearchManager: () => (
    <div data-testid="saved-search-manager">공고 알림 관리자</div>
  ),
}));

describe("AlertsPage", () => {
  afterEach(() => cleanup());

  it("renders the saved-search manager", () => {
    render(<AlertsPage />);

    expect(screen.getByTestId("saved-search-manager")).toHaveTextContent(
      "공고 알림 관리자",
    );
  });

  it("keeps account alert data out of search indexes", () => {
    expect(metadata).toMatchObject({
      title: "공고 알림",
      description:
        "저장한 알림과 새로 확인된 공고를 관리합니다.",
      robots: { index: false, follow: false },
    });
  });
});
