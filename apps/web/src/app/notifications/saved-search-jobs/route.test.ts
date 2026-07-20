import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings } from "@/lib/api";
import type { PostingSummary } from "@/lib/types";

import { POST } from "./route";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, getPostings: vi.fn() };
});

function request(body: unknown) {
  return new Request(
    "http://localhost/notifications/saved-search-jobs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function search(
  id: string,
  overrides: Partial<{
    query: unknown;
    category: unknown;
    careerType: unknown;
    lastCheckedAt: unknown;
  }> = {},
) {
  return {
    id,
    query: "Python",
    category: "backend",
    careerType: "experienced",
    lastCheckedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function posting(id: string, firstSeenAt: string | null): PostingSummary {
  return {
    id,
    title: `${id} title`,
    company_name: `${id} company`,
    career_type: null,
    employment_type: null,
    career_min: null,
    career_max: null,
    location: null,
    status: "open",
    source_url: `https://example.com/${id}`,
    first_seen_at: firstSeenAt,
    last_verified_at: "2026-07-20T04:00:00.000Z",
  };
}

describe("saved search job notification route", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    ["a missing list", {}],
    ["an empty list", { searches: [] }],
    [
      "a non-ISO date",
      { searches: [search("search-1", { lastCheckedAt: "07/20/2026" })] },
    ],
    [
      "an impossible date",
      {
        searches: [
          search("search-1", {
            lastCheckedAt: "2026-02-30T00:00:00.000Z",
          }),
        ],
      },
    ],
    [
      "a checkpoint over five minutes in the future",
      {
        searches: [
          search("search-1", {
            lastCheckedAt: new Date(
              Date.now() + 6 * 60 * 1_000,
            ).toISOString(),
          }),
        ],
      },
    ],
    [
      "an unsupported category",
      { searches: [search("search-1", { category: "sales" })] },
    ],
    [
      "an unsupported career type",
      { searches: [search("search-1", { careerType: "executive" })] },
    ],
    [
      "duplicate normalized ids",
      { searches: [search("search-1"), search(" search-1 ")] },
    ],
    [
      "an oversized id",
      { searches: [search("s".repeat(101))] },
    ],
    [
      "an oversized query",
      { searches: [search("search-1", { query: "q".repeat(201) })] },
    ],
    [
      "a rule without a filter",
      {
        searches: [
          search("search-1", {
            query: "   ",
            category: "",
            careerType: "",
          }),
        ],
      },
    ],
    [
      "eleven rules",
      {
        searches: Array.from(
          { length: 11 },
          (_, index) => search(`search-${index}`),
        ),
      },
    ],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "유효한 저장 검색 조건이 필요합니다.",
    });
    expect(getPostings).not.toHaveBeenCalled();
  });

  it("keeps successful groups when another posting request fails", async () => {
    vi.mocked(getPostings)
      .mockResolvedValueOnce({
        items: [
          posting("new-job", "2026-07-20T03:00:00.000Z"),
          posting("old-job", "2025-12-31T23:59:59.000Z"),
          posting("undated-job", null),
        ],
        total: 3,
      })
      .mockRejectedValueOnce(new Error("backend unavailable"));

    const response = await POST(
      request({
        searches: [
          search("search-1"),
          search("search-2", {
            query: "",
            category: "infra",
            careerType: "",
          }),
        ],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.evaluatedAt).toEqual(expect.any(String));
    expect(body.groups).toEqual([
      {
        searchId: "search-1",
        status: "ready",
        total: 3,
        items: [posting("new-job", "2026-07-20T03:00:00.000Z")],
      },
      {
        searchId: "search-2",
        status: "error",
        total: null,
        items: [],
      },
    ]);
    expect(getPostings).toHaveBeenNthCalledWith(1, {
      q: "Python",
      category: "backend",
      career_type: "experienced",
      limit: 20,
    });
    expect(getPostings).toHaveBeenNthCalledWith(2, {
      category: "infra",
      limit: 20,
    });
  });

  it("returns at most five new jobs for one rule", async () => {
    vi.mocked(getPostings).mockResolvedValue({
      items: Array.from(
        { length: 6 },
        (_, index) =>
          posting(
            `job-${index}`,
            `2026-07-20T0${index}:00:00.000Z`,
          ),
      ),
      total: 6,
    });

    const response = await POST(
      request({ searches: [search("search-1")] }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.groups[0].items).toHaveLength(5);
    expect(body.groups[0].total).toBe(6);
  });
});
