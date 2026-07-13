import { describe, expect, it } from "vitest";

import { formatCareer, formatEmployment } from "./labels";

describe("posting labels", () => {
  it.each([
    ["new_comer", "신입"],
    ["experienced", "경력"],
    ["mixed", "신입·경력"],
    ["not_matter", "경력 무관"],
    [null, "경력 무관"],
  ])("formats career value %s", (value, expected) => {
    expect(formatCareer(value)).toBe(expected);
  });

  it.each([
    ["FULL_TIME_WORKER", "정규직"],
    ["CONTRACT_WORKER", "계약직"],
    ["INTERN_WORKER", "인턴"],
    ["MILITARY_SERVICE_EXCEPTION", "병역특례"],
    ["정규", "정규직"],
    ["계약", "계약직"],
    ["인턴", "인턴"],
  ])("formats employment value %s", (value, expected) => {
    expect(formatEmployment(value)).toBe(expected);
  });
});
