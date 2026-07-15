import { beforeEach, describe, expect, it, vi } from "vitest";

import { analyzeFit, ApiError } from "@/lib/api";
import type { FitAnalyzeResponse } from "@/lib/types";

import { POST } from "./route";


vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    analyzeFit: vi.fn(),
  };
});


const fitResponse: FitAnalyzeResponse = {
  coverage: {
    matching_posting_count: 0,
    strong_fit_posting_count: 0,
  },
  domain_branches: [],
  recommended_next_skills: [],
};


describe("skill graph fit route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns backend ApiError status and message as JSON", async () => {
    vi.mocked(analyzeFit).mockRejectedValue(
      new ApiError("http://backend/api/fit/analyze", 503),
    );

    const response = await POST(
      new Request("http://localhost/skills/graph/fit", {
        method: "POST",
        body: JSON.stringify({
          owned_skills: ["C++"],
          domains: ["robotics"],
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "API request failed: http://backend/api/fit/analyze (503)",
    });
  });

  it("returns a controlled 400 response for an empty or malformed body", async () => {
    const response = await POST(
      new Request("http://localhost/skills/graph/fit", {
        method: "POST",
        body: "",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "유효한 JSON 요청이 필요합니다." });
    expect(analyzeFit).not.toHaveBeenCalled();
  });

  it("forwards fit payloads to the backend helper", async () => {
    vi.mocked(analyzeFit).mockResolvedValue(fitResponse);
    const controller = new AbortController();

    const response = await POST(
      new Request("http://localhost/skills/graph/fit", {
        method: "POST",
        body: JSON.stringify({
          owned_skills: ["C++"],
          domains: ["robotics"],
        }),
        signal: controller.signal,
      }),
    );

    expect(response.status).toBe(200);
    expect(analyzeFit).toHaveBeenCalledWith(
      {
        owned_skills: ["C++"],
        domains: ["robotics"],
      },
      expect.any(AbortSignal),
    );
    expect(vi.mocked(analyzeFit).mock.calls[0][1]?.aborted).toBe(false);
    expect(await response.json()).toEqual(fitResponse);
  });
});
