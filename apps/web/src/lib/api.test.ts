import { afterEach, expect, it, vi } from "vitest";

import {
  analyzeFit,
  getPostings,
  getSkillCatalog,
  getSkillGraph,
  getSkillGraphEvidence,
} from "./api";

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


it("requests a lightweight graph and cancellable selected-skill evidence", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          seed: null,
          nodes: [],
          edges: [],
          evidence: [],
          meta: { limit: 30, min_confidence: 0.8 },
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController();

  await getSkillGraph({ limit: 30, include_evidence: false });
  await getSkillGraphEvidence(
    { skill: "C++", career_type: "experienced", limit: 6 },
    controller.signal,
  );

  expect(fetchMock.mock.calls[0]?.[0].toString()).toContain(
    "/api/graph/skills?limit=30&include_evidence=false",
  );
  expect(fetchMock.mock.calls[1]?.[0].toString()).toContain(
    "/api/graph/skills/evidence?skill=C%2B%2B&career_type=experienced&limit=6",
  );
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
    next: { revalidate: 60, tags: ["skill-graph-evidence"] },
    signal: expect.any(AbortSignal),
  });
});
