import { describe, expect, it } from "vitest";

import {
  clearBrowserAccountState,
  mergeAccountCareerState,
  readBrowserAccountState,
  writeBrowserAccountState,
  type AccountCareerState,
} from "./account-state";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("account career state", () => {
  it("merges browser changes without discarding server-owned values", () => {
    const browser: AccountCareerState = {
      ownedSkills: ["Kubernetes", "Python"],
      careerPreferences: { careerCondition: "", targetDomain: "backend" },
      savedJobIds: ["job-2", "job-3"],
      applicationStages: { "job-2": "interview" },
    };
    const server: AccountCareerState = {
      ownedSkills: ["Docker", "Python"],
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "data",
      },
      savedJobIds: ["job-1", "job-2"],
      applicationStages: { "job-1": "applied", "job-2": "preparing" },
    };

    expect(mergeAccountCareerState(browser, server)).toEqual({
      ownedSkills: ["Docker", "Kubernetes", "Python"],
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "backend",
      },
      savedJobIds: ["job-1", "job-2", "job-3"],
      applicationStages: { "job-1": "applied", "job-2": "interview" },
    });
  });

  it("writes normalized state and removes account-owned browser values", () => {
    const storage = memoryStorage();
    writeBrowserAccountState(
      {
        ownedSkills: [" Python ", "Python"],
        careerPreferences: {
          careerCondition: "experienced",
          targetDomain: "backend",
        },
        savedJobIds: ["job-1"],
        applicationStages: { "job-1": "applied" },
      },
      storage,
    );

    expect(readBrowserAccountState(storage)).toEqual({
      ownedSkills: ["Python"],
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "backend",
      },
      savedJobIds: ["job-1"],
      applicationStages: { "job-1": "applied" },
    });

    clearBrowserAccountState(storage);
    expect(readBrowserAccountState(storage)).toEqual({
      ownedSkills: [],
      careerPreferences: { careerCondition: "", targetDomain: "" },
      savedJobIds: [],
      applicationStages: {},
    });
  });
});
