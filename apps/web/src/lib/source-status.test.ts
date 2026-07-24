import { describe, expect, it } from "vitest";

import { getSourceActivityCopy } from "./source-status";

describe("getSourceActivityCopy", () => {
  it.each([
    ["active", "공고 수집 정상"],
    ["quiet", "현재 공개 공고 없음"],
    ["attention", "수집 상태 점검 필요"],
    ["preparing", "연결 준비"],
  ] as const)("maps %s to honest Korean copy", (status, label) => {
    expect(getSourceActivityCopy(status).label).toBe(label);
  });

  it("does not describe a quiet source as an error", () => {
    expect(getSourceActivityCopy("quiet").detail).toBe(
      "최근 정상 확인 결과 공개 공고가 없습니다.",
    );
  });

  it("does not claim zero postings while a source needs attention", () => {
    expect(getSourceActivityCopy("attention").detail).toBe(
      "최근 수집 상태를 점검 중이므로 0건으로 단정하지 않습니다.",
    );
  });
});
