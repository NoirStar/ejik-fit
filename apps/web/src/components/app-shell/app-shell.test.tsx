import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigation.pathname = "/";
  });

  it("exposes only working product destinations and the owned stack action", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "공고 탐색" })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: "기술 맵" })).toHaveAttribute("href", "/skills/graph");
    expect(screen.getByRole("button", { name: "내 스택 열기" })).toBeInTheDocument();
    expect(screen.queryByText("김민준")).not.toBeInTheDocument();
    expect(screen.queryByText("준비중")).not.toBeInTheDocument();
  });

  it("derives the current destination from the pathname", () => {
    navigation.pathname = "/jobs/job-1";

    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "공고 탐색" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
