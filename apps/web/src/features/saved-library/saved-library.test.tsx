import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthViewerProvider } from "@/features/auth/auth-viewer-context";
import type { CommunityStore } from "@/features/community/community-store";
import type { CommunityPost } from "@/lib/community-contract";
import { deleteLocalCommunityPost } from "@/lib/local-community-posts";
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

const accountCommunityPost: CommunityPost = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  author: {
    id: "22222222-2222-4222-8222-222222222222",
    nickname: "서버정원",
  },
  category: "커리어 질문",
  title: "계정에 저장한 Python 커뮤니티 글",
  body: "실제 사용자가 작성하고 내 계정에 저장한 글입니다.",
  tags: ["Python"],
  metrics: { reactions: 4, comments: 2, saves: 1 },
  createdAt: "2026-07-21T04:00:00.000Z",
  updatedAt: "2026-07-21T04:00:00.000Z",
};

function accountCommunityStore() {
  return {
    listPosts: vi.fn(async () => []),
    listSavedPosts: vi.fn(async () => [accountCommunityPost]),
    getPost: vi.fn(async () => accountCommunityPost),
    getComment: vi.fn(async () => null),
    listComments: vi.fn(async () => []),
    loadViewerState: vi.fn(async () => ({
      reactedPostIds: [],
      savedPostIds: [accountCommunityPost.id],
      followedAuthorIds: [],
    })),
    createPost: vi.fn(async () => accountCommunityPost),
    deletePost: vi.fn(async () => undefined),
    createComment: vi.fn(async () => {
      throw new Error("not used");
    }),
    deleteComment: vi.fn(async () => undefined),
    setPostReaction: vi.fn(async () => undefined),
    setPostSaved: vi.fn(async () => undefined),
    setAuthorFollowed: vi.fn(async () => undefined),
    createReport: vi.fn(async () => undefined),
  } satisfies CommunityStore;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function saveBrowserItems(
  jobIds = ["job-python"],
  postIds = ["kubernetes-experience"],
  stages: Record<string, string> = {},
) {
  window.localStorage.setItem(
    "ejik-fit:saved-job-ids",
    JSON.stringify(jobIds),
  );
  window.localStorage.setItem(
    "ejik-fit:social-interactions",
    JSON.stringify({ savedPostIds: postIds }),
  );
  window.localStorage.setItem(
    "ejik-fit:job-application-stages",
    JSON.stringify(stages),
  );
}

function saveLocalPost() {
  window.localStorage.setItem(
    "ejik-fit:local-community-posts",
    JSON.stringify([
      {
        id: "local-browser-question",
        title: "브라우저에 저장한 내 질문",
        body: "공식 공고를 비교한 뒤 남긴 질문입니다.",
        tags: ["백엔드", "이직 준비"],
        createdAt: "2026-07-14T03:00:00.000Z",
      },
    ]),
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
    expect(
      within(job).getByRole("combobox", {
        name: "Python Backend Engineer 지원 단계",
      }),
    ).toHaveValue("");
    expect(screen.getByRole("tab", { name: "지원 관리 0" })).toBeInTheDocument();
  });

  it("restores saved browser-owned posts and removes them when the source post is deleted", async () => {
    saveBrowserItems([], ["local-browser-question", "kubernetes-experience"]);
    saveLocalPost();
    render(<SavedLibrary />);

    const localPost = await screen.findByRole("article", {
      name: "브라우저에 저장한 내 질문",
    });
    expect(within(localPost).getByText("내 로컬 글")).toBeInTheDocument();
    expect(
      within(localPost).getByRole("link", { name: "브라우저에 저장한 내 질문" }),
    ).toHaveAttribute("href", "/posts/local-browser-question");
    expect(within(localPost).getByText(/나 · 이 브라우저에서 작성/)).toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
      }),
    ).toHaveTextContent("예시 콘텐츠");
    expect(screen.getByRole("tab", { name: "커뮤니티 2" })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "공식 공고" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("data-single", "true");

    deleteLocalCommunityPost("local-browser-question");

    await waitFor(() => {
      expect(
        screen.queryByRole("article", { name: "브라우저에 저장한 내 질문" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "커뮤니티 1" })).toBeInTheDocument();
    expect(screen.queryByText(/찾지 못한 저장 글/)).not.toBeInTheDocument();
  });

  it("loads and removes a signed-in account community save from the server store", async () => {
    const viewerId = "11111111-1111-4111-8111-111111111111";
    const store = accountCommunityStore();
    render(
      <AuthViewerProvider
        ready
        viewer={{ id: viewerId, email: "viewer@example.com" }}
      >
        <SavedLibrary communityStore={store} initialScope="community" />
      </AuthViewerProvider>,
    );

    const savedPost = await screen.findByRole("article", {
      name: accountCommunityPost.title,
    });
    expect(store.listSavedPosts).toHaveBeenCalledWith(viewerId, 50);
    expect(within(savedPost).getByText("커뮤니티")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "커뮤니티 1" })).toBeInTheDocument();

    fireEvent.click(
      within(savedPost).getByRole("button", {
        name: `${accountCommunityPost.title} 저장 해제`,
      }),
    );

    await waitFor(() => {
      expect(store.setPostSaved).toHaveBeenCalledWith(
        viewerId,
        accountCommunityPost.id,
        false,
      );
      expect(
        screen.queryByRole("article", { name: accountCommunityPost.title }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/계정 저장 보관함에서 제거했습니다/)).toBeInTheDocument();
  });

  it("does not announce success when a community save removal is blocked", async () => {
    saveBrowserItems([], ["local-browser-question"]);
    saveLocalPost();
    render(<SavedLibrary />);
    const localPost = await screen.findByRole("article", {
      name: "브라우저에 저장한 내 질문",
    });
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "ejik-fit:social-interactions") {
          throw new DOMException("blocked", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      });

    fireEvent.click(
      within(localPost).getByRole("button", {
        name: "브라우저에 저장한 내 질문 저장 해제",
      }),
    );

    expect(localPost).toBeInTheDocument();
    expect(
      screen.getByText("브라우저에 저장한 내 질문의 저장 상태를 변경하지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/저장 보관함에서 제거했습니다/)).not.toBeInTheDocument();
    setItem.mockRestore();
  });

  it("persists a user-selected stage and filters the application scope", async () => {
    saveBrowserItems();
    render(<SavedLibrary />);
    const job = await screen.findByRole("article", {
      name: "Python Backend Engineer",
    });
    const stageSelect = within(job).getByRole("combobox", {
      name: "Python Backend Engineer 지원 단계",
    });

    fireEvent.change(stageSelect, { target: { value: "interview" } });

    expect(stageSelect).toHaveDisplayValue("면접 진행");
    expect(
      JSON.parse(
        window.localStorage.getItem("ejik-fit:job-application-stages")!,
      ),
    ).toEqual({ "job-python": "interview" });
    expect(screen.getByRole("tab", { name: "지원 관리 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "지원 관리 1" }));
    expect(job).toBeInTheDocument();
    expect(screen.getByText("지원 단계를 기록한 실제 공고")).toBeInTheDocument();
    expect(
      screen.queryByRole("article", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
      }),
    ).not.toBeInTheDocument();

    fireEvent.change(stageSelect, { target: { value: "" } });
    expect(
      await screen.findByText("지원 단계를 기록한 공고가 없습니다."),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("ejik-fit:job-application-stages")).toBe(
      "{}",
    );
  });

  it("reports a blocked stage write without announcing a false success", async () => {
    saveBrowserItems();
    render(<SavedLibrary />);
    const job = await screen.findByRole("article", {
      name: "Python Backend Engineer",
    });
    const stageSelect = within(job).getByRole("combobox", {
      name: "Python Backend Engineer 지원 단계",
    });
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "ejik-fit:job-application-stages") {
          throw new DOMException("blocked", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      });

    fireEvent.change(stageSelect, { target: { value: "applied" } });

    expect(stageSelect).toHaveValue("");
    expect(
      screen.getByText("Python Backend Engineer의 지원 단계를 저장하지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/지원 단계를 지원 완료로 저장했습니다/)).not.toBeInTheDocument();
    setItem.mockRestore();
  });

  it("removes saved jobs and community items through the shared browser stores", async () => {
    saveBrowserItems(
      ["job-python"],
      ["kubernetes-experience"],
      { "job-python": "applied" },
    );
    render(<SavedLibrary />);
    await screen.findByRole("article", { name: "Python Backend Engineer" });

    const removeJobButton = screen.getByRole("button", {
      name: "Python Backend Engineer 저장 해제",
    });
    expect(removeJobButton).toHaveAccessibleDescription(
      /저장 해제 시 단계도 삭제/,
    );
    fireEvent.click(removeJobButton);
    await waitFor(() => {
      expect(
        screen.queryByRole("article", { name: "Python Backend Engineer" }),
      ).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem("ejik-fit:saved-job-ids")).toBe("[]");
    expect(window.localStorage.getItem("ejik-fit:job-application-stages")).toBe(
      "{}",
    );

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
      screen.getByRole("link", { name: "커뮤니티 보기" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByText("아직 저장한 항목이 없습니다.").closest('[role="status"]'),
    ).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds legacy browser storage before requesting actual job details", async () => {
    const ids = Array.from({ length: 25 }, (_, index) => `job-${index}`);
    saveBrowserItems(ids, []);
    fetchMock.mockResolvedValue(
      jsonResponse({ items: [], unavailable_ids: [], failed_ids: [] }),
    );
    render(<SavedLibrary />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const requestInit = fetchMock.mock.calls[0]?.[1];
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody.job_ids).toHaveLength(24);
    expect(requestBody.job_ids[0]).toBe("job-24");
    expect(requestBody.job_ids).toContain("job-24");
    expect(requestBody.job_ids).not.toContain("job-0");
  });

  it("keeps successful and mock items visible while explaining partial failures", async () => {
    saveBrowserItems(
      ["job-python", "gone-job", "retry-job"],
      ["kubernetes-experience"],
      { "gone-job": "applied", "retry-job": "interview" },
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
      screen
        .getByText("현재 API에서 확인되지 않는 저장 공고 1개")
        .closest('[role="status"]'),
    ).not.toBeNull();
    expect(
      screen.getByText("저장 공고 1개를 다시 확인하지 못했습니다."),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText("저장 공고 1개를 다시 확인하지 못했습니다.")
        .closest('[role="alert"]'),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "공고 다시 확인" })).toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
      }),
    ).toBeInTheDocument();

    window.localStorage.setItem(
      "ejik-fit:job-application-stages",
      JSON.stringify({
        "gone-job": "applied",
        "retry-job": "offer",
        "concurrent-job": "preparing",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "확인 불가 항목 정리" }));
    expect(
      JSON.parse(window.localStorage.getItem("ejik-fit:saved-job-ids")!),
    ).toEqual(["job-python", "retry-job"]);
    expect(
      JSON.parse(
        window.localStorage.getItem("ejik-fit:job-application-stages")!,
      ),
    ).toEqual({ "retry-job": "offer", "concurrent-job": "preparing" });
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

    fireEvent.click(screen.getByRole("tab", { name: "커뮤니티 1" }));
    expect(screen.getByRole("tab", { name: "커뮤니티 1" })).toHaveAttribute(
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
