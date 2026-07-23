import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SOCIAL_ITEMS } from "./mock-community";
import { StarterCommunityGuide } from "./starter-community-guide";

describe("StarterCommunityGuide", () => {
  it("labels every starter item as read-only guidance without social controls", () => {
    const items = MOCK_SOCIAL_ITEMS.slice(0, 3);

    render(<StarterCommunityGuide items={items} />);

    const guide = screen.getByRole("region", {
      name: "이직핏 커뮤니티 가이드",
    });
    const entries = within(guide).getAllByRole("article");
    expect(entries).toHaveLength(items.length);
    expect(
      within(guide).getByText(
        "질문과 경험을 나눌 때 참고하는 읽기 전용 글입니다. 실제 회원 글과 반응 수에는 포함되지 않습니다.",
      ),
    ).toBeInTheDocument();
    expect(within(guide).queryByText(/보여주는/)).not.toBeInTheDocument();

    for (const [index, entry] of entries.entries()) {
      expect(within(entry).getByText("이직핏 커뮤니티 가이드")).toBeVisible();
      expect(
        within(entry).getByRole("link", { name: `${items[index].title} 예시 읽기` }),
      ).toHaveAttribute("href", items[index].href);
      expect(within(entry).queryByRole("button")).not.toBeInTheDocument();
      expect(
        within(entry).queryByRole("link", {
          name: /공감|댓글|저장|팔로우|신고|수정/,
        }),
      ).not.toBeInTheDocument();
    }
  });
});
