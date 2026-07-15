import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSourceDirectory } from "@/lib/api";

import CorrectionsPage from "./corrections/page";
import DataPolicyPage from "./data-policy/page";
import MethodologyPage from "./methodology/page";
import PrivacyPage from "./privacy/page";

vi.mock("@/lib/api", () => ({
  getSourceDirectory: vi.fn(),
}));

describe("public trust pages", () => {
  beforeEach(() => {
    vi.mocked(getSourceDirectory).mockResolvedValue({
      items: [
        {
          company_name: "네이버",
          company_slug: "naver",
          homepage_url: "https://www.navercorp.com",
          careers_url: "https://recruit.navercorp.com",
          collection_status: "collecting",
          open_postings: 12,
          last_success_at: "2026-07-15T03:20:00Z",
        },
        {
          company_name: "현대자동차",
          company_slug: "hyundai-motor",
          homepage_url: "https://www.hyundai.com",
          careers_url: "https://talent.hyundai.com",
          collection_status: "preparing",
          open_postings: 0,
          last_success_at: null,
        },
      ],
      total: 2,
      collecting_count: 1,
      preparing_count: 1,
      open_postings: 12,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("publishes unique policy, live source directory and methodology pages", async () => {
    const { unmount } = render(await DataPolicyPage());
    expect(screen.getByRole("heading", { level: 1, name: "데이터 수집 정책" })).toBeInTheDocument();
    expect(screen.getByText(/3회 연속/)).toBeInTheDocument();
    expect(screen.getAllByText(/CAPTCHA/)).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2, name: "수집 기업과 공식 출처" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "네이버 공고 보기" })).toHaveAttribute(
      "href",
      "/companies/naver",
    );
    expect(screen.getByRole("link", { name: "현대자동차 공식 수집 출처" })).toHaveAttribute(
      "href",
      "https://talent.hyundai.com",
    );
    expect(screen.getByText("수집 중 1개 기업")).toBeInTheDocument();
    expect(screen.getByText("연결 준비 1개 기업")).toBeInTheDocument();
    unmount();

    render(<MethodologyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "분석 방법" })).toBeInTheDocument();
    expect(screen.getByText(/채용 가능성을 예측하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/0.80/)).toBeInTheDocument();
  });

  it("explains browser storage and provides a clear-data action", () => {
    localStorage.setItem("ejik-fit:owned-skills", '["Java"]');
    localStorage.setItem("ejik-fit:saved-job-ids", '["job-1"]');
    localStorage.setItem(
      "ejik-fit:job-application-stages",
      '{"job-1":"interview"}',
    );
    localStorage.setItem(
      "ejik-fit:social-interactions",
      '{"savedPostIds":["post-1"],"followedAuthorIds":["server-garden"]}',
    );
    localStorage.setItem(
      "ejik-fit:career-preferences",
      '{"careerCondition":"experienced","targetDomain":"cloud"}',
    );
    localStorage.setItem(
      "ejik-fit:local-community-posts",
      '[{"id":"local-post","title":"내 글","body":"본문","tags":[],"createdAt":"2026-07-14T00:00:00.000Z"}]',
    );
    localStorage.setItem(
      "ejik-fit:recent-community-topics",
      '[{"postId":"career-move-3y-backend","title":"최근 글","topicLabel":"백엔드","source":"mock","viewedAt":"2026-07-14T01:00:00.000Z"}]',
    );
    window.history.replaceState({}, "", "/privacy?owned_skills=Java");
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "개인정보와 계정 저장" })).toBeInTheDocument();
    expect(screen.getByText(/Supabase Auth/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:owned-skills/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:saved-job-ids/)).toBeInTheDocument();
    expect(
      screen.getByText(/ejik-fit:job-application-stages/),
    ).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:social-interactions/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:career-preferences/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:local-community-posts/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:recent-community-topics/)).toBeInTheDocument();
    expect(screen.getByText(/작성자 팔로우/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "URL query" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이 브라우저의 저장 데이터 삭제" }));
    expect(localStorage.getItem("ejik-fit:owned-skills")).toBeNull();
    expect(localStorage.getItem("ejik-fit:saved-job-ids")).toBeNull();
    expect(
      localStorage.getItem("ejik-fit:job-application-stages"),
    ).toBeNull();
    expect(localStorage.getItem("ejik-fit:social-interactions")).toBeNull();
    expect(localStorage.getItem("ejik-fit:career-preferences")).toBeNull();
    expect(localStorage.getItem("ejik-fit:local-community-posts")).toBeNull();
    expect(localStorage.getItem("ejik-fit:recent-community-topics")).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("does not claim deletion when browser storage rejects removal", () => {
    localStorage.setItem("ejik-fit:saved-job-ids", '["job-1"]');
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    render(<PrivacyPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "이 브라우저의 저장 데이터 삭제",
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "일부 저장 데이터를 삭제하지 못했습니다.",
    );
    expect(screen.queryByText("저장 데이터를 삭제했습니다.")).not.toBeInTheDocument();
    removeItem.mockRestore();
  });

  it("routes corrections to the public issue tracker", () => {
    render(<CorrectionsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "정보 정정 요청" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub Issues에서 요청하기" })).toHaveAttribute(
      "href",
      "https://github.com/NoirStar/ejik-fit/issues",
    );
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
