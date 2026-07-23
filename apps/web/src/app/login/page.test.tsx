import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("@/features/auth/auth-panel", () => ({
  AuthPanel: ({
    initialMode,
    nextPath,
  }: {
    initialMode: string;
    nextPath: string;
  }) => (
    <div
      data-initial-mode={initialMode}
      data-next-path={nextPath}
      data-testid="auth-panel"
    />
  ),
}));

describe("LoginPage", () => {
  afterEach(() => cleanup());

  it("shows only the information needed to log in", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { level: 1, name: "로그인" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("auth-panel")).toBeInTheDocument();
    expect(
      screen.queryByText("로그인하면 달라지는 점"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/이메일 확인으로 계정을 보호하고/),
    ).not.toBeInTheDocument();
  });

  it("shows the exact callback error", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "callback" }),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /^인증 링크를 사용할 수 없습니다\. 로그인하거나 새 링크를 받아 주세요\.$/,
    );
  });

  it.each([
    {
      expectedMode: "signup",
      expectedNextPath: "/career/saved?stage=applied",
      mode: "signup",
      next: "/career/saved?stage=applied",
    },
    {
      expectedMode: "signin",
      expectedNextPath: "/career",
      mode: "unsupported",
      next: "https://evil.example/steal",
    },
  ])(
    "passes normalized mode $expectedMode and safe path $expectedNextPath to AuthPanel",
    async ({ expectedMode, expectedNextPath, mode, next }) => {
      render(
        await LoginPage({
          searchParams: Promise.resolve({ mode, next }),
        }),
      );

      expect(screen.getByRole("link", { name: "돌아가기" })).toHaveAttribute(
        "href",
        expectedNextPath,
      );
      expect(screen.getByTestId("auth-panel")).toHaveAttribute(
        "data-initial-mode",
        expectedMode,
      );
      expect(screen.getByTestId("auth-panel")).toHaveAttribute(
        "data-next-path",
        expectedNextPath,
      );
    },
  );
});
