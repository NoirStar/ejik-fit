import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SkillGraphPage from "./page";

import { getSkillGraph } from "@/lib/api";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));


vi.mock("@/lib/api", () => ({
  getSkillGraph: vi.fn(),
}));


describe("SkillGraphPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            items: [
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
            total: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

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
      evidence: [],
      meta: {
        limit: 30,
        min_confidence: 0.8,
      },
    });

    render(await SkillGraphPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "스킬맵" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("내 기술과 함께 자주 요구되는 기술을 보여줍니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("기술 채용 인텔리전스")).not.toBeInTheDocument();
    expect(screen.queryByText("Tech Hiring Intelligence")).not.toBeInTheDocument();
    expect(screen.getAllByText("C++").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ROS2").length).toBeGreaterThan(0);
    expect(
      await screen.findByRole("link", { name: /자율주행 SW 엔지니어/ }),
    ).toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByText("내 기술")).toBeInTheDocument();
    expect(screen.getByText("그래프 범위")).toBeInTheDocument();
    expect(screen.getByText("다음에 배울 기술")).toBeInTheDocument();
    expect(screen.getByText("함께 요구되는 기술")).toBeInTheDocument();
    expect(screen.getByText("언급 공고")).toBeInTheDocument();
    expect(screen.getByText("18건")).toBeInTheDocument();
    expect(screen.getByText("필수·우대 미표기")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
    expect(screen.queryByText("채용 캘린더")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "설정" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "이직핏 기술 맵 홈" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("주변 깊이")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택 주변" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
      include_evidence: false,
    });
  });

  it("keeps an API failure honest instead of filling the graph", async () => {
    vi.mocked(getSkillGraph).mockRejectedValue(new Error("backend unavailable"));

    render(
      await SkillGraphPage({
        searchParams: Promise.resolve({
          seed: "Kubernetes",
          owned_skills: "Linux",
        }),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "스킬맵을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(screen.getByText("그래프 범위 확인 불가")).toBeInTheDocument();
    expect(screen.queryByText(/0개 스킬/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
      "href",
      "/skills/graph?seed=Kubernetes&owned_skills=Linux",
    );
    expect(
      within(screen.getByRole("group", { name: "현재 그래프 규모" })).getAllByText(
        "확인 불가",
      ),
    ).toHaveLength(3);
  });
});
