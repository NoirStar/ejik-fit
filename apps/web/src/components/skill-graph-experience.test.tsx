import {
  act,
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
  SkillCatalogItem,
  SkillGraphEvidenceResponse,
  SkillGraphResponse,
} from "@/lib/types";
import { writeOwnedSkills } from "@/lib/owned-skills";

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function topologyResponse(
  sourceGraph: SkillGraphResponse,
  input: RequestInfo | URL,
  status = 200,
) {
  const url = new URL(String(input), "http://localhost");
  const requestedSeed = url.searchParams.get("seed");
  const canonicalSeed = requestedSeed
    ? sourceGraph.nodes.find(
        (node) =>
          node.id.toLocaleLowerCase("en-US") ===
          requestedSeed.toLocaleLowerCase("en-US"),
      )?.id ?? requestedSeed
    : null;
  return new Response(
    JSON.stringify({
      ...sourceGraph,
      seed: canonicalSeed,
      nodes: sourceGraph.nodes.map((node) => ({
        ...node,
        seed: node.id === canonicalSeed,
      })),
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
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
    window.history.replaceState(null, "", "/skills/graph");
    navigation.push.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return topologyResponse(graph, input);
      }
      if (url.startsWith("/skills/graph/evidence")) {
        return evidenceResponse({ items: [], total: 0 });
      }
      return jsonResponse(fitResponse);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts with the market atlas and keeps controls compact", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "스킬맵" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "공개 채용 공고에서 함께 요구되는 기술 관계를 보고 다음 학습 방향을 정해 보세요.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("내 기술", { selector: "summary" })).toBeInTheDocument();
    expect(screen.getByText("보기 설정", { selector: "summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "핵심" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "주요만" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("다음에 배울 기술")).toBeInTheDocument();
    expect(screen.getByText("함께 요구되는 기술")).toBeInTheDocument();
    expect(screen.getByText("필수·우대 미표기")).toBeInTheDocument();
    expect(screen.queryByText("내 기술과 공고 비교")).not.toBeInTheDocument();
    expect(screen.queryByText("공고 동시 등장")).not.toBeInTheDocument();
    expect(screen.queryByText("공식 원문 기반")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "주변 깊이" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "직접 연결" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "두 단계" }))
      .not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "관련 공고" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "연결 없는 기술" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체 지도" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "선택 주변 보기" })).toBeDisabled();
    expect(
      screen.queryByText("공고 근거 노드", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "내 기술을 추가하면 공고에서 함께 요구되는 학습 후보를 찾습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/내 스택|기술 맵|다음 준비|미분류/),
    ).not.toBeInTheDocument();
    const legend = screen.getByRole("note", { name: "스킬맵 범례" });
    expect(legend).toHaveTextContent("크기: 시장 수요");
    expect(legend).toHaveTextContent("색: 기술 분야");
    expect(legend).toHaveTextContent("테두리: 내 기술");
    expect(legend).toHaveTextContent("점: 학습 추천");
    expect(legend).toHaveTextContent("선 농도: 함께 요구");
    expect(
      [...legend.querySelectorAll("i")].every(
        (marker) => marker.getAttribute("aria-hidden") === "true",
      ),
    ).toBe(true);
    expect(screen.getByText("2개 기술 · 1개 관계")).toBeInTheDocument();
    expect(screen.queryByText("전체 근거")).not.toBeInTheDocument();
    const inspector = screen.getByRole("complementary", {
      name: "선택 기술 분석",
    });
    expect(within(inspector).getByText("직접 연결").parentElement)
      .toHaveTextContent("—");
    expect(
      screen.getByText("기술을 선택하면 관련 공고를 확인할 수 있습니다."),
    ).toBeInTheDocument();
  });

  it("changes paint density without requesting another topology", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );
    const topologyCallsBefore = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/skills/graph/data"),
    ).length;

    fireEvent.click(screen.getByRole("button", { name: "자세히" }));
    fireEvent.click(screen.getByRole("button", { name: "더 많이" }));

    expect(screen.getByRole("button", { name: "자세히" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "더 많이" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/skills/graph/data"),
    )).toHaveLength(topologyCallsBefore);
  });

  it("shows and toggles an owned-skill market connection without refetching", () => {
    render(
      <SkillGraphExperience
        initialGraph={graph}
        initialOwnedSkills={["C++"]}
        initialSelectedSkill="ROS2"
      />,
    );
    const topologyCallsBefore = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/skills/graph/data"),
    ).length;

    expect(screen.getByRole("heading", {
      level: 2,
      name: "내 기술과의 시장 연결",
    })).toBeInTheDocument();
    expect(screen.getByLabelText("시장 연결 경로: C++에서 ROS2까지"))
      .toHaveTextContent("C++ROS2");
    expect(screen.getByText(
      "공고에서 함께 요구된 강한 관계를 따라 표시합니다. 학습 순서를 뜻하지 않습니다.",
    )).toBeInTheDocument();

    const pathButton = screen.getByRole("button", {
      name: "그래프에서 경로 보기",
    });
    fireEvent.click(pathButton);

    expect(screen.getByRole("button", { name: "경로 강조 끄기" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/skills/graph/data"),
    )).toHaveLength(topologyCallsBefore);
  });

  it("uses catalog aliases when marking and removing an owned graph node", () => {
    const goCatalog: SkillCatalogItem[] = [{
      name: "Go",
      category: "language",
      kind: "language",
      domains: ["backend"],
      aliases: ["golang"],
    }];
    const goGraph: SkillGraphResponse = {
      ...graph,
      seed: "Go",
      nodes: [{
        ...graph.nodes[0]!,
        id: "Go",
        label: "Go",
        domains: ["backend"],
        seed: true,
      }],
      edges: [],
    };

    render(
      <SkillGraphExperience
        initialGraph={goGraph}
        initialOwnedSkills={["golang"]}
        initialSkillCatalog={goCatalog}
      />,
    );

    const remove = screen.getByRole("button", {
      name: "Go 내 기술에서 제거",
    });
    fireEvent.click(remove);
    expect(screen.getByRole("button", { name: "Go 내 기술에 추가" }))
      .toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills") ?? "[]"))
      .toEqual([]);
  });

  it("loads official job evidence only after a skill is selected", async () => {
    let resolveEvidence: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return Promise.resolve(topologyResponse(graph, input));
      }
      if (url.startsWith("/skills/graph/evidence")) {
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

    expect(screen.getByRole("button", { name: "전체 지도" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/skills/graph/data"),
      ),
    ).toHaveLength(0);
    expect(screen.getByText("관련 공고를 불러오는 중입니다.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/skills/graph/evidence?skill=C%2B%2B&limit=6",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    resolveEvidence?.(evidenceResponse(selectedEvidence));

    expect(
      await screen.findByRole("link", { name: /자율주행 SW 엔지니어/ }),
    ).toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByRole("button", { name: "C++ 내 기술에 추가" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "C++ 관련 공고 모두 보기" }))
      .toHaveAttribute("href", "/search?q=C%2B%2B&scope=jobs");
    expect(screen.getByText("1건")).toBeInTheDocument();
  });

  it("loads a two-step neighborhood only when the user asks for it", async () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "C++" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 주변 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "두 단계" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/skills/graph/data?limit=30&depth=2&seed=C%2B%2B",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(screen.getByRole("button", { name: "두 단계" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.location.search).toContain("depth=2");
  });

  it("keeps page scrolling until mobile graph interaction is explicitly enabled", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    const frame = screen.getByTestId("skill-graph-frame");
    const toggle = screen.getByRole("button", { name: "그래프 조작 시작" });
    expect(frame).toHaveAttribute("data-touch-interaction", "disabled");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    expect(frame).toHaveAttribute("data-touch-interaction", "enabled");
    expect(screen.getByRole("button", { name: "그래프 조작 종료" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("loads server-backed topology only after an explicit nearby action", async () => {
    const focusedGraph: SkillGraphResponse = {
      ...graph,
      seed: "C++",
      nodes: [
        { ...graph.nodes[0]!, seed: true },
        ...graph.nodes.slice(1),
        {
          ...graph.nodes[0]!,
          id: "Python",
          label: "Python",
          demand_count: 14,
          seed: false,
        },
      ],
      edges: [
        ...graph.edges,
        {
          ...graph.edges[0]!,
          id: "C++:Python",
          target: "Python",
          score: 0.76,
        },
        {
          ...graph.edges[0]!,
          id: "Python:ROS2",
          source: "Python",
          target: "ROS2",
          score: 0.68,
        },
      ],
    };
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return topologyResponse(focusedGraph, input);
      }
      if (url.startsWith("/skills/graph/evidence")) {
        return evidenceResponse({ items: [], total: 0 });
      }
      return jsonResponse(fitResponse);
    });

    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "C++" }));
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/skills/graph/data"),
      ),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "선택 주변 보기" }));

    expect(
      await screen.findByRole("button", { name: "Python" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/skills/graph/data?limit=30&depth=1&seed=C%2B%2B",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("keeps the explicit nearby canvas within the local performance budget", async () => {
    const neighborNodes = Array.from({ length: 24 }, (_, index) => ({
      ...graph.nodes[1]!,
      id: `neighbor-${index + 1}`,
      label: `neighbor-${index + 1}`,
      demand_count: 24 - index,
    }));
    const focusedGraph: SkillGraphResponse = {
      ...graph,
      seed: "C++",
      nodes: [{ ...graph.nodes[0]!, seed: true }, ...neighborNodes],
      edges: neighborNodes.map((node, index) => ({
        ...graph.edges[0]!,
        id: `C++:${node.id}`,
        target: node.id,
        score: 1 - index / 100,
      })),
    };
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return topologyResponse(focusedGraph, input);
      }
      if (url.startsWith("/skills/graph/evidence")) {
        return evidenceResponse({ items: [], total: 0 });
      }
      return jsonResponse(fitResponse);
    });

    const { container } = render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "C++" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 주변 보기" }));

    await waitFor(() => {
      expect(container.querySelectorAll(".graph-node")).toHaveLength(18);
    });
  });

  it("retries a failed topology request without changing the selection", async () => {
    let topologyRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        topologyRequests += 1;
        if (topologyRequests === 1) {
          return jsonResponse({ detail: "graph unavailable" }, 503);
        }
        return topologyResponse(graph, input);
      }
      if (url.startsWith("/skills/graph/evidence")) {
        return evidenceResponse({ items: [], total: 0 });
      }
      return jsonResponse(fitResponse);
    });

    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "C++" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 주변 보기" }));

    expect(await screen.findByText("이전 관계망 표시 중")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "C++" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "관계망 다시 시도" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText("이전 관계망 표시 중"),
      ).not.toBeInTheDocument();
    });
    expect(topologyRequests).toBe(2);
    expect(
      screen.getByRole("heading", { level: 2, name: "C++" }),
    ).toBeInTheDocument();
  });

  it("keeps career scope in fit, evidence, and selection URLs", async () => {
    window.history.replaceState(
      null,
      "",
      "/skills/graph?career_type=experienced&owned_skills=Linux",
    );
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return Promise.resolve(topologyResponse(graph, input));
      }
      if (url.startsWith("/skills/graph/evidence")) {
        return Promise.resolve(evidenceResponse(selectedEvidence));
      }
      return Promise.resolve(jsonResponse(fitResponse));
    });

    render(
      <SkillGraphExperience
        careerType="experienced"
        initialGraph={graph}
        initialOwnedSkills={["Linux"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "C++" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 주변 보기" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/skills/graph/fit",
        expect.objectContaining({
          body: JSON.stringify({
            owned_skills: ["Linux"],
            career_type: "experienced",
          }),
        }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/skills/graph/evidence?skill=C%2B%2B&career_type=experienced&limit=6",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/skills/graph/data?limit=30&depth=1&seed=C%2B%2B&career_type=experienced",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(window.location.pathname).toBe("/skills/graph");
    expect(window.location.search).toContain("career_type=experienced");
    expect(window.location.search).toContain("owned_skills=Linux");
    expect(window.location.search).toContain("seed=C%2B%2B");
  });

  it("isolates evidence cache entries by career scope", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return topologyResponse(graph, input);
      }
      if (url.startsWith("/skills/graph/evidence")) {
        return evidenceResponse(selectedEvidence);
      }
      return jsonResponse(fitResponse);
    });
    const { rerender } = render(
      <SkillGraphExperience
        careerType="experienced"
        initialGraph={graph}
        initialOwnedSkills={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "C++" }));
    await screen.findByRole("link", { name: /자율주행 SW 엔지니어/ });

    rerender(
      <SkillGraphExperience
        careerType="new_comer"
        initialGraph={{ ...graph, seed: "C++" }}
        initialOwnedSkills={[]}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/skills/graph/evidence?skill=C%2B%2B&career_type=new_comer&limit=6",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/skills/graph/evidence"),
      ),
    ).toHaveLength(2);
  });

  it("restores an atlas selection from browser history without replacing topology", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "C++" }));

    window.history.pushState(null, "", "/skills/graph?seed=ROS2");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(
      screen.getByRole("complementary", { name: "선택 기술 분석" }),
    ).toHaveTextContent("ROS2");
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/skills/graph/data"),
      ),
    ).toHaveLength(0);
  });

  it("canonicalizes a catalog alias restored from browser history", async () => {
    const aliasGraph: SkillGraphResponse = {
      ...graph,
      seed: "Go",
      nodes: [
        {
          ...graph.nodes[0]!,
          id: "Go",
          label: "Go",
          domains: ["backend"],
          seed: true,
        },
        graph.nodes[1]!,
      ],
      edges: [{
        ...graph.edges[0]!,
        id: "Go:ROS2",
        source: "Go",
        target: "ROS2",
      }],
    };
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return topologyResponse(aliasGraph, input);
      }
      if (url.startsWith("/skills/graph/evidence")) {
        return evidenceResponse({ items: [], total: 0 });
      }
      return jsonResponse(fitResponse);
    });
    window.history.replaceState(null, "", "/skills/graph?seed=golang");
    render(
      <SkillGraphExperience
        initialGraph={aliasGraph}
        initialOwnedSkills={[]}
        initialSkillCatalog={[{
          name: "Go",
          category: "language",
          kind: "language",
          domains: ["backend"],
          aliases: ["golang"],
        }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "ROS2" }));

    window.history.pushState(null, "", "/skills/graph?seed=golang");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(
      await within(
        screen.getByRole("complementary", { name: "선택 기술 분석" }),
      ).findByRole("heading", { level: 2, name: "Go" }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.startsWith("/skills/graph/data")),
    ).toEqual([]);
  });

  it("moves repeated selection to the detail panel", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    const node = screen.getByRole("button", { name: "C++" });
    fireEvent.click(node);
    fireEvent.click(node);

    const inspector = screen.getByRole("complementary", {
      name: "선택 기술 분석",
    });
    const firstAction = within(inspector).getByRole("link", {
      name: "C++ 관련 공고 모두 보기",
    });
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(firstAction).toHaveFocus();
  });

  it("replaces the quick-link strip with a searchable atlas", () => {
    const expandedGraph: SkillGraphResponse = {
      ...graph,
      nodes: Array.from({ length: 10 }, (_, index) => ({
        ...graph.nodes[index % graph.nodes.length]!,
        id: `skill-${index}`,
        label: `Skill ${index}`,
        demand_count: 20 - index,
      })),
      edges: [],
    };
    render(
      <SkillGraphExperience
        initialGraph={expandedGraph}
        initialOwnedSkills={[]}
      />,
    );

    expect(
      screen.queryByRole("navigation", { name: "빠른 기술 선택" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "기술 찾기" }))
      .toBeInTheDocument();
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
      if (url.startsWith("/skills/graph/data")) {
        return Promise.resolve(topologyResponse(raceGraph, input));
      }
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
    let evidenceRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return topologyResponse(graph, input);
      }
      if (url.startsWith("/skills/graph/evidence")) {
        evidenceRequests += 1;
        if (evidenceRequests === 1) {
          throw new Error("evidence unavailable");
        }
        return evidenceResponse({ items: [], total: 0 });
      }
      return jsonResponse(fitResponse);
    });

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
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/skills/graph/evidence"),
      ),
    ).toHaveLength(2);
  });

  it("does not render a duplicate quick-skill navigation", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    expect(
      screen.queryByRole("navigation", { name: "빠른 기술 선택" }),
    ).not.toBeInTheDocument();
  });

  it("persists owned skills and renders API-backed next-skill evidence", async () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    fireEvent.change(screen.getByLabelText("추가할 기술"), {
      target: { value: "Kubernetes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills")!)).toEqual([
        "Kubernetes",
      ]);
    });
    expect(
      screen.getByText("Kubernetes 기술을 내 기술에 추가했습니다."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/skills/graph/fit",
      expect.objectContaining({
        body: JSON.stringify({ owned_skills: ["Kubernetes"] }),
        method: "POST",
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Kubernetes 기술 지도에서 보기",
      }),
    ).toHaveTextContent("10건");
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
      "점: 학습 추천",
    );
  });

  it("updates graph ownership when the shared header edits saved skills", async () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );
    const node = screen.getByRole("button", { name: "C++" });
    expect(node).toHaveAttribute("data-owned", "false");

    act(() => {
      writeOwnedSkills(["C++"]);
    });
    await waitFor(() => expect(node).toHaveAttribute("data-owned", "true"));

    act(() => {
      writeOwnedSkills([]);
    });
    await waitFor(() => expect(node).toHaveAttribute("data-owned", "false"));
  });

  it("uses the same identity for aliased owned nodes and removal", async () => {
    const aliasGraph: SkillGraphResponse = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          ...graph.nodes[0]!,
          id: "Kubernetes",
          label: "Kubernetes",
          owned: false,
        },
      ],
    };
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/skills/graph/data")) {
        return topologyResponse(aliasGraph, input);
      }
      if (url.startsWith("/skills/graph/evidence")) {
        return evidenceResponse({ items: [], total: 0 });
      }
      return jsonResponse(fitResponse);
    });

    render(
      <SkillGraphExperience
        initialGraph={aliasGraph}
        initialOwnedSkills={["k8s"]}
      />,
    );

    const node = screen.getByRole("button", { name: "Kubernetes" });
    expect(node).toHaveAttribute("data-owned", "true");
    fireEvent.click(node);

    const remove = await screen.findByRole("button", {
      name: "Kubernetes 내 기술에서 제거",
    });
    fireEvent.click(remove);

    await waitFor(() => {
      expect(localStorage.getItem("ejik-fit:owned-skills")).toBe("[]");
    });
    expect(node).toHaveAttribute("data-owned", "false");
  });

  it("does not rearrange or empty the atlas while the user types a search", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "기술 찾기" }), {
      target: { value: "존재하지않는기술" },
    });
    expect(
      screen.queryByText(
        "표시할 기술이 없습니다. 검색어나 분야 필터를 줄여 주세요.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "C++" })).toBeInTheDocument();
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
      screen.getByRole("heading", { name: "기술 하나를 선택하세요" }),
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

    fireEvent.change(screen.getByLabelText("추가할 기술"), {
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
