import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

import { getSkillGraph } from "@/lib/api";


vi.mock("@/lib/api", () => ({
  getSkillGraph: vi.fn(),
}));


describe("Home", () => {
  it("renders the product dashboard instead of a landing page", async () => {
    vi.mocked(getSkillGraph).mockResolvedValue({
      seed: "C++",
      nodes: [],
      edges: [],
      evidence: [],
      meta: {
        limit: 30,
        min_confidence: 0.8,
      },
    });

    render(await Home());

    expect(
      screen.getByRole("heading", { name: "기술 채용 인텔리전스" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("기술 채용 인텔리전스 대시보드")).toBeInTheDocument();
    expect(screen.getByText("채용 캘린더")).toBeInTheDocument();
  });
});
