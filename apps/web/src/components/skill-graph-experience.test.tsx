import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FitAnalyzeResponse, SkillGraphResponse } from "@/lib/types";

import { SkillGraphExperience } from "./skill-graph-experience";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));

const graph: SkillGraphResponse = {
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
  meta: { limit: 30, min_confidence: 0.8 },
};

const fitResponse: FitAnalyzeResponse = {
  coverage: {
    matching_posting_count: 17,
    strong_fit_posting_count: 6,
  },
  recommended_next_skills: [
    {
      skill: "Kubernetes",
      reason: "공개 공고에서 인프라 운영 요구와 함께 확인됐습니다.",
      required_count: 8,
      preferred_count: 3,
      supporting_posting_count: 10,
    },
  ],
  domain_branches: [
    {
      domain: "backend",
      covered_skills: ["C++"],
      missing_required_skills: ["Kubernetes"],
      missing_preferred_skills: [],
      supporting_posting_count: 9,
    },
  ],
};

function jsonResponse(body: FitAnalyzeResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("SkillGraphExperience", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    localStorage.clear();
    navigation.push.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => jsonResponse(fitResponse));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("makes the next learning decision clear", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "스킬맵" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("내 기술과 함께 자주 요구되는 기술을 보여줍니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("내 기술")).toBeInTheDocument();
    expect(screen.getByText("다음에 배울 기술")).toBeInTheDocument();
    expect(screen.getByText("함께 요구되는 기술")).toBeInTheDocument();
    expect(screen.getByText("필수·우대 미표기")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "관련 공고" }),
    ).toBeChecked();
    expect(
      screen.queryByText("공고 근거 노드", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "내 기술을 추가하면 공고에서 함께 요구되는 기술이 표시됩니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/내 스택|기술 맵|다음 준비|미분류/),
    ).not.toBeInTheDocument();
  });

  it("links quick skills to a newly seeded graph", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    const quickSkills = screen.getByRole("navigation", {
      name: "빠른 기술 선택",
    });
    expect(within(quickSkills).getByRole("link", { name: "ROS2" })).toHaveAttribute(
      "href",
      "/skills/graph?seed=ROS2",
    );
  });

  it("persists owned skills and renders API-backed next-skill evidence", async () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    fireEvent.change(screen.getByLabelText("기술 추가"), {
      target: { value: "Kubernetes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills")!)).toEqual([
        "Kubernetes",
      ]);
    });
    expect(
      screen.getByText("Kubernetes 기술을 현재 목록에 추가했습니다."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/skills/graph/fit",
      expect.objectContaining({
        body: JSON.stringify({ owned_skills: ["Kubernetes"] }),
        method: "POST",
      }),
    );
    expect(
      await screen.findByRole("link", {
        name: "Kubernetes 10개 공고 근거",
      }),
    ).toHaveAttribute("href", "/skill-map?skill=Kubernetes");
    expect(
      screen.getByText("공개 공고에서 인프라 운영 요구와 함께 확인됐습니다."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kubernetes 제거" }));
    expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills")!)).toEqual([]);
  });

  it("explains an empty filter result and restores the graph", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "그래프 검색" }), {
      target: { value: "존재하지않는기술" },
    });
    expect(
      screen.getByText(
        "표시할 기술이 없습니다. 검색어나 분야 필터를 줄여 주세요.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(
      screen.queryByText(
        "표시할 기술이 없습니다. 검색어나 분야 필터를 줄여 주세요.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "그래프 검색" })).toHaveValue("");
  });

  it("does not attach unrelated job evidence when no skill can be selected", () => {
    render(
      <SkillGraphExperience
        initialGraph={{
          ...graph,
          seed: null,
          nodes: [],
          edges: [],
        }}
        initialOwnedSkills={[]}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /자율주행 SW 엔지니어/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "기술을 선택해 주세요" }),
    ).toBeInTheDocument();
    expect(screen.getByText("확인 가능한 관련 공고가 없습니다.")).toBeInTheDocument();
  });

  it("clears an earlier recommendation while an updated stack fails to load", async () => {
    let resolveSecondRequest: ((response: Response) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce(jsonResponse(fitResponse))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondRequest = resolve;
          }),
      );

    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={["C++"]} />,
    );

    expect(
      await screen.findByText(
        "공개 공고에서 인프라 운영 요구와 함께 확인됐습니다.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("기술 추가"), {
      target: { value: "ROS2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByText(
        "공개 공고에서 인프라 운영 요구와 함께 확인됐습니다.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("내 기술과 공고를 비교하고 있습니다.").length,
    ).toBeGreaterThan(0);

    resolveSecondRequest?.(jsonResponse(fitResponse, 503));

    expect(
      (
        await screen.findAllByText(
          "내 기술을 비교하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        "공개 공고에서 인프라 운영 요구와 함께 확인됐습니다.",
      ),
    ).not.toBeInTheDocument();
  });
});
