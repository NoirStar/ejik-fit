import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, getPosting } from "@/lib/api";
import type { PostingDetail } from "@/lib/types";

import { POST } from "./route";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getPosting: vi.fn(),
  };
});

const posting: PostingDetail = {
  id: "job-python",
  title: "Python Backend Engineer",
  company_name: "NAVER",
  company_slug: "naver",
  career_type: "experienced",
  employment_type: "FULL_TIME_WORKER",
  career_min: 3,
  career_max: 7,
  location: "서울",
  status: "open",
  source_url: "https://recruit.navercorp.com/job-python",
  last_verified_at: "2026-07-14T03:00:00.000Z",
  opens_at: null,
  closes_at: null,
  required_skills: ["Python"],
  preferred_skills: ["Docker"],
  unspecified_skills: [],
  description_html: "<p>민감하지 않지만 불필요한 원문</p>",
  description_text: "불필요한 원문",
  skills: ["Python", "Docker"],
};

function request(body: unknown) {
  return new Request("http://localhost/career/saved/data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("saved job data route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a controlled 400 for malformed or oversized ID input", async () => {
    for (const body of [
      {},
      { job_ids: [""] },
      { job_ids: Array.from({ length: 25 }, (_, index) => `job-${index}`) },
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "유효한 저장 공고 ID가 필요합니다.",
      });
    }
    expect(getPosting).not.toHaveBeenCalled();
  });

  it("returns compact actual items while separating 404 and retryable failures", async () => {
    vi.mocked(getPosting)
      .mockResolvedValueOnce(posting)
      .mockRejectedValueOnce(
        new ApiError("http://backend/api/postings/gone-job", 404),
      )
      .mockRejectedValueOnce(
        new ApiError("http://backend/api/postings/retry-job", 503),
      );

    const response = await POST(
      request({
        job_ids: ["job-python", "gone-job", "retry-job", "job-python"],
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getPosting).toHaveBeenCalledTimes(3);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: "job-python",
      sourceUrl: "https://recruit.navercorp.com/job-python",
      statusLabel: "공개 중",
    });
    expect(payload.items[0]).not.toHaveProperty("description_html");
    expect(payload.items[0]).not.toHaveProperty("description_text");
    expect(payload.unavailable_ids).toEqual(["gone-job"]);
    expect(payload.failed_ids).toEqual(["retry-job"]);
  });

  it("supports an empty saved list without contacting the API", async () => {
    const response = await POST(request({ job_ids: [] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [],
      unavailable_ids: [],
      failed_ids: [],
    });
    expect(getPosting).not.toHaveBeenCalled();
  });
});
