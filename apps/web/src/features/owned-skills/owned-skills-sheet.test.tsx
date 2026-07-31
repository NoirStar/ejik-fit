import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CareerOverview } from "@/features/career/career-overview";
import { OwnedSkillsSheet } from "./owned-skills-sheet";

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

function SheetHarness({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)} ref={openerRef} type="button">
        내 기술 열기
      </button>
      <OwnedSkillsSheet
        onClose={() => setOpen(false)}
        open={open}
        openerRef={openerRef}
      />
      {children}
    </>
  );
}

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
      <SheetHarness>
        <main>내용</main>
      </SheetHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: "내 기술 열기" }));

    expect(
      await screen.findByRole("dialog", { name: "내 기술" }),
    ).toBeInTheDocument();
    expect(screen.getByText("아직 추가한 기술이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("Java")).not.toBeInTheDocument();
    expect(screen.queryByText("AWS")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("추가할 기술"), {
      target: { value: "Spring" },
    });
    fireEvent.click(screen.getByRole("button", { name: "기술 추가" }));

    expect(
      await screen.findByText("Spring", undefined, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills") ?? "[]")).toEqual([
      "Spring",
    ]);
  });

  it("closes with Escape and returns focus to the opener", () => {
    render(
      <SheetHarness>
        <main>내용</main>
      </SheetHarness>,
    );
    const opener = screen.getByRole("button", { name: "내 기술 열기" });

    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "내 기술" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("suggests canonical skills and supports keyboard selection", async () => {
    render(
      <SheetHarness>
        <main>내용</main>
      </SheetHarness>,
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
      <SheetHarness>
        <main>내용</main>
      </SheetHarness>,
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
      <SheetHarness>
        <CareerOverview suggestions={[]} suggestionsUnavailable={false} />
      </SheetHarness>,
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
