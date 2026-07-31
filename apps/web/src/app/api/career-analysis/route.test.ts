import { beforeEach, describe, expect, it, vi } from "vitest";

import { analyzeCareer } from "@/lib/api";
import { careerAnalysisFixture } from "@/features/career-analysis/test-fixture";

import { POST } from "./route";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(public url: string, public status: number) { super(); }
  },
  analyzeCareer: vi.fn(),
}));

describe("career analysis route", () => {
  beforeEach(() => vi.mocked(analyzeCareer).mockReset());

  it("forwards a bounded private analysis request", async () => {
    vi.mocked(analyzeCareer).mockResolvedValue(careerAnalysisFixture([]));
    const payload = {
      profile: {},
      owned_skills: [],
      limit: 12,
      offset: 0,
    };

    const response = await POST(new Request("http://localhost/api/career-analysis", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(analyzeCareer).toHaveBeenCalledWith(payload);
  });

  it("rejects malformed input before contacting the backend", async () => {
    const response = await POST(new Request("http://localhost/api/career-analysis", {
      method: "POST",
      body: JSON.stringify({ profile: null, owned_skills: [], limit: 0, offset: 0 }),
    }));

    expect(response.status).toBe(400);
    expect(analyzeCareer).not.toHaveBeenCalled();
  });
});
