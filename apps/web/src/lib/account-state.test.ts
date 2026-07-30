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
import { EMPTY_CAREER_PROFILE } from "./career-profile";

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
      careerProfile: {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "플랫폼 엔지니어",
        interestDomains: ["security"],
      },
      savedJobIds: ["job-2", "job-3"],
      savedJobGroups: { "job-2": "interest", "job-3": "comparing" },
      applicationStages: { "job-2": "interview" },
      followedCompanySlugs: ["naver", "toss"],
    };
    const server: AccountCareerState = {
      ownedSkills: ["Docker", "Python"],
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "data",
      },
      careerProfile: {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "백엔드 개발자",
        responsibilities: "API 개발",
        interestDomains: ["cloud"],
      },
      savedJobIds: ["job-1", "job-2"],
      savedJobGroups: { "job-1": "current", "job-2": "adjacent" },
      applicationStages: { "job-1": "applied", "job-2": "preparing" },
      followedCompanySlugs: ["kakao-pay", "naver"],
    };

    expect(mergeAccountCareerState(browser, server)).toEqual({
      ownedSkills: ["Docker", "Kubernetes", "Python"],
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "backend",
      },
      careerProfile: {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "플랫폼 엔지니어",
        responsibilities: "API 개발",
        interestDomains: ["cloud", "security"],
      },
      savedJobIds: ["job-1", "job-2", "job-3"],
      savedJobGroups: {
        "job-1": "current",
        "job-2": "interest",
        "job-3": "comparing",
      },
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
        careerProfile: {
          ...EMPTY_CAREER_PROFILE,
          currentRole: " 데이터 엔지니어 ",
        },
        savedJobIds: ["job-1"],
        savedJobGroups: { "job-1": "adjacent" },
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
      careerProfile: {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "데이터 엔지니어",
      },
      savedJobIds: ["job-1"],
      savedJobGroups: { "job-1": "adjacent" },
      applicationStages: { "job-1": "applied" },
      followedCompanySlugs: ["naver"],
    });

    clearBrowserAccountState(storage);
    expect(readBrowserAccountState(storage)).toEqual({
      ownedSkills: [],
      careerPreferences: { careerCondition: "", targetDomain: "" },
      careerProfile: EMPTY_CAREER_PROFILE,
      savedJobIds: [],
      savedJobGroups: {},
      applicationStages: {},
      followedCompanySlugs: [],
    });
  });

  it("keeps the legacy write payload usable while the followed-company migration rolls out", () => {
    const state: AccountCareerState = {
      ownedSkills: ["Python"],
      careerPreferences: { careerCondition: "", targetDomain: "" },
      careerProfile: {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "보안 엔지니어",
      },
      savedJobIds: [],
      savedJobGroups: {},
      applicationStages: {},
      followedCompanySlugs: ["naver"],
    };

    expect(accountCareerStateToRow("user-1", state)).toMatchObject({
      user_id: "user-1",
      followed_company_slugs: ["naver"],
      career_preferences: expect.objectContaining({
        profile: expect.objectContaining({ currentRole: "보안 엔지니어" }),
        savedJobGroups: {},
      }),
    });
    expect(accountCareerStateToLegacyRow("user-1", state)).not.toHaveProperty(
      "followed_company_slugs",
    );
  });
});
