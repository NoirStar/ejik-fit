import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MarketLoading from "./loading";

describe("MarketLoading", () => {
  it("preserves the market information hierarchy while data loads", () => {
    const { container } = render(<MarketLoading />);

    expect(
      screen.getByRole("main", { name: "채용 시장 데이터를 불러오는 중" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "지금 채용 시장의 기술 흐름",
      }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("[data-skeleton-skill-row]")).toHaveLength(8);
    expect(container.querySelector("[data-skeleton-side-panel]")).not.toBeNull();
  });
});
