import { describe, expect, it } from "vitest";

import {
  clearFollowedCompanies,
  normalizeFollowedCompanySlugs,
  readFollowedCompanySlugs,
  toggleFollowedCompany,
  writeFollowedCompanySlugs,
} from "./followed-companies";

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

describe("followed companies", () => {
  it("normalizes official company slugs and keeps the most recent unique values", () => {
    expect(
      normalizeFollowedCompanySlugs([
        " Naver ",
        "invalid slug",
        "kakao-pay",
        "naver",
        "한글기업",
      ]),
    ).toEqual(["kakao-pay", "naver"]);
  });

  it("persists, toggles and clears the browser watchlist", () => {
    const storage = memoryStorage();

    expect(writeFollowedCompanySlugs(["naver", "kakao-pay"], storage)).toEqual([
      "naver",
      "kakao-pay",
    ]);
    expect(toggleFollowedCompany("naver", storage)).toEqual(["kakao-pay"]);
    expect(toggleFollowedCompany("toss", storage)).toEqual(["kakao-pay", "toss"]);
    expect(readFollowedCompanySlugs(storage)).toEqual(["kakao-pay", "toss"]);
    expect(clearFollowedCompanies(storage)).toEqual([]);
    expect(readFollowedCompanySlugs(storage)).toEqual([]);
  });
});
