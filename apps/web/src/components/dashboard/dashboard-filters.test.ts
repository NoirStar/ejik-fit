import { describe, expect, it } from "vitest";

import {
  dashboardFiltersToHref,
  filterJobRows,
  type FilterableJobRow,
} from "./dashboard-filters";


const rows: FilterableJobRow[] = [
  {
    companyName: "리멤버",
    title: "Backend Engineer",
    location: "서울 강남",
    time: "2시간 전",
    careerLabel: "경력",
    skills: ["Java", "Spring"],
  },
  {
    companyName: "올리브영",
    title: "Frontend Engineer",
    location: "경기 성남",
    time: "7월 1일",
    careerLabel: "신입",
    skills: ["React", "TypeScript"],
  },
];


describe("dashboard filters", () => {
  it("filters job rows by query across company, title and skills", () => {
    expect(
      filterJobRows(rows, {
        query: "spring",
        region: "all",
        career: "all",
        period: "all",
      }).map((row) => row.companyName),
    ).toEqual(["리멤버"]);
  });

  it("combines region, career and period filters", () => {
    expect(
      filterJobRows(rows, {
        query: "",
        region: "seoul",
        career: "experienced",
        period: "today",
      }).map((row) => row.companyName),
    ).toEqual(["리멤버"]);
  });

  it("serializes filters while preserving owned skill URL params", () => {
    expect(
      dashboardFiltersToHref(
        {
          query: "Java",
          region: "seoul",
          career: "experienced",
          period: "today",
        },
        "?owned_skills=Java&owned_skills=Spring",
      ),
    ).toBe(
      "/?owned_skills=Java&owned_skills=Spring&q=Java&region=seoul&career=experienced&period=today#weekly-jobs",
    );
  });
});
