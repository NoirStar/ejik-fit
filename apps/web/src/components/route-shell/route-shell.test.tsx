import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import { RouteShell } from "./route-shell";

describe("RouteShell", () => {
  it("labels an honest future route and keeps a useful next action", () => {
    render(
      <RouteShell
        action={<Link href="/jobs">공식 공고 둘러보기</Link>}
        description="공식 채용 데이터로 시장의 현재 수요를 읽는 화면입니다."
        title="채용 시장"
      />,
    );

    expect(screen.getByRole("heading", { name: "채용 시장" })).toBeInTheDocument();
    expect(screen.getByText("준비 중")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "공식 공고 둘러보기" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
