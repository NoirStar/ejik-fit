import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SkillGraphPage from "./page";

import { getSkillGraph } from "@/lib/api";


vi.mock("@/lib/api", () => ({
  getSkillGraph: vi.fn(),
}));


describe("SkillGraphPage", () => {
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

    expect(
      screen.getByRole("heading", { name: /스킬 그래프/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("C++").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ROS2").length).toBeGreaterThan(0);
    expect(screen.getByText("자율주행 SW 엔지니어")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Groups")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();
    expect(screen.getByText("Forces")).toBeInTheDocument();
    expect(screen.getByLabelText("Local depth")).toBeInTheDocument();
  });
});
