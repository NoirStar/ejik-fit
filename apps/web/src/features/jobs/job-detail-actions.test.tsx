import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { careerAnalysisFixture } from "@/features/career-analysis/test-fixture";
import { writeOwnedSkills } from "@/lib/owned-skills";
import { EMPTY_CAREER_PROFILE, writeCareerProfile } from "@/lib/career-profile";
import { toggleSavedJob } from "@/lib/saved-jobs";

import { JobDetailActions } from "./job-detail-actions";

const props = {
  job: {
    id: "job-1",
    title: "Backend Engineer",
    company_name: "검증 기업",
    career_type: "experienced",
    employment_type: "FULL_TIME_WORKER",
    career_min: 3,
    career_max: null,
    location: "서울",
    status: "open",
    source_url: "https://careers.example.com/job-1",
    last_verified_at: "2026-07-30T00:00:00Z",
    description_excerpt: "Go API를 개발하고 백엔드 서비스를 운영합니다.",
    required_skills: ["Go"],
    preferred_skills: [],
    unspecified_skills: [],
  },
  skills: [
    {
      skill: "Go",
      category: "language",
      requirement_type: "required" as const,
      evidence_text: "Go 경험",
      confidence: 1,
      match_reason: "distinct_alias",
    },
  ],
};

describe("JobDetailActions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body ?? "{}")) as {
        owned_skills?: string[];
        profile?: { current_role?: string };
      };
      const hasRole = Boolean(request.profile?.current_role);
      const response = careerAnalysisFixture([props.job], {
        eligibleIds: hasRole ? [props.job.id] : [],
      });
      const connection = response.connections[props.job.id];
      const hasGo = (request.owned_skills ?? []).some(
        (skill) => skill.toLocaleLowerCase("en") === "go",
      );
      connection.matched_skills = hasGo ? ["Go"] : [];
      connection.unconfirmed_conditions = hasGo ? [] : ["Go"];
      connection.reasons = [
        hasRole
          ? "현재 직무와 공고의 주요 업무가 겹칩니다."
          : "Go 한 항목은 겹치지만 공고 역할과 이어지는 근거는 확인되지 않았습니다.",
      ];
      return Response.json(response);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("persists the same saved job id used by the list and home", () => {
    render(<JobDetailActions {...props} />);

    const save = screen.getByRole("button", {
      name: "Backend Engineer 저장",
    });
    fireEvent.click(save);

    expect(save).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("ejik-fit:saved-job-ids")).toBe(
      '["job-1"]',
    );
  });

  it("records an application stage and keeps the job in the saved library", async () => {
    render(<JobDetailActions {...props} />);

    const stage = screen.getByRole("combobox", {
      name: "Backend Engineer 지원 단계",
    });
    fireEvent.change(stage, { target: { value: "applied" } });

    await waitFor(() => {
      expect(stage).toHaveDisplayValue("지원 완료");
    });
    expect(window.localStorage.getItem("ejik-fit:saved-job-ids")).toBe(
      '["job-1"]',
    );
    expect(
      JSON.parse(
        window.localStorage.getItem("ejik-fit:job-application-stages")!,
      ),
    ).toEqual({ "job-1": "applied" });
    expect(screen.getByText("지원 완료로 기록했습니다.")).toBeInTheDocument();
  });

  it("shows only exact owned skill overlap", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["go", "Java"]),
    );

    render(<JobDetailActions {...props} />);

    expect(await screen.findByText("추가 확인이 필요한 공고")).toBeInTheDocument();
    expect(screen.getByText(/Go 한 항목은 겹치지만/)).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(screen.queryByText("Java")).not.toBeInTheDocument();
  });

  it("uses the same role and responsibility evidence as job recommendations", async () => {
    writeCareerProfile({
      ...EMPTY_CAREER_PROFILE,
      currentRole: "백엔드 개발자",
      experienceYears: 5,
      responsibilities: "Go API 개발과 백엔드 서비스 운영",
      currentDomain: "backend",
      workTypes: ["development", "operations"],
    });
    writeOwnedSkills(["Go"]);

    render(<JobDetailActions {...props} />);

    expect(await screen.findByText("현재 경력과 직접 이어짐"))
      .toBeInTheDocument();
    expect(screen.getByText(/현재 직무와 공고의 주요 업무/)).toBeInTheDocument();
  });

  it("guides an empty browser stack to career settings", () => {
    render(<JobDetailActions {...props} />);

    expect(
      screen.getByRole("link", { name: "프로필 정보 추가" }),
    ).toHaveAttribute("href", "/career");
  });

  it("does not claim a save succeeded when browser storage rejects it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    render(<JobDetailActions {...props} />);

    const save = screen.getByRole("button", {
      name: "Backend Engineer 저장",
    });
    fireEvent.click(save);

    expect(save).toHaveAttribute("aria-pressed", "false");
    expect(save).toHaveTextContent("공고 저장");
  });

  it("reacts to saved jobs and owned skills changed elsewhere in the same tab", async () => {
    render(<JobDetailActions {...props} />);

    act(() => {
      toggleSavedJob("job-1");
      writeOwnedSkills(["GO"]);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Backend Engineer 저장 해제" }),
      ).toHaveAttribute("aria-pressed", "true");
    });
    expect(await screen.findByText("추가 확인이 필요한 공고")).toBeInTheDocument();
  });

  it("opens only the validated official source in a new tab", () => {
    render(<JobDetailActions {...props} />);

    expect(
      screen.getByRole("link", { name: "공식 채용 페이지에서 지원" }),
    ).toHaveAttribute("href", props.job.source_url);
    expect(
      screen.getByRole("link", { name: "공식 채용 페이지에서 지원" }),
    ).toHaveAttribute("target", "_blank");
  });

  it("uses verification language instead of application language when closed", () => {
    render(
      <JobDetailActions {...props} job={{ ...props.job, status: "closed" }} />,
    );

    expect(
      screen.getByRole("region", { name: "공고 확인" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "공식 채용 페이지에서 확인" }),
    ).toHaveAttribute("href", props.job.source_url);
    expect(
      screen.queryByRole("link", { name: "공식 채용 페이지에서 지원" }),
    ).not.toBeInTheDocument();
  });
});
