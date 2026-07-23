import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

describe("home loading state", () => {
  it("previews the real three-region feed without announcing fake content", () => {
    render(<Loading />);

    expect(
      screen.getByRole("main", { name: "홈 피드를 불러오는 중" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("complementary", {
        name: "내 커리어를 불러오는 중",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "피드를 불러오는 중" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", {
        name: "채용 시장 요약을 불러오는 중",
      }),
    ).toBeInTheDocument();
  });
});
