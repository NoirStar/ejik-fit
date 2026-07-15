import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthViewer } from "@/features/auth/use-auth-viewer";

import { AccountOverview } from "./account-overview";

vi.mock("@/features/auth/use-auth-viewer", () => ({
  useAuthViewer: vi.fn(),
}));

const signOut = vi.fn<() => Promise<boolean>>();

describe("AccountOverview", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    signOut.mockReset();
    signOut.mockResolvedValue(true);
  });

  it("guides a guest to email login without implying cloud sync", () => {
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: null,
      ready: true,
      signingOut: false,
      error: "",
      signOut,
    });

    render(<AccountOverview />);

    expect(screen.getByRole("heading", { name: "계정 및 동기화" })).toBeInTheDocument();
    expect(screen.getByText(/현재 이 브라우저에만 저장/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이메일로 로그인" })).toHaveAttribute(
      "href",
      "/login?next=%2Fcareer%2Faccount",
    );
  });

  it("shows the signed-in account and real browser career counts", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python", "Docker"]),
    );
    window.localStorage.setItem(
      "ejik-fit:saved-job-ids",
      JSON.stringify(["job-1", "job-2"]),
    );
    window.localStorage.setItem(
      "ejik-fit:job-application-stages",
      JSON.stringify({ "job-1": "interview" }),
    );
    window.localStorage.setItem(
      "ejik-fit:followed-company-slugs",
      JSON.stringify(["naver"]),
    );
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      signingOut: false,
      error: "",
      signOut,
    });

    render(<AccountOverview />);

    expect(screen.getByText("dev@example.com")).toBeInTheDocument();
    expect(screen.getByText("내 기술").closest("a")).toHaveTextContent("2개");
    expect(screen.getByText("저장 공고").closest("a")).toHaveTextContent("2건");
    expect(screen.getByText("지원 기록").closest("a")).toHaveTextContent("1건");
    expect(screen.getByText("관심 기업").closest("a")).toHaveTextContent("1곳");

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
