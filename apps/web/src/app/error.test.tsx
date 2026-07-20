import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";

describe("ErrorPage", () => {
  it("offers retry and safe recovery links without exposing error details", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("private failure detail")} reset={reset} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "페이지를 불러오지 못했습니다.",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "데이터 정책" })).toHaveAttribute(
      "href",
      "/data-policy",
    );
    expect(screen.queryByText("private failure detail")).not.toBeInTheDocument();
  });
});
