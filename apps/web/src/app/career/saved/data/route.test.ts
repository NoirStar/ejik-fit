import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function request(
  body: unknown,
  signal?: AbortSignal,
  extraHeaders: Record<string, string> = {},
) {
  return new Request("http://localhost/career/saved/data", {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
    signal,
  });
}

describe("saved job data route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(getPosting).toHaveBeenCalledWith(
      "job-python",
      expect.any(AbortSignal),
    );
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

  it("limits concurrent upstream detail requests", async () => {
    const ids = Array.from({ length: 6 }, (_, index) => `job-${index}`);
    const releases: Array<() => void> = [];
    let active = 0;
    let peakActive = 0;
    vi.mocked(getPosting).mockImplementation(async (id) => {
      active += 1;
      peakActive = Math.max(peakActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return { ...posting, id, title: id };
    });

    const responsePromise = POST(request({ job_ids: ids }));
    await vi.waitFor(() => expect(getPosting).toHaveBeenCalledTimes(4));
    expect(peakActive).toBe(4);

    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(getPosting).toHaveBeenCalledTimes(6));
    releases.splice(0).forEach((release) => release());

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(peakActive).toBe(4);
  });

  it("bounds upstream concurrency across simultaneous route requests", async () => {
    const releases: Array<() => void> = [];
    let active = 0;
    let peakActive = 0;
    vi.mocked(getPosting).mockImplementation(async (id) => {
      active += 1;
      peakActive = Math.max(peakActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return { ...posting, id, title: id };
    });

    const responsePromises = Array.from({ length: 12 }, (_, index) =>
      POST(request({ job_ids: [`parallel-${index}`] })),
    );
    await vi.waitFor(() => expect(getPosting).toHaveBeenCalledTimes(8));
    expect(peakActive).toBe(8);

    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(getPosting).toHaveBeenCalledTimes(12));
    releases.splice(0).forEach((release) => release());

    const responses = await Promise.all(responsePromises);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(peakActive).toBe(8);
  });

  it("propagates a caller abort to in-flight upstream requests", async () => {
    const caller = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    vi.mocked(getPosting).mockImplementation((_id, signal) => {
      upstreamSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      });
    });

    const responsePromise = POST(
      request({ job_ids: ["job-python"] }, caller.signal),
    );
    await vi.waitFor(() => expect(upstreamSignal).toBeInstanceOf(AbortSignal));
    caller.abort();

    const response = await responsePromise;
    expect(upstreamSignal?.aborted).toBe(true);
    expect((await response.json()).failed_ids).toEqual(["job-python"]);
  });

  it("aborts upstream detail requests after the lookup deadline", async () => {
    vi.useFakeTimers();
    let upstreamSignal: AbortSignal | undefined;
    vi.mocked(getPosting).mockImplementation((_id, signal) => {
      upstreamSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("timed out", "AbortError")),
          { once: true },
        );
      });
    });

    const responsePromise = POST(request({ job_ids: ["job-python"] }));
    await vi.advanceTimersByTimeAsync(0);
    expect(upstreamSignal).toBeInstanceOf(AbortSignal);
    await vi.advanceTimersByTimeAsync(8_000);

    const response = await responsePromise;
    expect(upstreamSignal?.aborted).toBe(true);
    expect((await response.json()).failed_ids).toEqual(["job-python"]);
  });

  it("rate-limits repeated lookup fan-out from the same forwarded client", async () => {
    const client = `review-${crypto.randomUUID()}`;
    const ids = Array.from({ length: 24 }, (_, index) => `job-${index}`);
    vi.mocked(getPosting).mockImplementation(async (id) => ({
      ...posting,
      id,
      title: id,
    }));

    let response: Response | undefined;
    for (let index = 0; index < 11; index += 1) {
      response = await POST(
        request({ job_ids: ids }, undefined, {
          "x-forwarded-for": client,
        }),
      );
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("60");
    expect(await response?.json()).toEqual({
      error: "저장 공고 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(getPosting).toHaveBeenCalledTimes(240);
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
