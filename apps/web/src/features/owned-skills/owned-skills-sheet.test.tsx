import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
    navigation.search = "";
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              name: "Kubernetes",
              category: "infra",
              kind: "platform",
              domains: ["devops", "cloud", "mlops"],
            },
            {
              name: "React Native",
              category: "mobile",
              kind: "framework",
              domains: ["mobile", "frontend"],
            },
          ],
          total: 2,
        }),
      }),
    );
  });

  it("starts empty on first visit and persists an added skill", async () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "내 기술 열기" }));

    const dialog = await screen.findByRole("dialog", { name: "내 기술" });
    expect(
      within(dialog).getByRole("heading", { level: 2, name: "내 기술" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "내 기술 닫기" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("공고와 스킬맵의 분석 기준을 직접 관리합니다."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("추가한 기술")).toBeInTheDocument();
    expect(
      screen.getByText("아직 추가한 기술이 없습니다."),
    ).toBeInTheDocument();
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
    const opener = screen.getByRole("button", { name: "내 기술 열기" });

    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "내 기술" }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("suggests canonical skills and supports keyboard selection", async () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "내 기술 열기" }));
    const input = await screen.findByRole("combobox", { name: "추가할 기술" });
    fireEvent.change(input, { target: { value: "kube" } });

    expect(
      await screen.findByRole("option", { name: "Kubernetes 인프라" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills") ?? "[]")).toEqual([
      "Kubernetes",
    ]);
  });

  it("keeps Tab focus inside the modal sheet", async () => {
    render(
      <AppShell>
        <main>내용</main>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "내 기술 열기" }));
    const close = await screen.findByRole("button", { name: "내 기술 닫기" });
    const add = screen.getByRole("button", { name: "기술 추가" });

    add.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(add).toHaveFocus();
  });

  it("keeps the dialog label unique on the career page", async () => {
    render(
      <AppShell>
        <CareerOverview suggestions={[]} suggestionsUnavailable={false} />
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "내 기술 열기" }));

    expect(
      await screen.findByRole("dialog", { name: "내 기술" }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("#owned-skills-title")).toHaveLength(1);
    expect(
      document.querySelectorAll("#career-owned-skills-title"),
    ).toHaveLength(1);
  });
});
