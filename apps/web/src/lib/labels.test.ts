import { describe, expect, it } from "vitest";

import {
  formatCareer,
  formatEmployment,
  formatLocation,
  PRODUCT_TERMS,
} from "./labels";

it("keeps shared Korean product terms consistent", () => {
  expect(PRODUCT_TERMS).toEqual({
    ownedSkills: "내 기술",
    skillMap: "기술 관계",
    unspecifiedRequirement: "조건 구분 없음",
    unspecifiedRequirementCompact: "구분 없음",
    savedItems: "저장 목록",
    lastChecked: "최근 확인",
    nextSkill: "공고에서 함께 확인된 조건",
  });
});

describe("posting labels", () => {
  it.each([
    ["new_comer", "신입"],
    ["experienced", "경력"],
    ["mixed", "신입·경력"],
    ["not_matter", "경력 무관"],
    [null, "경력 미기재"],
    ["UNRECOGNIZED_CAREER_ENUM", "경력 조건 확인 필요"],
  ])("formats career value %s", (value, expected) => {
    expect(formatCareer(value)).toBe(expected);
  });

  it.each([
    ["regular", "정규직"],
    ["full_time", "정규직"],
    ["contract", "계약직"],
    ["intern", "인턴"],
    ["part_time", "파트타임"],
    ["freelancer", "프리랜서"],
    ["FULL_TIME_WORKER", "정규직"],
    ["CONTRACT_WORKER", "계약직"],
    ["INTERN_WORKER", "인턴"],
    ["MILITARY_SERVICE_EXCEPTION", "병역 특례"],
    ["정규", "정규직"],
    ["계약", "계약직"],
    ["인턴", "인턴"],
    [null, "고용 형태 미기재"],
  ])("formats employment value %s", (value, expected) => {
    expect(formatEmployment(value)).toBe(expected);
  });

  it("normalizes combined enums without leaking unknown raw values", () => {
    expect(
      formatEmployment("FULL_TIME_WORKER, MILITARY_SERVICE_EXCEPTION"),
    ).toBe("정규직 · 병역 특례");
    expect(formatEmployment("UNRECOGNIZED_EMPLOYMENT_ENUM")).toBe(
      "고용 형태 확인 필요",
    );
    expect(formatLocation("SEOUL")).toBe("서울");
    expect(formatLocation("UNRECOGNIZED_LOCATION_ENUM")).toBe(
      "근무지 확인 필요",
    );
  });
});
