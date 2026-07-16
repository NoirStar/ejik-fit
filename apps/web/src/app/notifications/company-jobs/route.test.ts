import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings } from "@/lib/api";

import { POST } from "./route";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, getPostings: vi.fn() };
});

function request(body: unknown) {
  return new Request("http://localhost/notifications/company-jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("company job notification route", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects malformed or oversized company filters", async () => {
    for (const body of [
      {},
      { company_slugs: ["../unsafe"] },
      {
        company_slugs: Array.from(
          { length: 21 },
          (_, index) => `company-${index}`,
        ),
      },
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    }
    expect(getPostings).not.toHaveBeenCalled();
  });

  it("deduplicates companies and drops an overbroad backend result", async () => {
    vi.mocked(getPostings).mockResolvedValue({
      items: [
        { id: "naver-job", company_slug: "naver" },
        { id: "unrelated-job", company_slug: "unrelated" },
      ] as Awaited<ReturnType<typeof getPostings>>["items"],
      total: 2,
    });

    const response = await POST(
      request({ company_slugs: ["naver", "kakao", "naver"] }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getPostings).toHaveBeenCalledWith({
      companies: ["naver", "kakao"],
      limit: 20,
    });
    expect(await response.json()).toEqual({
      items: [{ id: "naver-job", company_slug: "naver" }],
      total: 1,
    });
  });
});
