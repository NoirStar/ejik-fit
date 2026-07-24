import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, getSkillGraph } from "@/lib/api";
import type { SkillGraphResponse } from "@/lib/types";

import { GET } from "./route";


vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getSkillGraph: vi.fn(),
  };
});


const graphResponse: SkillGraphResponse = {
  seed: "C++",
  nodes: [],
  edges: [],
  evidence: [],
  meta: { limit: 5, min_confidence: 0.8 },
};


describe("skill graph data route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("coerces graph limit before forwarding to the backend", async () => {
    vi.mocked(getSkillGraph).mockResolvedValue(graphResponse);

    const response = await GET(
      new Request(
        "http://localhost/skills/graph/data?seed=C%2B%2B&owned_skills=C%2B%2B&career_type=experienced&limit=2",
      ),
    );

    expect(response.status).toBe(200);
    expect(getSkillGraph).toHaveBeenCalledWith({
      seed: "C++",
      owned_skills: ["C++"],
      career_type: "experienced",
      limit: 5,
      include_evidence: false,
    });
  });

  it("defaults invalid graph limits before forwarding to the backend", async () => {
    vi.mocked(getSkillGraph).mockResolvedValue({
      ...graphResponse,
      meta: { limit: 30, min_confidence: 0.8 },
    });

    await GET(
      new Request("http://localhost/skills/graph/data?limit=not-a-number"),
    );

    expect(getSkillGraph).toHaveBeenCalledWith({
      seed: undefined,
      owned_skills: [],
      career_type: undefined,
      limit: 30,
      include_evidence: false,
    });
  });

  it("returns backend ApiError status and message as JSON", async () => {
    vi.mocked(getSkillGraph).mockRejectedValue(
      new ApiError("http://backend/api/graph/skills?limit=bad", 422),
    );

    const response = await GET(
      new Request("http://localhost/skills/graph/data?limit=15"),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error:
        "API request failed: http://backend/api/graph/skills?limit=bad (422)",
    });
  });
});
