import { afterEach, expect, it, vi } from "vitest";

import { analyzeFit, getPostings, getSkillCatalog } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("assigns freshness by endpoint privacy and volatility", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          coverage: {
            matching_posting_count: 0,
            strong_fit_posting_count: 0,
          },
          domain_branches: [],
          recommended_next_skills: [],
        }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetchMock);

  await getPostings();
  await getSkillCatalog();
  await analyzeFit({ owned_skills: ["Python"] });

  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
    next: { revalidate: 60, tags: ["postings"] },
  });
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
    next: { revalidate: 300, tags: ["skill-catalog"] },
  });
  expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
    cache: "no-store",
    method: "POST",
  });
});
