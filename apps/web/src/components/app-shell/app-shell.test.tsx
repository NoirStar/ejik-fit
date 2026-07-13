import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    replace: navigation.replace,
    refresh: navigation.refresh,
  }),
}));

describe("AppShell", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    navigation.pathname = "/";
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
  });

  it("exposes desktop and mobile access to five product destinations", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    expect(screen.getAllByRole("link", { name: "홈" })[0]).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link", { name: "시장" })[0]).toHaveAttribute("href", "/market");
    expect(screen.getAllByRole("link", { name: "스킬맵" })[0]).toHaveAttribute("href", "/skill-map");
    expect(screen.getAllByRole("link", { name: "공고" })[0]).toHaveAttribute("href", "/jobs");
    expect(screen.getAllByRole("link", { name: "내 커리어" })[0]).toHaveAttribute("href", "/career");
    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute("href", "/?compose=1");
    expect(screen.getByRole("searchbox", { name: "통합 검색" })).toHaveAttribute("name", "q");
    expect(screen.queryByText("김민준")).not.toBeInTheDocument();
  });

  it("derives the current destination from the pathname", () => {
    navigation.pathname = "/jobs/job-1";

    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    expect(screen.getAllByRole("link", { name: "공고" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { name: "홈" })[0]).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("opens utility menus and closes them with Escape", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "알림 열기" }));
    expect(screen.getByRole("menu", { name: "알림" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "알림" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "사용자 메뉴 열기" }));
    expect(screen.getByRole("menu", { name: "사용자 메뉴" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "사용자 메뉴" })).not.toBeInTheDocument();
  });

  it("focuses global search when slash is pressed outside an editor", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );
    const search = screen.getByRole("searchbox", { name: "통합 검색" });

    fireEvent.keyDown(document, { key: "/" });

    expect(search).toHaveFocus();
  });
});
