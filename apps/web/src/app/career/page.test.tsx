import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSkillGraph, getSkillStats } from "@/lib/api";

import CareerPage from "./page";

vi.mock("@/lib/api", () => ({
  getSkillGraph: vi.fn(),
  getSkillStats: vi.fn(),
}));

const graphResponse = {
  seed: null,
  nodes: [
    {
      id: "Python",
      label: "Python",
      category: "language",
      kind: "language",
      domains: ["backend", "data"],
      demand_count: 10,
      required_count: 7,
      preferred_count: 2,
      unspecified_count: 1,
      owned: false,
      seed: false,
    },
  ],
  edges: [],
  evidence: [],
  meta: { limit: 60, min_confidence: 0.8 },
};

describe("CareerPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getSkillGraph).mockReset();
    vi.mocked(getSkillStats).mockReset();
    vi.mocked(getSkillGraph).mockResolvedValue(graphResponse);
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
    expect(getSkillGraph).toHaveBeenCalledWith({ limit: 60 });
    expect(
      screen.getByRole("button", { name: "Kubernetes 빠르게 추가, 공개 공고 12건" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("추가할 기술")).toBeInTheDocument();
    expect(screen.getByLabelText("희망 기술 분야")).toHaveDisplayValue(
      "전체 기술 분야",
    );
    expect(screen.getByRole("option", { name: "백엔드 · 연결 기술 1개" })).toBeInTheDocument();
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

  it("keeps career comparison usable when graph domains fail", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getSkillStats).mockResolvedValue({ total: 0, items: [] });
    vi.mocked(getSkillGraph).mockRejectedValue(new Error("graph unavailable"));

    render(await CareerPage());

    expect(
      screen.getByText("분야 목록을 불러오지 못해 전체 기술 분야로 비교합니다."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("희망 기술 분야")).toBeEnabled();
    expect(
      within(screen.getByLabelText("희망 기술 분야")).getAllByRole("option"),
    ).toHaveLength(1);
    expect(screen.queryByText("graph unavailable")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
