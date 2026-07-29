import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings } from "@/lib/api";

import { GET } from "./route";

vi.mock("@/lib/api", () => ({ getPostings: vi.fn() }));

describe("home feed postings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPostings).mockResolvedValue({ items: [], total: 0 });
  });

  it.each([
    "offset=-1",
    "offset=10001",
    "offset=1.5",
    "limit=0",
    "limit=21",
    "career_type=unknown",
    "career_type=",
  ])("rejects invalid bounded parameters: %s", async (query) => {
    const response = await GET(
      new Request(`http://localhost/api/home-feed/postings?${query}`),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "잘못된 피드 요청입니다." });
    expect(getPostings).not.toHaveBeenCalled();
  });

  it("loads a bounded backend page with the selected career scope", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/home-feed/postings?offset=20&limit=20&career_type=experienced",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    expect(getPostings).toHaveBeenCalledWith({
      offset: 20,
      limit: 20,
      career_type: "experienced",
    });
  });

  it("forwards saved skills and keeps personalized pages private", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/home-feed/postings?owned_skills=C%2B%2B&owned_skills=Rust",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getPostings).toHaveBeenCalledWith({
      offset: 0,
      limit: 20,
      owned_skills: ["C++", "Rust"],
    });
  });

  it("falls back once to a generic page when personalization is unavailable", async () => {
    vi.mocked(getPostings)
      .mockRejectedValueOnce(new Error("personalization offline"))
      .mockResolvedValueOnce({ items: [], total: 12 });

    const response = await GET(
      new Request(
        "http://localhost/api/home-feed/postings?offset=20&owned_skills=C%2B%2B",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ejik-personalization")).toBe("fallback");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getPostings).toHaveBeenNthCalledWith(1, {
      offset: 20,
      limit: 20,
      owned_skills: ["C++"],
    });
    expect(getPostings).toHaveBeenNthCalledWith(2, {
      offset: 0,
      limit: 20,
    });
  });

  it("rejects an oversized saved-skill list", async () => {
    const query = Array.from(
      { length: 21 },
      (_, index) => `owned_skills=custom-${index}`,
    ).join("&");

    const response = await GET(
      new Request(`http://localhost/api/home-feed/postings?${query}`),
    );

    expect(response.status).toBe(400);
    expect(getPostings).not.toHaveBeenCalled();
  });

  it("returns a stable service error without leaking the provider failure", async () => {
    vi.mocked(getPostings).mockRejectedValue(new Error("private upstream detail"));

    const response = await GET(
      new Request("http://localhost/api/home-feed/postings"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "공고를 불러오지 못했습니다.",
    });
  });
});
