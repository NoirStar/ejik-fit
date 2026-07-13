import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSkillStats } from "@/lib/api";

import CareerPage from "./page";

vi.mock("@/lib/api", () => ({
  getSkillStats: vi.fn(),
}));

describe("CareerPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getSkillStats).mockReset();
  });

  afterEach(() => cleanup());

  it("loads actual top skills for browser-owned skill suggestions", async () => {
    vi.mocked(getSkillStats).mockResolvedValue({
      total: 2,
      items: [
        { skill: "Kubernetes", category: "infra", count: 12 },
        { skill: "Python", category: "language", count: 10 },
      ],
    });

    render(await CareerPage());

    expect(getSkillStats).toHaveBeenCalledWith({ limit: 12 });
    expect(
      screen.getByRole("button", { name: "Kubernetes 빠르게 추가, 공개 공고 12건" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("추가할 기술")).toBeInTheDocument();
  });

  it("keeps direct skill entry available when suggestions fail", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getSkillStats).mockRejectedValue(new Error("backend unavailable"));

    render(await CareerPage());

    expect(screen.getByText("상위 기술 제안을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("추가할 기술")).toBeInTheDocument();
    expect(screen.queryByText("backend unavailable")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("treats a malformed successful suggestion payload as unavailable", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getSkillStats).mockResolvedValue({
      items: null,
      total: 1,
    } as unknown as Awaited<ReturnType<typeof getSkillStats>>);

    render(await CareerPage());

    expect(screen.getByText("상위 기술 제안을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("추가할 기술")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
