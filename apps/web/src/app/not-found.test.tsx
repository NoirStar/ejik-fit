import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("uses a route-neutral message and offers useful recovery paths", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "페이지를 찾을 수 없습니다." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "요청한 주소가 바뀌었거나 더 이상 제공되지 않는 페이지일 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "공고 둘러보기" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(screen.queryByText(/마감되었거나/)).not.toBeInTheDocument();
  });
});
