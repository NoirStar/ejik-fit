import { afterEach, describe, expect, it, vi } from "vitest";

import {
  APPLICATION_STAGES,
  MAX_JOB_APPLICATION_STAGES,
  applicationStageLabel,
  normalizeJobApplicationStages,
  readJobApplicationStages,
  removeJobApplicationStage,
  setJobApplicationStage,
  subscribeJobApplicationStages,
  writeJobApplicationStages,
} from "./job-application-stages";

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

describe("job application stage storage", () => {
  afterEach(() => window.localStorage.clear());

  it("exposes only explicit user-owned stages and honest labels", () => {
    expect(APPLICATION_STAGES).toEqual([
      { value: "", label: "단계 미설정" },
      { value: "preparing", label: "지원 준비" },
      { value: "applied", label: "지원 완료" },
      { value: "interview", label: "면접 진행" },
      { value: "offer", label: "처우·오퍼" },
      { value: "closed", label: "종료" },
    ]);
    expect(applicationStageLabel("interview")).toBe("면접 진행");
    expect(applicationStageLabel("")).toBe("단계 미설정");
  });

  it("trims ids, rejects unknown stages, and keeps the latest duplicate", () => {
    expect(
      normalizeJobApplicationStages({
        " job-a ": "preparing",
        "job-b": "invented",
        "": "applied",
        "job-a": "interview",
        "job-c": 3,
      }),
    ).toEqual({ "job-a": "interview" });
  });

  it("bounds legacy data to the most recent accepted posting ids", () => {
    const entries = Object.fromEntries(
      Array.from(
        { length: MAX_JOB_APPLICATION_STAGES + 1 },
        (_, index) => [`job-${String(index).padStart(2, "0")}`, "applied"],
      ),
    );

    const normalized = normalizeJobApplicationStages(entries);

    expect(Object.keys(normalized)).toHaveLength(MAX_JOB_APPLICATION_STAGES);
    expect(normalized).not.toHaveProperty("job-00");
    expect(normalized).toHaveProperty("job-24", "applied");
  });

  it("sets, updates, and removes a stage without inventing a default", () => {
    const fake = storage();

    expect(setJobApplicationStage(" job-a ", "preparing", fake)).toEqual({
      "job-a": "preparing",
    });
    expect(setJobApplicationStage("job-a", "interview", fake)).toEqual({
      "job-a": "interview",
    });
    expect(removeJobApplicationStage("job-a", fake)).toEqual({});
    expect(readJobApplicationStages(fake)).toEqual({});
  });

  it("ignores malformed JSON, invalid ids, and blocked storage", () => {
    const malformed = storage();
    malformed.setItem("ejik-fit:job-application-stages", "{broken");
    const blocked = {
      ...storage(),
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;

    expect(readJobApplicationStages(malformed)).toEqual({});
    expect(readJobApplicationStages(blocked)).toEqual({});
    expect(writeJobApplicationStages({ "job-a": "applied" }, blocked)).toEqual(
      {},
    );
    expect(
      setJobApplicationStage("x".repeat(201), "applied", malformed),
    ).toEqual({});
    expect(setJobApplicationStage("job-a", "", null)).toEqual({});
  });

  it("notifies same-tab subscribers and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeJobApplicationStages(listener);

    setJobApplicationStage("job-a", "applied");
    expect(listener).toHaveBeenLastCalledWith({ "job-a": "applied" });

    unsubscribe();
    setJobApplicationStage("job-b", "preparing");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("updates subscribers when another tab changes the storage key", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeJobApplicationStages(listener);
    localStorage.setItem(
      "ejik-fit:job-application-stages",
      JSON.stringify({ "job-a": "offer" }),
    );

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ejik-fit:job-application-stages",
        newValue: JSON.stringify({ "job-a": "offer" }),
      }),
    );

    expect(listener).toHaveBeenCalledWith({ "job-a": "offer" });
    unsubscribe();
  });
});
