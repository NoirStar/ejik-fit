import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SAVED_JOB_GROUPS,
  clearSavedJobGroups,
  normalizeSavedJobGroups,
  readSavedJobGroups,
  removeSavedJobGroup,
  setSavedJobGroup,
  subscribeSavedJobGroups,
  writeSavedJobGroups,
} from "./saved-job-groups";

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

describe("saved job group storage", () => {
  afterEach(() => window.localStorage.clear());

  it("uses the four user-owned career direction groups without inventing a score", () => {
    expect(SAVED_JOB_GROUPS).toEqual([
      { value: "", label: "분류하지 않음" },
      { value: "current", label: "현재 경력 유지" },
      { value: "adjacent", label: "인접 커리어" },
      { value: "interest", label: "관심 분야" },
      { value: "comparing", label: "비교 중" },
    ]);
  });

  it("trims ids and removes unknown or empty groups", () => {
    expect(
      normalizeSavedJobGroups({
        " job-a ": "current",
        "job-b": "invented",
        "": "adjacent",
        "job-c": "interest",
        "job-d": "",
      }),
    ).toEqual({ "job-a": "current", "job-c": "interest" });
  });

  it("migrates a valid legacy value without deleting its recovery copy", () => {
    const fake = storage();
    fake.setItem(
      "ejik-fit:saved-job-groups",
      JSON.stringify({ "job-a": "adjacent" }),
    );

    expect(readSavedJobGroups(fake)).toEqual({ "job-a": "adjacent" });
    expect(fake.getItem("careerfit:saved-job-groups")).toBe(
      JSON.stringify({ "job-a": "adjacent" }),
    );
    expect(fake.getItem("ejik-fit:saved-job-groups")).not.toBeNull();
  });

  it("sets, changes, and removes a group", () => {
    const fake = storage();

    expect(setSavedJobGroup(" job-a ", "current", fake)).toEqual({
      "job-a": "current",
    });
    expect(setSavedJobGroup("job-a", "comparing", fake)).toEqual({
      "job-a": "comparing",
    });
    expect(removeSavedJobGroup("job-a", fake)).toEqual({});
  });

  it("ignores malformed values and blocked storage", () => {
    const malformed = storage();
    malformed.setItem("ejik-fit:saved-job-groups", "{broken");
    const blocked = {
      ...storage(),
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;

    expect(readSavedJobGroups(malformed)).toEqual({});
    expect(readSavedJobGroups(blocked)).toEqual({});
    expect(writeSavedJobGroups({ "job-a": "current" }, blocked)).toEqual({});
    expect(setSavedJobGroup("job-a", "", null)).toEqual({});
  });

  it("notifies same-tab subscribers and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSavedJobGroups(listener);

    setSavedJobGroup("job-a", "interest");
    expect(listener).toHaveBeenLastCalledWith({ "job-a": "interest" });

    unsubscribe();
    setSavedJobGroup("job-b", "current");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("clears current and legacy values", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSavedJobGroups(listener);
    setSavedJobGroup("job-a", "current");

    expect(clearSavedJobGroups()).toEqual({});
    expect(localStorage.getItem("careerfit:saved-job-groups")).toBeNull();
    expect(localStorage.getItem("ejik-fit:saved-job-groups")).toBeNull();
    expect(listener).toHaveBeenLastCalledWith({});
    unsubscribe();
  });
});
