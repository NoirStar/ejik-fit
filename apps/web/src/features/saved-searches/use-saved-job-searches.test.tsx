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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function savedSearch(
  id: string,
  query: string,
  overrides: Partial<SavedJobSearch> = {},
): SavedJobSearch {
  return {
    ...existing,
    id,
    name: query,
    query,
    filterKey: `${query.toLowerCase()}|backend|`,
    ...overrides,
  };
}

function fakeStore(
  overrides: Partial<SavedJobSearchStore> = {},
): SavedJobSearchStore {
  return {
    list: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    markChecked: vi.fn(),
    ...overrides,
  };
}

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

  it("ignores an old-account mutation success after logout", async () => {
    const update = deferred<SavedJobSearch>();
    const store = fakeStore({
      list: vi.fn().mockResolvedValue([existing]),
      update: vi.fn().mockReturnValue(update.promise),
    });
    type Props = { activeViewer: typeof viewer | null };
    const { result, rerender } = renderHook(
      ({ activeViewer }: Props) =>
        useSavedJobSearches(activeViewer, store),
      { initialProps: { activeViewer: viewer } as Props },
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let mutation!: Promise<boolean>;
    act(() => {
      mutation = result.current.setEnabled(existing.id, false);
    });
    rerender({ activeViewer: null });
    await waitFor(() => expect(result.current.state.status).toBe("idle"));

    let outcome;
    await act(async () => {
      update.resolve({ ...existing, enabled: false });
      outcome = await mutation;
    });

    expect(outcome).toBe(false);
    expect(result.current.state).toEqual({
      status: "idle",
      items: [],
      error: "",
    });
  });

  it("ignores an old-account mutation failure after a viewer switch", async () => {
    const update = deferred<SavedJobSearch>();
    const nextViewer = { id: "user-2", email: "next@example.com" };
    const nextItem = savedSearch("search-2", "Go", {
      userId: nextViewer.id,
    });
    const store = fakeStore({
      list: vi.fn().mockImplementation((userId: string) =>
        Promise.resolve(userId === viewer.id ? [existing] : [nextItem]),
      ),
      update: vi.fn().mockReturnValue(update.promise),
    });
    type Props = { activeViewer: typeof viewer | null };
    const { result, rerender } = renderHook(
      ({ activeViewer }: Props) =>
        useSavedJobSearches(activeViewer, store),
      { initialProps: { activeViewer: viewer } as Props },
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let mutation!: Promise<boolean>;
    act(() => {
      mutation = result.current.rename(existing.id, "변경 중");
    });
    rerender({ activeViewer: nextViewer });
    await waitFor(() =>
      expect(result.current.state.items).toEqual([nextItem]),
    );

    let outcome;
    await act(async () => {
      update.reject(new Error("offline"));
      outcome = await mutation;
    });

    expect(outcome).toBe(false);
    expect(result.current.state).toEqual({
      status: "ready",
      items: [nextItem],
      error: "",
    });
  });

  it("does not let an older failed mutation erase a later success", async () => {
    const other = savedSearch("search-2", "Go");
    const older = deferred<SavedJobSearch>();
    const later = deferred<SavedJobSearch>();
    const renamed = { ...other, name: "Go 서비스" };
    const store = fakeStore({
      list: vi.fn().mockResolvedValue([existing, other]),
      update: vi.fn().mockImplementation(
        (_userId: string, id: string) =>
          id === existing.id ? older.promise : later.promise,
      ),
    });
    const { result } = renderHook(() =>
      useSavedJobSearches(viewer, store),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let olderMutation!: Promise<boolean>;
    act(() => {
      olderMutation = result.current.setEnabled(existing.id, false);
    });
    let laterMutation!: Promise<boolean>;
    act(() => {
      laterMutation = result.current.rename(other.id, renamed.name);
    });

    await act(async () => {
      later.resolve(renamed);
      await laterMutation;
    });
    await act(async () => {
      older.reject(new Error("offline"));
      await olderMutation;
    });

    expect(
      result.current.state.items.find((item) => item.id === other.id)?.name,
    ).toBe(renamed.name);
  });

  it("reserves a duplicate filter across concurrent creates", async () => {
    const insert = deferred<SavedJobSearch>();
    const created = savedSearch("search-new", "Rust");
    const store = fakeStore({
      insert: vi.fn().mockReturnValue(insert.promise),
    });
    const { result } = renderHook(() =>
      useSavedJobSearches(viewer, store),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let first!: ReturnType<typeof result.current.create>;
    let second!: ReturnType<typeof result.current.create>;
    act(() => {
      const filters = {
        query: "Rust",
        category: "backend" as const,
        careerType: "" as const,
      };
      first = result.current.create(filters);
      second = result.current.create(filters);
    });

    let outcomes;
    await act(async () => {
      insert.resolve(created);
      outcomes = await Promise.all([first, second]);
    });

    expect(outcomes).toEqual([
      { status: "created", item: created },
      { status: "duplicate", item: created },
    ]);
    expect(result.current.state.items).toEqual([created]);
    expect(store.insert).toHaveBeenCalledTimes(1);
  });

  it("reserves the tenth slot across concurrent creates", async () => {
    const initial = Array.from({ length: 9 }, (_, index) =>
      savedSearch(`search-${index}`, `Skill ${index}`),
    );
    const firstInsert = deferred<SavedJobSearch>();
    const secondInsert = deferred<SavedJobSearch>();
    const firstCreated = savedSearch("search-10", "Rust");
    const secondCreated = savedSearch("search-11", "Elixir");
    const store = fakeStore({
      list: vi.fn().mockResolvedValue(initial),
      insert: vi.fn().mockImplementation(
        (_userId: string, filters: { query: string }) =>
          filters.query === "Rust"
            ? firstInsert.promise
            : secondInsert.promise,
      ),
    });
    const { result } = renderHook(() =>
      useSavedJobSearches(viewer, store),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let first!: ReturnType<typeof result.current.create>;
    let second!: ReturnType<typeof result.current.create>;
    act(() => {
      first = result.current.create({
        query: "Rust",
        category: "backend",
        careerType: "",
      });
      second = result.current.create({
        query: "Elixir",
        category: "backend",
        careerType: "",
      });
    });

    let outcomes;
    await act(async () => {
      firstInsert.resolve(firstCreated);
      secondInsert.resolve(secondCreated);
      outcomes = await Promise.all([first, second]);
    });

    expect(outcomes).toEqual([
      { status: "created", item: firstCreated },
      { status: "limit" },
    ]);
    expect(result.current.state.items).toHaveLength(10);
    expect(store.insert).toHaveBeenCalledTimes(1);
  });

  it("sanitizes checkpoint ids and skips an empty checkpoint batch", async () => {
    const store = fakeStore({
      list: vi.fn().mockResolvedValue([existing]),
      markChecked: vi.fn().mockResolvedValue(undefined),
    });
    const { result } = renderHook(() =>
      useSavedJobSearches(viewer, store),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const evaluatedAt = "2026-07-20T01:00:00.000Z";

    await act(() =>
      result.current.markChecked(
        [" search-1 ", "", "search-1", "   "],
        evaluatedAt,
      ),
    );
    expect(store.markChecked).toHaveBeenCalledWith(
      viewer.id,
      ["search-1"],
      evaluatedAt,
    );

    vi.mocked(store.markChecked).mockClear();
    await act(() =>
      result.current.markChecked(["", "   "], evaluatedAt),
    );
    expect(store.markChecked).not.toHaveBeenCalled();
  });
});
