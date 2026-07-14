import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  search: "",
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({
    replace: navigation.replace,
    refresh: navigation.refresh,
  }),
}));

describe("AppShell", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    navigation.pathname = "/";
    navigation.search = "";
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
    localStorage.clear();
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
    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute(
      "aria-label",
      "글쓰기",
    );
    expect(screen.getByRole("searchbox", { name: "통합 검색" })).toHaveAttribute("name", "q");
    expect(screen.getByRole("searchbox", { name: "통합 검색" }).closest("form")).toHaveAttribute(
      "action",
      "/search",
    );
    expect(screen.queryByText("김민준")).not.toBeInTheDocument();
  });

  it("keeps the current query visible on the global search route", () => {
    navigation.pathname = "/search";
    navigation.search = "q=Python&scope=skills";

    render(
      <AppShell>
        <main>검색 결과</main>
      </AppShell>,
    );

    expect(screen.getByRole("searchbox", { name: "통합 검색" })).toHaveValue(
      "Python",
    );
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

  it("keeps company hiring profiles inside the jobs destination", () => {
    navigation.pathname = "/companies/naver";

    render(
      <AppShell>
        <main>기업 채용 현황</main>
      </AppShell>,
    );

    for (const link of screen.getAllByRole("link", { name: "공고" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("marks the desktop skill graph as an immersive route", () => {
    navigation.pathname = "/skills/graph";

    const { container } = render(
      <AppShell>
        <main>그래프</main>
      </AppShell>,
    );

    expect(container.querySelector('[data-immersive="true"]')).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "스킬맵" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("dismisses utility disclosures and restores opener focus", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    const notificationButton = screen.getByRole("button", { name: "알림 열기" });
    fireEvent.click(notificationButton);
    expect(screen.getByLabelText("알림")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByLabelText("알림")).not.toBeInTheDocument();
    expect(notificationButton).toHaveFocus();

    const userButton = screen.getByRole("button", { name: "사용자 메뉴 열기" });
    expect(userButton).toBeEnabled();
    fireEvent.click(userButton);
    expect(screen.getByLabelText("사용자 메뉴")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "저장 보관함" })).toHaveAttribute(
      "href",
      "/career/saved",
    );
    expect(screen.getByRole("link", { name: "내 질문" })).toHaveAttribute(
      "href",
      "/career/questions",
    );
    fireEvent.pointerDown(screen.getByText("내용"));
    expect(screen.queryByLabelText("사용자 메뉴")).not.toBeInTheDocument();
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

  it("hydrates browser-stored skills into a direct home visit", async () => {
    localStorage.setItem("ejik-fit:owned-skills", JSON.stringify(["Kubernetes"]));

    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        "/?owned_skills=Kubernetes#my-stack",
        { scroll: false },
      );
    });
    expect(navigation.refresh).toHaveBeenCalled();
  });
});
