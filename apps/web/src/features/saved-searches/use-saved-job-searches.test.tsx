import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SavedJobSearch } from "@/lib/saved-job-searches";

import type { SavedJobSearchStore } from "./saved-job-search-store";
import { useSavedJobSearches } from "./use-saved-job-searches";

const viewer = { id: "user-1", email: "dev@example.com" };
const existing: SavedJobSearch = {
  id: "search-1",
  userId: viewer.id,
  name: "Python 백엔드",
  query: "Python",
  category: "backend",
  careerType: "",
  filterKey: "python|backend|",
  enabled: true,
  lastCheckedAt: "2026-07-20T00:00:00.000Z",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

describe("useSavedJobSearches", () => {
  it("returns the existing item instead of inserting a duplicate", async () => {
    const store: SavedJobSearchStore = {
      list: vi.fn().mockResolvedValue([existing]),
      insert: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      markChecked: vi.fn(),
    };
    const { result } = renderHook(() =>
      useSavedJobSearches(viewer, store),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let outcome;
    await act(async () => {
      outcome = await result.current.create(
        { query: " Python ", category: "backend", careerType: "" },
        "다른 이름",
      );
    });

    expect(outcome).toEqual({ status: "duplicate", item: existing });
    expect(store.insert).not.toHaveBeenCalled();
  });

  it("rolls an optimistic enable change back when the store fails", async () => {
    const store: SavedJobSearchStore = {
      list: vi.fn().mockResolvedValue([existing]),
      insert: vi.fn(),
      update: vi.fn().mockRejectedValue(new Error("offline")),
      remove: vi.fn(),
      markChecked: vi.fn(),
    };
    const { result } = renderHook(() =>
      useSavedJobSearches(viewer, store),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(() => result.current.setEnabled(existing.id, false));

    expect(result.current.state.items[0]?.enabled).toBe(true);
    expect(result.current.state.status).toBe("error");
  });
});
