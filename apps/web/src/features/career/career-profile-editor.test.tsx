import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { readCareerProfile } from "@/lib/career-profile";

import { CareerProfileEditor } from "./career-profile-editor";

const domains = [
  { value: "backend", label: "백엔드", skillCount: 12 },
  { value: "cloud", label: "클라우드", skillCount: 8 },
];

describe("CareerProfileEditor", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("starts with minimum career information and stores a career-based profile", () => {
    render(<CareerProfileEditor domains={domains} ownedSkills={["Java"]} />);

    expect(screen.getByText("기술 기준 분석")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("현재 직무"), {
      target: { value: "백엔드 개발자" },
    });
    fireEvent.change(screen.getByLabelText("경력 기간"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("주요 업무와 책임"), {
      target: { value: "결제 API 개발과 운영 자동화" },
    });
    fireEvent.click(screen.getByRole("button", { name: "커리어 프로필 저장" }));

    expect(screen.getByRole("status")).toHaveTextContent("커리어 프로필을 저장했습니다");
    expect(screen.getByText("경력 기준 분석")).toBeInTheDocument();
    expect(readCareerProfile()).toMatchObject({
      currentRole: "백엔드 개발자",
      experienceYears: 5,
      responsibilities: "결제 API 개발과 운영 자동화",
    });
  });

  it("reveals optional preferences progressively and stores neutral profile evidence", () => {
    render(<CareerProfileEditor domains={domains} ownedSkills={["Java"]} />);

    expect(screen.queryByLabelText("관심 분야")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "경력 정보 더 추가" }));

    fireEvent.click(screen.getByLabelText("개발"));
    fireEvent.click(screen.getByLabelText("운영"));
    fireEvent.change(screen.getByLabelText("현재 분야"), {
      target: { value: "backend" },
    });
    const interests = screen.getByRole("group", { name: "관심 분야" });
    fireEvent.click(within(interests).getByLabelText("클라우드"));
    fireEvent.change(screen.getByLabelText("희망 지역"), {
      target: { value: "서울, 경기" },
    });
    fireEvent.click(screen.getByLabelText("정규직"));
    fireEvent.change(screen.getByLabelText("Java 사용 기간"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Java 최근 사용 시점"), {
      target: { value: "current" },
    });
    fireEvent.click(screen.getByRole("button", { name: "커리어 프로필 저장" }));

    expect(readCareerProfile()).toMatchObject({
      workTypes: ["development", "operations"],
      currentDomain: "backend",
      interestDomains: ["cloud"],
      preferredLocations: ["서울", "경기"],
      employmentTypes: ["full_time"],
      skillUsage: { Java: { years: 4, lastUsed: "current" } },
    });
  });
});
