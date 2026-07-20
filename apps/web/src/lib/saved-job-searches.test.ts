import { describe, expect, it } from "vitest";

import {
  defaultSavedJobSearchName,
  hasSavedJobSearchFilter,
  normalizeSavedJobSearchFilters,
  savedJobSearchFilterKey,
  savedJobSearchQueryKey,
} from "./saved-job-searches";

describe("saved job search model", () => {
  it("normalizes supported filters into one stable duplicate key", () => {
    const filters = normalizeSavedJobSearchFilters({
      query: "  Python   Backend ",
      category: "backend",
      careerType: "experienced",
    });

    expect(filters).toEqual({
      query: "Python Backend",
      category: "backend",
      careerType: "experienced",
    });
    expect(savedJobSearchFilterKey(filters)).toBe(
      "python backend|backend|experienced",
    );
    expect(savedJobSearchQueryKey(filters)).toBe("python backend");
    expect(defaultSavedJobSearchName(filters)).toBe(
      "Python Backend · 백엔드 · 경력",
    );
  });

  it("drops unsupported enums and rejects a filterless search", () => {
    const filters = normalizeSavedJobSearchFilters({
      query: " ",
      category: "not-real",
      careerType: "senior-only",
    });

    expect(filters).toEqual({ query: "", category: "", careerType: "" });
    expect(hasSavedJobSearchFilter(filters)).toBe(false);
  });
});
