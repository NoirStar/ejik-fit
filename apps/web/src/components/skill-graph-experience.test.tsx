import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  FitAnalyzeResponse,
  SkillGraphEvidenceResponse,
  SkillGraphResponse,
} from "@/lib/types";

import { SkillGraphExperience } from "./skill-graph-experience";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));

const graph: SkillGraphResponse = {
  seed: null,
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
      seed: false,
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

function evidenceResponse(
  body: SkillGraphEvidenceResponse,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const selectedEvidence: SkillGraphEvidenceResponse = {
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
};

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

  it("starts with a sparse market overview and removes density controls", () => {
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
    expect(screen.queryByLabelText("주변 깊이")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "관련 공고" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "연결 없는 기술" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시장 핵심" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "선택 주변" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "전체 기술" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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
    const legend = screen.getByRole("note", { name: "스킬맵 범례" });
    expect(legend).toHaveTextContent("크기: 시장 수요");
    expect(legend).toHaveTextContent("테두리: 내 기술");
    expect(legend).toHaveTextContent("선 농도: 함께 요구");
    expect(screen.getByText("표시 기술")).toBeInTheDocument();
    expect(screen.getByText("표시 관계")).toBeInTheDocument();
    expect(screen.getByText("전체 근거")).toBeInTheDocument();
    const inspector = screen.getByRole("complementary", {
      name: "선택 기술 분석",
    });
    expect(within(inspector).getByText("직접 연결").parentElement)
      .toHaveTextContent("—");
    expect(
      screen.getByText("기술을 선택하면 관련 공고를 확인할 수 있습니다."),
    ).toBeInTheDocument();
  });

  it("loads official job evidence only after a skill is selected", async () => {
    let resolveEvidence: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input) => {
      if (String(input).startsWith("/skills/graph/evidence")) {
        return new Promise<Response>((resolve) => {
          resolveEvidence = resolve;
        });
      }
      return Promise.resolve(jsonResponse(fitResponse));
    });

    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "C++" }));

    expect(screen.getByRole("button", { name: "선택 주변" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("관련 공고를 불러오는 중입니다.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/skills/graph/evidence?skill=C%2B%2B&limit=6",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    resolveEvidence?.(evidenceResponse(selectedEvidence));

    expect(
      await screen.findByRole("link", { name: /자율주행 SW 엔지니어/ }),
    ).toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByText("1건")).toBeInTheDocument();
  });

  it("does not replace newer evidence with a late response", async () => {
    const raceGraph: SkillGraphResponse = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          ...graph.nodes[0]!,
          id: "Python",
          label: "Python",
          demand_count: 12,
        },
      ],
      edges: [
        ...graph.edges,
        {
          ...graph.edges[0]!,
          id: "C++:Python",
          target: "Python",
        },
      ],
    };
    let resolveCpp: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("skill=C%2B%2B")) {
        return new Promise<Response>((resolve) => {
          resolveCpp = resolve;
        });
      }
      if (url.includes("skill=Python")) {
        return Promise.resolve(
          evidenceResponse({
            items: [
              {
                ...selectedEvidence.items[0]!,
                posting_id: "python-job",
                title: "Python Backend Engineer",
                skills: ["Python"],
                required: ["Python"],
              },
            ],
            total: 1,
          }),
        );
      }
      return Promise.resolve(jsonResponse(fitResponse));
    });

    render(
      <SkillGraphExperience initialGraph={raceGraph} initialOwnedSkills={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "C++" }));
    fireEvent.click(screen.getByRole("button", { name: "Python" }));

    expect(
      await screen.findByRole("link", { name: /Python Backend Engineer/ }),
    ).toBeInTheDocument();

    resolveCpp?.(evidenceResponse(selectedEvidence));

    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: /자율주행 SW 엔지니어/ }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /Python Backend Engineer/ }),
    ).toBeInTheDocument();
  });

  it("shows an evidence failure and retries the selected skill", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("evidence unavailable"))
      .mockResolvedValueOnce(evidenceResponse({ items: [], total: 0 }));

    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "C++" }));

    expect(
      await screen.findByText("근거 공고를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByText("현재 공개된 근거 공고가 없습니다."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it("reflects owned and recommended states on graph nodes", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...fitResponse,
        recommended_next_skills: [
          {
            ...fitResponse.recommended_next_skills[0]!,
            skill: "ROS2",
          },
        ],
      }),
    );

    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={["C++"]} />,
    );

    expect(screen.getByRole("button", { name: "C++" })).toHaveAttribute(
      "data-owned",
      "true",
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "ROS2" })).toHaveAttribute(
        "data-recommended",
        "true",
      );
    });
    expect(screen.getByRole("note", { name: "스킬맵 범례" })).toHaveTextContent(
      "점선: 추천 기술",
    );
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
    expect(
      screen.getByText("기술을 선택하면 관련 공고를 확인할 수 있습니다."),
    ).toBeInTheDocument();
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
