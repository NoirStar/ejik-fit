import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("OwnedSkillsSheet", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
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
});
