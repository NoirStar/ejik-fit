import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSourceDirectory } from "@/lib/api";
import { ApiTimeoutError } from "@/lib/api-request";
import { COMMUNITY_DRAFT_STORAGE_KEY } from "@/features/community/community-draft";

import CorrectionsPage from "./corrections/page";
import DataPolicyPage from "./data-policy/page";
import MethodologyPage from "./methodology/page";
import PrivacyPage from "./privacy/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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
          activity_status: "active",
          preparation_reason: null,
          open_postings: 12,
          last_success_at: "2026-07-15T03:20:00Z",
        },
        {
          company_name: "카카오",
          company_slug: "kakao",
          homepage_url: "https://www.kakaocorp.com",
          careers_url: "https://careers.kakao.com",
          collection_status: "collecting",
          activity_status: "quiet",
          preparation_reason: null,
          open_postings: 0,
          last_success_at: "2026-07-15T03:20:00Z",
        },
        {
          company_name: "쿠팡",
          company_slug: "coupang",
          homepage_url: "https://www.coupang.jobs",
          careers_url: "https://www.coupang.jobs/kr/jobs/",
          collection_status: "collecting",
          activity_status: "attention",
          preparation_reason: null,
          open_postings: 0,
          last_success_at: "2026-07-01T03:20:00Z",
        },
        {
          company_name: "넥슨",
          company_slug: "nexon",
          homepage_url: "https://www.nexon.com",
          careers_url: "https://careers.nexon.com/",
          collection_status: "preparing",
          activity_status: "preparing",
          preparation_reason: "access_limited",
          open_postings: 0,
          last_success_at: null,
        },
      ],
      total: 4,
      collecting_count: 3,
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
    expect(screen.getByRole("link", { name: "넥슨 공식 수집 출처" })).toHaveAttribute(
      "href",
      "https://careers.nexon.com/",
    );
    expect(screen.getAllByText("공고 수집 정상").length).toBeGreaterThan(0);
    expect(screen.getAllByText("현재 공개 공고 없음").length).toBeGreaterThan(0);
    expect(screen.getAllByText("수집 상태 점검 필요").length).toBeGreaterThan(0);
    expect(screen.getAllByText("연결 준비").length).toBeGreaterThan(0);
    expect(screen.getByText("정상 1개 기업")).toBeInTheDocument();
    expect(screen.getByText("공고 없음 1개 기업")).toBeInTheDocument();
    expect(screen.getByText("점검 필요 1개 기업")).toBeInTheDocument();
    expect(screen.getByText("연결 준비 1개 기업")).toBeInTheDocument();
    expect(screen.getByLabelText("수집 현황")).toHaveTextContent(
      "서비스 반영 데이터 · 1분마다 갱신",
    );
    expect(screen.queryByLabelText("수집 출처 요약")).not.toBeInTheDocument();
    expect(
      screen.getByText(/서비스에 반영된 최신 상태를 기준으로 공개합니다/),
    ).toBeInTheDocument();
    expect(screen.getByText("공식 사이트 접근 제한")).toBeInTheDocument();
    expect(
      screen.getByText("보안 확인을 우회하지 않아 자동 수집을 보류했습니다."),
    ).toBeInTheDocument();

    const quietRow = screen.getByText("카카오").closest("li");
    expect(quietRow).not.toBeNull();
    expect(within(quietRow!).getByText("현재 공개 공고 없음")).toBeInTheDocument();
    expect(within(quietRow!).queryByRole("alert")).not.toBeInTheDocument();

    const attentionRow = screen.getByText("쿠팡").closest("li");
    expect(attentionRow).not.toBeNull();
    expect(
      within(attentionRow!).getByText("수집 상태 점검 필요"),
    ).toBeInTheDocument();
    expect(attentionRow).not.toHaveTextContent("upstream timeout");

    fireEvent.change(
      screen.getByRole("searchbox", { name: "수집 기업 검색" }),
      { target: { value: "넥슨" } },
    );
    expect(screen.queryByRole("link", { name: "네이버 공고 보기" })).not.toBeInTheDocument();
    expect(screen.getByText("넥슨")).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "수집 기업 검색" }),
      { target: { value: "" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "공고 수집 정상만 보기" }));
    expect(screen.getByRole("link", { name: "네이버 공고 보기" })).toBeInTheDocument();
    expect(screen.queryByText("카카오")).not.toBeInTheDocument();
    expect(screen.queryByText("쿠팡")).not.toBeInTheDocument();
    expect(screen.queryByText("넥슨")).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "수집 기업 검색" }),
      { target: { value: "없는 기업" } },
    );
    expect(screen.getByText("조건에 맞는 기업이 없습니다.")).toBeInTheDocument();
    expect(
      screen.getByText("검색어나 수집 상태를 바꿔 주세요."),
    ).toBeInTheDocument();
    unmount();

    render(<MethodologyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "분석 방법" })).toBeInTheDocument();
    expect(screen.getByText(/채용 가능성을 예측하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/서류 통과 확률이나 합격률/)).toBeInTheDocument();
    expect(screen.getByText(/시장 전체의 추세로 일반화하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/0.80/)).toBeInTheDocument();
  });

  it.each([
    ["a TypeError", new TypeError("fetch failed")],
    [
      "a timeout",
      new ApiTimeoutError("https://api.example/sources", 8_000),
    ],
  ])("uses neutral source-directory copy for %s", async (_label, error) => {
    vi.mocked(getSourceDirectory).mockRejectedValueOnce(error);

    render(await DataPolicyPage());

    const status = screen.getByRole("status");
    expect(
      within(status).getByText("수집 현황을 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(
      within(status).getByText("잠시 후 다시 확인해 주세요."),
    ).toBeInTheDocument();
    expect(status).not.toHaveTextContent("공고 화면에는 영향이 없습니다");
  });

  it("reveals a large source directory in compact increments", async () => {
    const items = Array.from({ length: 30 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return {
        company_name: `테스트기업 ${number}`,
        company_slug: `test-company-${number}`,
        homepage_url: `https://company-${number}.example.com`,
        careers_url: `https://company-${number}.example.com/careers`,
        collection_status: "collecting" as const,
        activity_status: "active" as const,
        preparation_reason: null,
        open_postings: index + 1,
        last_success_at: "2026-07-20T03:20:00Z",
      };
    });
    vi.mocked(getSourceDirectory).mockResolvedValue({
      items,
      total: items.length,
      collecting_count: items.length,
      preparing_count: 0,
      open_postings: 465,
    });

    render(await DataPolicyPage());

    expect(
      screen.getByRole("link", { name: "테스트기업 24 공고 보기" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "테스트기업 25 공고 보기" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("24 / 30개 기업")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "6개 기업 더 보기, 모두 표시하면 남은 기업 0개",
      }),
    );

    expect(
      screen.getByRole("link", { name: "테스트기업 30 공고 보기" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /기업 더 보기/ }),
    ).not.toBeInTheDocument();
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
      "ejik-fit:followed-company-slugs",
      '["naver"]',
    );
    localStorage.setItem(
      "ejik-fit:local-community-posts",
      '[{"id":"local-post","title":"내 글","body":"본문","tags":[],"createdAt":"2026-07-14T00:00:00.000Z"}]',
    );
    localStorage.setItem(
      "ejik-fit:recent-community-topics",
      '[{"postId":"career-move-3y-backend","title":"최근 글","topicLabel":"백엔드","source":"mock","viewedAt":"2026-07-14T01:00:00.000Z"}]',
    );
    sessionStorage.setItem(
      COMMUNITY_DRAFT_STORAGE_KEY,
      '{"version":1,"category":"커리어 질문","title":"임시 글","body":"현재 탭 초안","tags":[],"savedAt":"2026-07-23T00:00:00.000Z"}',
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
    expect(screen.getAllByText(/ejik-fit:social-interactions/)).toHaveLength(2);
    expect(screen.getByText(/ejik-fit:career-preferences/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:followed-company-slugs/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:local-community-posts/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:recent-community-topics/)).toBeInTheDocument();
    expect(screen.getByText(/작성자 팔로우/)).toBeInTheDocument();
    expect(screen.getByText(/닉네임은 커뮤니티에 공개되는 프로필/)).toBeInTheDocument();
    expect(screen.getByText(/이메일은 비공개 로그인 식별자/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "작성 중인 임시 글" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:community-draft/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "이전 브라우저 글" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/이 기기에 남은 글을 삭제합니다/)).toBeInTheDocument();
    expect(screen.getByText(/재시도를 위해 그대로 보관합니다/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "내 기술 저장" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/계정에 저장된 기술과 병합해/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "주소에 포함된 검색 조건",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "URL query" }),
    ).not.toBeInTheDocument();

    const interactionSection = screen
      .getByRole("heading", { level: 2, name: "커뮤니티 상호작용" })
      .closest("section");
    expect(interactionSection).not.toBeNull();
    expect(interactionSection?.querySelectorAll("p")).toHaveLength(2);

    const deletionSection = screen
      .getByRole("heading", { level: 2, name: "저장 데이터 삭제" })
      .closest("section");
    expect(deletionSection).not.toBeNull();
    expect(deletionSection).toHaveTextContent(
      "이 버튼은 서버에 게시된 커뮤니티 글이나 계정 데이터를 삭제하지 않습니다.",
    );
    expect(within(deletionSection!).getByText(/전체 계정 데이터/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이 브라우저의 저장 데이터 삭제" }));
    expect(localStorage.getItem("ejik-fit:owned-skills")).toBeNull();
    expect(localStorage.getItem("ejik-fit:saved-job-ids")).toBeNull();
    expect(
      localStorage.getItem("ejik-fit:job-application-stages"),
    ).toBeNull();
    expect(localStorage.getItem("ejik-fit:social-interactions")).toBeNull();
    expect(localStorage.getItem("ejik-fit:career-preferences")).toBeNull();
    expect(localStorage.getItem("ejik-fit:followed-company-slugs")).toBeNull();
    expect(localStorage.getItem("ejik-fit:local-community-posts")).toBeNull();
    expect(localStorage.getItem("ejik-fit:recent-community-topics")).toBeNull();
    expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toBeNull();
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
