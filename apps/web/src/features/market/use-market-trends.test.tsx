import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMarketTrends } from "./use-market-trends";

describe("useMarketTrends", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests at most three technologies and can retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "collecting",
        collected_weeks: 2,
        minimum_weeks: 4,
        latest_snapshot_at: "2026-07-22T00:00:00Z",
        series: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useMarketTrends({
        availableSkills: [
          { name: "Python" },
          { name: "AWS" },
          { name: "LLM" },
        ],
        selectedSkill: "AWS",
      }),
    );

    await waitFor(() => expect(result.current.resource.status).toBe("ready"));
    expect(result.current.comparedSkills).toEqual(["AWS", "Python", "LLM"]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/market/trend-data?skills=AWS&skills=Python&skills=LLM",
      expect.objectContaining({ cache: "no-store" }),
    );

    act(() => result.current.retry());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
