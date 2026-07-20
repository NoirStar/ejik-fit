import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import type { SavedJobSearch } from "@/lib/saved-job-searches";
import type {
  SavedSearchEvaluationGroup,
  SavedSearchEvaluationState,
} from "@/lib/saved-search-notifications";
import type { PostingSummary } from "@/lib/types";

import { useSavedJobSearches } from "../saved-searches/use-saved-job-searches";
import { useSavedSearchEvaluation } from "../saved-searches/use-saved-search-evaluation";
import { ActivityNotificationCenter } from "./activity-notification-center";

vi.mock("../saved-searches/use-saved-job-searches", () => ({
  useSavedJobSearches: vi.fn(),
}));

vi.mock("../saved-searches/use-saved-search-evaluation", () => ({
  useSavedSearchEvaluation: vi.fn(),
}));

const viewer: AuthViewer = {
  id: "viewer-1",
  email: "developer@example.com",
};

const pythonSearch: SavedJobSearch = {
  id: "search-1",
  userId: viewer.id,
  name: "Python 백엔드",
  query: "Python",
  category: "backend",
  careerType: "",
  filterKey: "python|backend|",
  enabled: true,
  lastCheckedAt: "2026-07-20T00:00:00.000Z",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

const reloadSavedSearches = vi.fn();
const createSavedSearch = vi.fn();
const renameSavedSearch = vi.fn();
const setSavedSearchEnabled = vi.fn();
const removeSavedSearch = vi.fn();
const markSavedSearchChecked = vi.fn();
const refreshSavedSearchEvaluation = vi.fn();

function savedSearchJob(id = "new-job"): PostingSummary {
  return {
    id,
    title: "Backend Engineer",
    company_name: "NAVER",
    company_slug: "naver",
    career_type: "experienced",
    employment_type: "정규직",
    career_min: 3,
    career_max: null,
    location: "성남",
    status: "open",
    source_url: `https://recruit.navercorp.com/${id}`,
    first_seen_at: "2026-07-20T01:00:00.000Z",
    last_verified_at: "2026-07-20T02:00:00.000Z",
  };
}

function readyGroup(
  searchId: string,
  items: PostingSummary[],
): SavedSearchEvaluationGroup {
  return {
    searchId,
    status: "ready",
    total: items.length,
    items,
  };
}

function mockSavedSearches(items: SavedJobSearch[] = []) {
  vi.mocked(useSavedJobSearches).mockReturnValue({
    state: { status: "ready", items, error: "" },
    reload: reloadSavedSearches,
    create: createSavedSearch,
    rename: renameSavedSearch,
    setEnabled: setSavedSearchEnabled,
    remove: removeSavedSearch,
    markChecked: markSavedSearchChecked,
  });
}

function mockSavedSearchEvaluation(
  state: SavedSearchEvaluationState = {
    status: "ready",
    groups: [],
    error: "",
  },
) {
  vi.mocked(useSavedSearchEvaluation).mockReturnValue({
    state,
    refresh: refreshSavedSearchEvaluation,
  });
}

describe("ActivityNotificationCenter", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    mockSavedSearches();
    mockSavedSearchEvaluation();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not invent notifications when there is no saved activity", async () => {
    render(<ActivityNotificationCenter />);

    expect(
      await screen.findByText("아직 확인할 활동이 없습니다."),
    ).toBeInTheDocument();
  });

  it("links saved jobs, application stages, and skills to their real destinations", async () => {
    localStorage.setItem(
      "ejik-fit:saved-job-ids",
      JSON.stringify(["job-1", "job-2"]),
    );
    localStorage.setItem(
      "ejik-fit:job-application-stages",
      JSON.stringify({ "job-1": "interview" }),
    );
    localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python", "Kubernetes"]),
    );
    localStorage.setItem(
      "ejik-fit:followed-company-slugs",
      JSON.stringify(["naver"]),
    );

    render(<ActivityNotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText("지원 기록 1건")).toBeInTheDocument();
    });
    expect(screen.getByText("면접 진행 1건")).toBeInTheDocument();
    expect(screen.getByText("저장한 공고 2건")).toBeInTheDocument();
    expect(screen.getByText("내 기술 2개")).toBeInTheDocument();
    expect(screen.getByText("관심 기업 1개")).toBeInTheDocument();
    expect(screen.getByText("지원 기록 1건").closest("a")).toHaveAttribute(
      "href",
      "/career/saved?scope=applications",
    );
    expect(screen.getByText("내 기술 2개").closest("a")).toHaveAttribute(
      "href",
      "/market",
    );
    expect(screen.getByText("관심 기업 1개").closest("a")).toHaveAttribute(
      "href",
      "/career/companies",
    );
  });

  it("shows newly discovered jobs from followed companies once", async () => {
    localStorage.setItem(
      "ejik-fit:followed-company-slugs",
      JSON.stringify(["naver"]),
    );
    localStorage.setItem(
      "ejik-fit:company-job-notifications-checked-at",
      "2026-07-14T00:00:00.000Z",
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total: 1,
          items: [
            {
              id: "new-job",
              title: "검색 플랫폼 백엔드 개발자",
              company_name: "네이버",
              company_slug: "naver",
              career_type: "experienced",
              employment_type: "정규직",
              career_min: 3,
              career_max: null,
              location: "성남",
              status: "open",
              source_url: "https://recruit.navercorp.com/new-job",
              first_seen_at: "2026-07-15T03:00:00.000Z",
              last_verified_at: "2026-07-15T04:00:00.000Z",
              opens_at: null,
              closes_at: null,
              required_skills: ["Java"],
              preferred_skills: [],
              unspecified_skills: [],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<ActivityNotificationCenter />);

    const alert = await screen.findByText("네이버 · 새로 확인");
    expect(alert.closest("a")).toHaveAttribute("href", "/jobs/new-job");
    expect(screen.getByText("검색 플랫폼 백엔드 개발자")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/notifications/company-jobs",
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      Date.parse(
        localStorage.getItem(
          "ejik-fit:company-job-notifications-checked-at",
        ) ?? "",
      ),
    ).toBeGreaterThan(Date.parse("2026-07-14T00:00:00.000Z"));
  });

  it("shows real saved-search jobs before existing activity", async () => {
    mockSavedSearches([pythonSearch]);
    mockSavedSearchEvaluation({
      status: "ready",
      groups: [readyGroup(pythonSearch.id, [savedSearchJob()])],
      error: "",
    });

    render(
      <ActivityNotificationCenter viewer={viewer} />,
    );

    expect(
      await screen.findByText("저장 검색 · Python 백엔드"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("NAVER · Backend Engineer").closest("a"),
    ).toHaveAttribute("href", "/jobs/new-job");
    expect(screen.getByText("이직핏이 새로 확인")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "공고 알림에서 더 보기" }),
    ).toHaveAttribute("href", "/career/alerts");
    expect(useSavedJobSearches).toHaveBeenCalledWith(viewer);
    expect(useSavedSearchEvaluation).toHaveBeenCalledWith(
      [pythonSearch],
      "ready",
      markSavedSearchChecked,
    );
  });

  it("keeps successful saved-search alerts when another search fails", async () => {
    const failedSearch: SavedJobSearch = {
      ...pythonSearch,
      id: "search-2",
      name: "데이터 엔지니어",
      filterKey: "data|data|",
      query: "data",
      category: "data",
    };
    mockSavedSearches([pythonSearch, failedSearch]);
    mockSavedSearchEvaluation({
      status: "partial",
      groups: [
        readyGroup(pythonSearch.id, [savedSearchJob()]),
        {
          searchId: failedSearch.id,
          status: "error",
          total: null,
          items: [],
        },
      ],
      error: "일부 저장 검색 공고를 확인하지 못했습니다.",
    });

    render(
      <ActivityNotificationCenter viewer={viewer} />,
    );

    expect(
      await screen.findByText("NAVER · Backend Engineer"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("일부 공고 알림을 확인하지 못했습니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "공고 알림 다시 확인" }));
    expect(refreshSavedSearchEvaluation).toHaveBeenCalledOnce();
  });
});
