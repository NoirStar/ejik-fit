import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_SAVED_JOB_IDS,
  clearSavedJobs,
  normalizeSavedJobIds,
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
  writeSavedJobIds,
} from "./saved-jobs";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  } satisfies Storage;
}

describe("saved job storage", () => {
  afterEach(() => window.localStorage.clear());

  it("trims, deduplicates and sorts posting ids", () => {
    expect(normalizeSavedJobIds([" job-b ", "job-a", "job-b", ""])).toEqual([
      "job-a",
      "job-b",
    ]);
  });

  it("keeps only the 24 most recently supplied posting ids", () => {
    const ids = Array.from(
      { length: MAX_SAVED_JOB_IDS + 1 },
      (_, index) => `job-${String(index).padStart(2, "0")}`,
    );

    expect(normalizeSavedJobIds(ids)).toEqual(ids.slice(1));
  });

  it("keeps a newly toggled posting when the saved library is full", () => {
    const fake = storage();
    const existing = Array.from(
      { length: MAX_SAVED_JOB_IDS },
      (_, index) => `job-${String(index).padStart(2, "0")}`,
    );
    writeSavedJobIds(existing, fake);

    const next = toggleSavedJob("job-new", fake);

    expect(next).toHaveLength(MAX_SAVED_JOB_IDS);
    expect(next).toContain("job-new");
    expect(next).not.toContain("job-00");
  });

  it("persists toggles and removes a saved posting on the second toggle", () => {
    const fake = storage();

    expect(toggleSavedJob("job-b", fake)).toEqual(["job-b"]);
    expect(toggleSavedJob("job-a", fake)).toEqual(["job-a", "job-b"]);
    expect(toggleSavedJob("job-b", fake)).toEqual(["job-a"]);
    expect(readSavedJobIds(fake)).toEqual(["job-a"]);
  });

  it("ignores malformed data and storage access failures", () => {
    const malformed = storage();
    malformed.setItem("ejik-fit:saved-job-ids", "{broken");
    const blocked = {
      ...storage(),
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;

    expect(readSavedJobIds(malformed)).toEqual([]);
    expect(readSavedJobIds(blocked)).toEqual([]);
    expect(writeSavedJobIds(["job-a"], blocked)).toEqual([]);
    expect(writeSavedJobIds(["job-a"], null)).toEqual([]);
    expect(toggleSavedJob("job-a", null)).toEqual([]);
  });

  it("clears the saved-job key and notifies same-tab listeners", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSavedJobs(listener);
    writeSavedJobIds(["job-a"]);

    expect(clearSavedJobs()).toEqual([]);
    expect(localStorage.getItem("ejik-fit:saved-job-ids")).toBeNull();
    expect(listener).toHaveBeenLastCalledWith([]);
    unsubscribe();
  });

  it("notifies and unsubscribes same-tab listeners", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSavedJobs(listener);

    writeSavedJobIds(["job-a"]);
    expect(listener).toHaveBeenCalledWith(["job-a"]);

    unsubscribe();
    writeSavedJobIds(["job-b"]);
    expect(listener).toHaveBeenCalledOnce();
  });
});
