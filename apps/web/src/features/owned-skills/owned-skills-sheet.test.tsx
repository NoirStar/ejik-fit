import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";
import { CareerOverview } from "@/features/career/career-overview";

const navigation = vi.hoisted(() => ({
  search: "",
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({
    replace: navigation.replace,
    refresh: navigation.refresh,
  }),
}));

describe("OwnedSkillsSheet", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    navigation.search = "";
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
  });

  it("starts empty on first visit and persists an added skill", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "내 스택 열기" }));

    expect(screen.getByRole("dialog", { name: "내 스택" })).toBeInTheDocument();
    expect(screen.getByText("아직 저장한 기술이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("Java")).not.toBeInTheDocument();
    expect(screen.queryByText("AWS")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("추가할 기술"), {
      target: { value: "Spring" },
    });
    fireEvent.click(screen.getByRole("button", { name: "기술 추가" }));

    expect(screen.getByText("Spring")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills") ?? "[]")).toEqual([
      "Spring",
    ]);
    expect(navigation.replace).toHaveBeenCalledWith(
      "/?owned_skills=Spring#my-stack",
      { scroll: false },
    );
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("closes with Escape and returns focus to the opener", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );
    const opener = screen.getByRole("button", { name: "내 스택 열기" });

    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "내 스택" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab focus inside the modal sheet", () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "내 스택 열기" }));
    const close = screen.getByRole("button", { name: "내 스택 닫기" });
    const add = screen.getByRole("button", { name: "기술 추가" });

    add.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(add).toHaveFocus();
  });

  it("keeps the dialog label unique on the career page", () => {
    render(
      <AppShell>
        <CareerOverview suggestions={[]} suggestionsUnavailable={false} />
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "내 스택 열기" }));

    expect(screen.getByRole("dialog", { name: "내 스택" })).toBeInTheDocument();
    expect(document.querySelectorAll("#owned-skills-title")).toHaveLength(1);
    expect(
      document.querySelectorAll("#career-owned-skills-title"),
    ).toHaveLength(1);
  });
});
