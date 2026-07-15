import { describe, expect, it } from "vitest";

import {
  accountCareerStateToLegacyRow,
  accountCareerStateToRow,
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
      followedCompanySlugs: ["naver", "toss"],
    };
    const server: AccountCareerState = {
      ownedSkills: ["Docker", "Python"],
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "data",
      },
      savedJobIds: ["job-1", "job-2"],
      applicationStages: { "job-1": "applied", "job-2": "preparing" },
      followedCompanySlugs: ["kakao-pay", "naver"],
    };

    expect(mergeAccountCareerState(browser, server)).toEqual({
      ownedSkills: ["Docker", "Kubernetes", "Python"],
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "backend",
      },
      savedJobIds: ["job-1", "job-2", "job-3"],
      applicationStages: { "job-1": "applied", "job-2": "interview" },
      followedCompanySlugs: ["kakao-pay", "naver", "toss"],
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
        followedCompanySlugs: [" Naver ", "naver"],
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
      followedCompanySlugs: ["naver"],
    });

    clearBrowserAccountState(storage);
    expect(readBrowserAccountState(storage)).toEqual({
      ownedSkills: [],
      careerPreferences: { careerCondition: "", targetDomain: "" },
      savedJobIds: [],
      applicationStages: {},
      followedCompanySlugs: [],
    });
  });

  it("keeps the legacy write payload usable while the followed-company migration rolls out", () => {
    const state: AccountCareerState = {
      ownedSkills: ["Python"],
      careerPreferences: { careerCondition: "", targetDomain: "" },
      savedJobIds: [],
      applicationStages: {},
      followedCompanySlugs: ["naver"],
    };

    expect(accountCareerStateToRow("user-1", state)).toMatchObject({
      user_id: "user-1",
      followed_company_slugs: ["naver"],
    });
    expect(accountCareerStateToLegacyRow("user-1", state)).not.toHaveProperty(
      "followed_company_slugs",
    );
  });
});
