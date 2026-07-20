import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SavedJobSearch } from "@/lib/saved-job-searches";
import type { SavedSearchEvaluationResponse } from "@/lib/saved-search-notifications";

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

function jsonResponse(
  body: SavedSearchEvaluationResponse | { error: string },
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("useSavedSearchEvaluation", () => {
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
