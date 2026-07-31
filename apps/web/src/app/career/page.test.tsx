import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSkillCatalog, getSkillGraph } from "@/lib/api";

import CareerPage from "./page";

vi.mock("@/lib/api", () => ({
  getSkillCatalog: vi.fn(),
  getSkillGraph: vi.fn(),
}));

const graphResponse = {
  seed: null,
  nodes: [{
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
  }],
  edges: [],
  evidence: [],
  meta: { limit: 60, min_confidence: 0.8 },
};

describe("CareerPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getSkillCatalog).mockResolvedValue({
      total: 2,
      items: [
        { name: "Kubernetes", category: "infra", kind: "platform", domains: ["devops"] },
        { name: "React Native", category: "mobile", kind: "framework", domains: ["mobile"] },
      ],
    });
    vi.mocked(getSkillGraph).mockResolvedValue(graphResponse);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts with the minimum career profile and keeps skills inside that flow", async () => {
    render(await CareerPage());

    expect(screen.getByRole("heading", { level: 1, name: "내 커리어" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "최소 프로필부터 입력해 주세요." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "현재 경력" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "실제로 사용한 기술" })).toBeInTheDocument();
    expect(screen.getByLabelText("현재 직무")).toBeInTheDocument();
    expect(screen.getByLabelText("추가할 기술")).toBeInTheDocument();
    expect(getSkillCatalog).toHaveBeenCalledOnce();
    expect(getSkillGraph).toHaveBeenCalledWith({ limit: 60 });

    fireEvent.change(screen.getByRole("combobox", { name: "추가할 기술" }), {
      target: { value: "react" },
    });
    expect(screen.getByRole("option", { name: "React Native 모바일" })).toBeInTheDocument();
  });

  it("keeps direct skill entry available when the catalog fails", async () => {
    vi.mocked(getSkillCatalog).mockRejectedValue(new Error("catalog unavailable"));
    render(await CareerPage());

    expect(screen.getByLabelText("추가할 기술")).toBeInTheDocument();
    expect(screen.queryByText("catalog unavailable")).not.toBeInTheDocument();
  });

  it("keeps the minimum profile usable when domain data fails", async () => {
    vi.mocked(getSkillGraph).mockRejectedValue(new Error("graph unavailable"));
    render(await CareerPage());

    expect(screen.getByLabelText("현재 직무")).toBeEnabled();
    expect(screen.getByRole("button", { name: "커리어 프로필 저장" })).toBeInTheDocument();
  });
});
