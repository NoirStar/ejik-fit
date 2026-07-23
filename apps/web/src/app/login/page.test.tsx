import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("@/features/auth/auth-panel", () => ({
  AuthPanel: () => <div data-testid="auth-panel" />,
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
});
