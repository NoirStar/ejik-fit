import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SkillGraphPage from "./page";

import { getSkillGraph } from "@/lib/api";


vi.mock("@/lib/api", () => ({
  getSkillGraph: vi.fn(),
}));


describe("SkillGraphPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("renders the skill graph product shell with initial evidence", async () => {
    vi.mocked(getSkillGraph).mockResolvedValue({
      seed: "C++",
      nodes: [
        {
          id: "C++",
          label: "C++",
          category: "language",
          kind: "language",
          domains: ["embedded", "game"],
          demand_count: 18,
          required_count: 12,
          preferred_count: 4,
          unspecified_count: 2,
          owned: true,
          seed: true,
        },
        {
          id: "ROS2",
          label: "ROS2",
          category: "robotics",
          kind: "framework",
          domains: ["robotics"],
          demand_count: 9,
          required_count: 7,
          preferred_count: 2,
          unspecified_count: 0,
          owned: false,
          seed: false,
        },
      ],
      edges: [
        {
          id: "C++:ROS2",
          source: "C++",
          target: "ROS2",
          score: 0.84,
          cooccurrence_count: 7,
          required_pair_count: 5,
          supporting_posting_ids: ["job-1"],
        },
      ],
      evidence: [
        {
          posting_id: "job-1",
          title: "자율주행 SW 엔지니어",
          company_name: "네이버랩스",
          skills: ["C++", "ROS2"],
          required: ["C++", "ROS2"],
          preferred: [],
          unspecified: [],
        },
      ],
      meta: {
        limit: 30,
        min_confidence: 0.8,
      },
    });

    render(await SkillGraphPage());

    expect(screen.getByRole("heading", { name: "이직핏 기술 맵" })).toBeInTheDocument();
    expect(
      screen.getByText(/한 공고에서 함께 확인된 기술을 탐색하고/),
    ).toBeInTheDocument();
    expect(screen.queryByText("기술 채용 인텔리전스")).not.toBeInTheDocument();
    expect(screen.queryByText("Tech Hiring Intelligence")).not.toBeInTheDocument();
    expect(screen.getAllByText("C++").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ROS2").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /자율주행 SW 엔지니어/ }),
    ).toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByText("내 스택")).toBeInTheDocument();
    expect(screen.getByText("그래프 필터")).toBeInTheDocument();
    expect(screen.getByText("언급 공고")).toBeInTheDocument();
    expect(screen.getByText("18건")).toBeInTheDocument();
    expect(screen.getByText("미분류")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
    expect(screen.queryByText("채용 캘린더")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "설정" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "이직핏 기술 맵 홈" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("주변 깊이")).toBeInTheDocument();
  });

  it("loads the graph with the requested seed", async () => {
    vi.mocked(getSkillGraph).mockResolvedValue({
      seed: "Kubernetes",
      nodes: [],
      edges: [],
      evidence: [],
      meta: { limit: 30, min_confidence: 0.8 },
    });

    await SkillGraphPage({
      searchParams: Promise.resolve({ seed: "Kubernetes" }),
    });

    expect(getSkillGraph).toHaveBeenCalledWith({
      seed: "Kubernetes",
      owned_skills: [],
      limit: 30,
    });
  });

  it("keeps an API failure honest instead of filling the graph", async () => {
    vi.mocked(getSkillGraph).mockRejectedValue(new Error("backend unavailable"));

    render(await SkillGraphPage());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "스킬 관계 데이터를 불러오지 못했습니다.",
    );
    expect(screen.getByText(/임의 데이터로 채우지 않았습니다/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
      "href",
      "/skill-map",
    );
  });
});
