import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SavedJobSearch } from "@/lib/saved-job-searches";
import type { SavedSearchEvaluationResponse } from "@/lib/saved-search-notifications";
import type { PostingSummary } from "@/lib/types";

import type { SavedJobSearchesController } from "./use-saved-job-searches";
import { useSavedSearchEvaluation } from "./use-saved-search-evaluation";

const evaluatedAt = "2026-07-20T04:00:00.000Z";

function savedSearch(
  id: string,
  enabled: boolean,
  overrides: Partial<SavedJobSearch> = {},
): SavedJobSearch {
  return {
    id,
    userId: "user-1",
    name: id,
    query: id,
    category: "",
    careerType: "",
    filterKey: `${id}||`,
    enabled,
    lastCheckedAt: "2026-07-20T00:00:00.000Z",
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function posting(id: string): PostingSummary {
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
    first_seen_at: "2026-07-20T03:00:00.000Z",
    last_verified_at: "2026-07-20T04:00:00.000Z",
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("useSavedSearchEvaluation", () => {
  it.each([
    {
      name: "a non-ISO evaluation time",
      searches: [savedSearch("search-1", true)],
      body: {
        evaluatedAt: "07/20/2026",
        groups: [
          {
            searchId: "search-1",
            status: "ready",
            total: 1,
            items: [],
          },
        ],
      },
    },
    {
      name: "an evaluation time over five minutes in the future",
      searches: [savedSearch("search-1", true)],
      body: {
        evaluatedAt: new Date(
          Date.now() + 6 * 60 * 1_000,
        ).toISOString(),
        groups: [
          {
            searchId: "search-1",
            status: "ready",
            total: 1,
            items: [],
          },
        ],
      },
    },
    {
      name: "a missing requested group",
      searches: [
        savedSearch("search-1", true),
        savedSearch("search-2", true),
      ],
      body: {
        evaluatedAt,
        groups: [
          {
            searchId: "search-1",
            status: "ready",
            total: 1,
            items: [],
          },
        ],
      },
    },
    {
      name: "a duplicate requested group",
      searches: [
        savedSearch("search-1", true),
        savedSearch("search-2", true),
      ],
      body: {
        evaluatedAt,
        groups: [
          {
            searchId: "search-1",
            status: "ready",
            total: 1,
            items: [],
          },
          {
            searchId: "search-1",
            status: "ready",
            total: 1,
            items: [],
          },
        ],
      },
    },
    {
      name: "an unknown group",
      searches: [savedSearch("search-1", true)],
      body: {
        evaluatedAt,
        groups: [
          {
            searchId: "unknown-search",
            status: "ready",
            total: 1,
            items: [],
          },
        ],
      },
    },
    {
      name: "more than five postings in a group",
      searches: [savedSearch("search-1", true)],
      body: {
        evaluatedAt,
        groups: [
          {
            searchId: "search-1",
            status: "ready",
            total: 6,
            items: Array.from(
              { length: 6 },
              (_, index) => posting(`job-${index}`),
            ),
          },
        ],
      },
    },
    {
      name: "a posting outside the authoritative contract",
      searches: [savedSearch("search-1", true)],
      body: {
        evaluatedAt,
        groups: [
          {
            searchId: "search-1",
            status: "ready",
            total: 1,
            items: [{ id: "incomplete-job" }],
          },
        ],
      },
    },
    {
      name: "a non-exact error group",
      searches: [
        savedSearch("search-1", true),
        savedSearch("search-2", true),
      ],
      body: {
        evaluatedAt,
        groups: [
          {
            searchId: "search-1",
            status: "ready",
            total: 1,
            items: [],
          },
          {
            searchId: "search-2",
            status: "error",
            total: null,
            items: [],
            unexpected: true,
          },
        ],
      },
    },
    {
      name: "more than ten groups",
      searches: Array.from(
        { length: 11 },
        (_, index) => savedSearch(`search-${index}`, true),
      ),
      body: {
        evaluatedAt,
        groups: Array.from(
          { length: 11 },
          (_, index) => ({
            searchId: `search-${index}`,
            status: "ready",
            total: 1,
            items: [],
          }),
        ),
      },
    },
  ])(
    "rejects $name before advancing a checkpoint",
    async ({ searches, body }) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(body),
      );
      const markChecked =
        vi.fn<SavedJobSearchesController["markChecked"]>()
          .mockResolvedValue(true);
      const { result } = renderHook(() =>
        useSavedSearchEvaluation(
          searches,
          "ready",
          markChecked,
          { fetcher },
        ),
      );

      await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
      await waitFor(() =>
        expect(result.current.state.status).not.toBe("loading"),
      );
      expect(result.current.state.status).toBe("error");
      expect(result.current.state.groups).toEqual([]);
      expect(markChecked).not.toHaveBeenCalled();
    },
  );

  it("stores partial groups before advancing only successful enabled rules", async () => {
    const searches = [
      savedSearch("enabled-ready", true),
      savedSearch("enabled-error", true),
      savedSearch("paused-ready", false),
    ];
    const response: SavedSearchEvaluationResponse = {
      evaluatedAt,
      groups: [
        {
          searchId: "enabled-ready",
          status: "ready",
          total: 2,
          items: [],
        },
        {
          searchId: "enabled-error",
          status: "error",
          total: null,
          items: [],
        },
        {
          searchId: "paused-ready",
          status: "ready",
          total: 4,
          items: [],
        },
      ],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(response),
    );
    let currentStatus = "";
    let readStatus = () => "";
    const markChecked =
      vi.fn<SavedJobSearchesController["markChecked"]>(
        async () => {
          currentStatus = readStatus();
          return true;
        },
      );
    type Props = { items: SavedJobSearch[] };
    const { result, rerender } = renderHook(
      ({ items }: Props) =>
        useSavedSearchEvaluation(items, "ready", markChecked, {
          includePaused: true,
          fetcher,
        }),
      { initialProps: { items: searches } },
    );
    readStatus = () => result.current.state.status;

    await waitFor(() =>
      expect(result.current.state.status).toBe("partial"),
    );
    expect(result.current.state.groups).toEqual(response.groups);
    await waitFor(() =>
      expect(markChecked).toHaveBeenCalledWith(
        ["enabled-ready"],
        response.evaluatedAt,
      ),
    );
    expect(currentStatus).toBe("partial");
    const posted = JSON.parse(
      String(fetcher.mock.calls[0]?.[1]?.body),
    ) as { searches: Array<{ id: string }> };
    expect(posted.searches.map((search) => search.id)).toEqual([
      "enabled-ready",
      "enabled-error",
      "paused-ready",
    ]);

    rerender({
      items: searches.map((search) =>
        search.id === "enabled-ready"
          ? { ...search, lastCheckedAt: response.evaluatedAt }
          : search,
      ),
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("excludes paused rules by default", async () => {
    const response: SavedSearchEvaluationResponse = {
      evaluatedAt,
      groups: [
        {
          searchId: "enabled-ready",
          status: "ready",
          total: 1,
          items: [],
        },
      ],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(response),
    );
    const markChecked =
      vi.fn<SavedJobSearchesController["markChecked"]>()
        .mockResolvedValue(true);

    const { result } = renderHook(() =>
      useSavedSearchEvaluation(
        [
          savedSearch("enabled-ready", true),
          savedSearch("paused-ready", false),
        ],
        "ready",
        markChecked,
        { fetcher },
      ),
    );

    await waitFor(() =>
      expect(result.current.state.status).toBe("ready"),
    );
    const posted = JSON.parse(
      String(fetcher.mock.calls[0]?.[1]?.body),
    ) as { searches: Array<{ id: string }> };
    expect(posted.searches.map((search) => search.id)).toEqual([
      "enabled-ready",
    ]);
    await waitFor(() =>
      expect(markChecked).toHaveBeenCalledWith(
        ["enabled-ready"],
        evaluatedAt,
      ),
    );
  });

  it("returns an error without advancing checkpoints when no rule succeeds", async () => {
    const response: SavedSearchEvaluationResponse = {
      evaluatedAt,
      groups: [
        {
          searchId: "search-1",
          status: "error",
          total: null,
          items: [],
        },
      ],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(response),
    );
    const markChecked =
      vi.fn<SavedJobSearchesController["markChecked"]>()
        .mockResolvedValue(true);

    const { result } = renderHook(() =>
      useSavedSearchEvaluation(
        [savedSearch("search-1", true)],
        "ready",
        markChecked,
        { fetcher },
      ),
    );

    await waitFor(() =>
      expect(result.current.state.status).toBe("error"),
    );
    expect(result.current.state.groups).toEqual([]);
    expect(markChecked).not.toHaveBeenCalled();
  });

  it("retries only when refresh is requested", async () => {
    const response: SavedSearchEvaluationResponse = {
      evaluatedAt,
      groups: [
        {
          searchId: "search-1",
          status: "ready",
          total: 1,
          items: [],
        },
      ],
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ error: "temporary failure" }, 503),
      )
      .mockResolvedValueOnce(jsonResponse(response));
    const markChecked =
      vi.fn<SavedJobSearchesController["markChecked"]>()
        .mockResolvedValue(true);
    const { result } = renderHook(() =>
      useSavedSearchEvaluation(
        [savedSearch("search-1", true)],
        "ready",
        markChecked,
        { fetcher },
      ),
    );
    await waitFor(() =>
      expect(result.current.state.status).toBe("error"),
    );
    expect(fetcher).toHaveBeenCalledOnce();

    act(() => result.current.refresh());

    await waitFor(() =>
      expect(result.current.state.status).toBe("ready"),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous result and hides provider details after refresh fails", async () => {
    const response: SavedSearchEvaluationResponse = {
      evaluatedAt,
      groups: [
        {
          searchId: "search-1",
          status: "ready",
          total: 1,
          items: [posting("job-1")],
        },
      ],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(response))
      .mockResolvedValueOnce(
        jsonResponse({ error: "raw provider evaluation failure" }, 503),
      );
    const markChecked =
      vi.fn<SavedJobSearchesController["markChecked"]>()
        .mockResolvedValue(true);
    const { result } = renderHook(() =>
      useSavedSearchEvaluation(
        [savedSearch("search-1", true)],
        "ready",
        markChecked,
        { fetcher },
      ),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const previousGroups = result.current.state.groups;

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state.groups).toEqual(previousGroups);
    expect(result.current.state.error).toBe(
      "공고 알림 결과를 확인하지 못했습니다. 이전 결과는 그대로 유지됩니다.",
    );
    expect(result.current.state.error).not.toContain(
      "raw provider evaluation failure",
    );
  });

  it("starts one request for one signature in StrictMode", async () => {
    const response: SavedSearchEvaluationResponse = {
      evaluatedAt,
      groups: [
        {
          searchId: "search-1",
          status: "ready",
          total: 1,
          items: [],
        },
      ],
    };
    const fetcher = vi.fn<typeof fetch>(
      async () => jsonResponse(response),
    );
    const markChecked =
      vi.fn<SavedJobSearchesController["markChecked"]>()
        .mockResolvedValue(true);
    const { result } = renderHook(
      () =>
        useSavedSearchEvaluation(
          [savedSearch("search-1", true)],
          "ready",
          markChecked,
          { fetcher },
        ),
      { reactStrictMode: true },
    );

    await waitFor(() =>
      expect(result.current.state.status).toBe("ready"),
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(["returns false", "rejects"] as const)(
    "retains successful groups when checkpoint storage %s",
    async (outcome) => {
      const response: SavedSearchEvaluationResponse = {
        evaluatedAt,
        groups: [
          {
            searchId: "search-1",
            status: "ready",
            total: 1,
            items: [],
          },
        ],
      };
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(response),
      );
      const markChecked =
        vi.fn<SavedJobSearchesController["markChecked"]>();
      if (outcome === "returns false") {
        markChecked.mockResolvedValue(false);
      } else {
        markChecked.mockRejectedValue(new Error("checkpoint offline"));
      }
      const { result } = renderHook(() =>
        useSavedSearchEvaluation(
          [savedSearch("search-1", true)],
          "ready",
          markChecked,
          { fetcher },
        ),
      );

      await waitFor(() =>
        expect(result.current.state.status).toBe("partial"),
      );
      expect(result.current.state.groups).toEqual(response.groups);
      expect(result.current.state.error).toContain("확인 시각");
      expect(markChecked).toHaveBeenCalledWith(
        ["search-1"],
        evaluatedAt,
      );
    },
  );

  it("aborts an in-flight evaluation on unmount", async () => {
    const request = { signal: null as AbortSignal | null };
    const fetcher = vi.fn<typeof fetch>(
      async (_input, init) => {
        request.signal = init?.signal ?? null;
        return new Promise<Response>(() => undefined);
      },
    );
    const markChecked =
      vi.fn<SavedJobSearchesController["markChecked"]>()
        .mockResolvedValue(true);
    const { unmount } = renderHook(() =>
      useSavedSearchEvaluation(
        [savedSearch("search-1", true)],
        "ready",
        markChecked,
        { fetcher },
      ),
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

    unmount();

    expect(request.signal?.aborted).toBe(true);
  });
});
