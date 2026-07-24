import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, getSkillGraphEvidence } from "@/lib/api";
import type { SkillGraphEvidenceResponse } from "@/lib/types";

import { GET } from "./route";


vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getSkillGraphEvidence: vi.fn(),
  };
});


const evidenceResponse: SkillGraphEvidenceResponse = {
  items: [
    {
      posting_id: "job-1",
      title: "C++ Engineer",
      company_name: "검증 기업",
      skills: ["C++"],
      required: ["C++"],
      preferred: [],
      unspecified: [],
    },
  ],
  total: 1,
};


describe("skill graph evidence route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires a selected skill", async () => {
    const response = await GET(
      new Request("http://localhost/skills/graph/evidence?limit=6"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "기술을 선택해 주세요." });
    expect(getSkillGraphEvidence).not.toHaveBeenCalled();
  });

  it("bounds the limit and forwards the request abort signal", async () => {
    vi.mocked(getSkillGraphEvidence).mockResolvedValue(evidenceResponse);
    const request = new Request(
      "http://localhost/skills/graph/evidence?skill=C%2B%2B&career_type=experienced&limit=100",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getSkillGraphEvidence).toHaveBeenCalledWith(
      { skill: "C++", career_type: "experienced", limit: 20 },
      expect.any(AbortSignal),
    );
    expect(await response.json()).toEqual(evidenceResponse);
  });

  it("preserves backend ApiError status and message", async () => {
    vi.mocked(getSkillGraphEvidence).mockRejectedValue(
      new ApiError("http://backend/api/graph/skills/evidence", 503),
    );

    const response = await GET(
      new Request("http://localhost/skills/graph/evidence?skill=Python"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error:
        "API request failed: http://backend/api/graph/skills/evidence (503)",
    });
  });
});
