import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SkillGraphResponse } from "@/lib/types";

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

describe("SkillGraphExperience", () => {
  beforeEach(() => {
    localStorage.clear();
    navigation.push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the filter disclosure closed until the client resolves the viewport", () => {
    const markup = renderToStaticMarkup(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    expect(markup).not.toMatch(/<details[^>]*\sopen(?:="")?/);
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

  it("persists owned skills without turning co-occurrence into a learning recommendation", () => {
    render(
      <SkillGraphExperience initialGraph={graph} initialOwnedSkills={[]} />,
    );

    fireEvent.change(screen.getByLabelText("기술 추가"), {
      target: { value: "Kubernetes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills")!)).toEqual([
      "Kubernetes",
    ]);
    expect(
      screen.getByText("Kubernetes 기술을 현재 목록에 추가했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/필수 여부나 학습 순서를 뜻하지 않습니다/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/다음에 배울 기술/)).not.toBeInTheDocument();

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
    expect(screen.getByText("필터와 일치하는 기술이 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(screen.queryByText("필터와 일치하는 기술이 없습니다.")).not.toBeInTheDocument();
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
    expect(screen.getByText("확인 가능한 관련 공고가 없습니다.")).toBeInTheDocument();
  });

  it("summarizes the selected skill from graph evidence", () => {
    render(<SkillGraphExperience initialGraph={graph} initialOwnedSkills={["C++"]} />);

    expect(screen.getByText("선택 기술 근거")).toBeInTheDocument();
    expect(
      screen.getByText("관련 공고 1건과 반복해서 함께 나온 기술 1개를 확인했습니다."),
    ).toBeInTheDocument();
  });
});
