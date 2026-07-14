import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PostingDetail } from "@/lib/types";

import { buildSavedJobItem } from "./model";
import { SavedLibrary } from "./saved-library";

const posting: PostingDetail = {
  id: "job-python",
  title: "Python Backend Engineer",
  company_name: "NAVER",
  company_slug: "naver",
  career_type: "experienced",
  employment_type: "FULL_TIME_WORKER",
  career_min: 3,
  career_max: 7,
  location: "서울",
  status: "open",
  source_url: "https://recruit.navercorp.com/job-python",
  last_verified_at: "2026-07-14T03:00:00.000Z",
  opens_at: null,
  closes_at: null,
  required_skills: ["Python"],
  preferred_skills: ["Docker"],
  unspecified_skills: [],
  description_html: "",
  description_text: "",
  skills: ["Python", "Docker"],
};

const savedJobResponse = {
  items: [buildSavedJobItem(posting)],
  unavailable_ids: [],
  failed_ids: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function saveBrowserItems(jobIds = ["job-python"], postIds = ["kubernetes-experience"]) {
  window.localStorage.setItem(
    "ejik-fit:saved-job-ids",
    JSON.stringify(jobIds),
  );
  window.localStorage.setItem(
    "ejik-fit:social-interactions",
    JSON.stringify({ savedPostIds: postIds }),
  );
}

describe("SavedLibrary", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(savedJobResponse));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("separates revalidated actual jobs from explicitly mock community saves", async () => {
    saveBrowserItems();
    render(<SavedLibrary />);

    expect(
      screen.getByRole("heading", { level: 1, name: "저장 보관함" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 기술 비교" })).toHaveAttribute(
      "href",
      "/career",
    );

    const job = await screen.findByRole("article", {
      name: "Python Backend Engineer",
    });
    expect(within(job).getByText("현재 API 재확인")).toBeInTheDocument();
    expect(
      within(job).getByRole("link", { name: "Python Backend Engineer" }),
    ).toHaveAttribute("href", "/jobs/job-python");
    expect(within(job).getByText("필수 Python")).toBeInTheDocument();
    expect(within(job).getByRole("link", { name: "공식 원문" })).toHaveAttribute(
      "href",
      "https://recruit.navercorp.com/job-python",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/career/saved/data",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ job_ids: ["job-python"] }),
      }),
    );

    const community = screen.getByRole("article", {
      name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
    });
    expect(within(community).getByText("예시 콘텐츠")).toBeInTheDocument();
    expect(screen.getByText(/실제 사용자가 작성한 글이 아닙니다/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "전체 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("removes saved jobs and community items through the shared browser stores", async () => {
    saveBrowserItems();
    render(<SavedLibrary />);
    await screen.findByRole("article", { name: "Python Backend Engineer" });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Python Backend Engineer 저장 해제",
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("article", { name: "Python Backend Engineer" }),
      ).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem("ejik-fit:saved-job-ids")).toBe("[]");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요? 저장 해제",
      }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "아직 저장한 항목이 없습니다.",
      }),
    ).toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem("ejik-fit:social-interactions")!,
      ).savedPostIds,
    ).toEqual([]);
  });

  it("shows an honest empty state without making an API request", async () => {
    render(<SavedLibrary />);

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "아직 저장한 항목이 없습니다.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "공식 공고 둘러보기" }),
    ).toHaveAttribute("href", "/jobs");
    expect(
      screen.getByRole("link", { name: "커뮤니티 예시 보기" }),
    ).toHaveAttribute("href", "/");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps successful and mock items visible while explaining partial failures", async () => {
    saveBrowserItems(
      ["job-python", "gone-job", "retry-job"],
      ["kubernetes-experience"],
    );
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...savedJobResponse,
        unavailable_ids: ["gone-job"],
        failed_ids: ["retry-job"],
      }),
    );
    render(<SavedLibrary />);

    expect(
      await screen.findByRole("article", { name: "Python Backend Engineer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("현재 API에서 확인되지 않는 저장 공고 1개"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("저장 공고 1개를 다시 확인하지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공고 다시 확인" })).toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
      }),
    ).toBeInTheDocument();
  });

  it("preserves mock saves and offers retry when the actual job request fails", async () => {
    saveBrowserItems();
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    fetchMock.mockResolvedValueOnce(jsonResponse(savedJobResponse));
    render(<SavedLibrary />);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("저장한 공식 공고를 불러오지 못했습니다.");
    expect(
      screen.getByRole("article", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "공고 다시 확인" }));
    expect(
      await screen.findByRole("article", { name: "Python Backend Engineer" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("switches result scope without changing the browser-owned evidence", async () => {
    saveBrowserItems();
    render(<SavedLibrary />);
    await screen.findByRole("article", { name: "Python Backend Engineer" });

    fireEvent.click(screen.getByRole("tab", { name: "커뮤니티 예시 1" }));
    expect(screen.getByRole("tab", { name: "커뮤니티 예시 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("article", { name: "Python Backend Engineer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
      }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("ejik-fit:saved-job-ids")).toBe(
      '["job-python"]',
    );
  });
});
