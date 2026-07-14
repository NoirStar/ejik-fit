import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocalCommunityPost } from "@/lib/local-community-posts";
import {
  readRecentCommunityTopics,
  recordRecentCommunityTopic,
} from "@/lib/recent-community-topics";
import type {
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";
import { addLocalPostComment } from "@/lib/social-interactions";

import { HomeFeed } from "./home-feed";
import { buildHomeFeedSnapshot } from "./model";
import type { ResourceState } from "./resource-state";

const postings: PostingListResponse = {
  total: 1,
  items: [
    {
      id: "job-1",
      title: "Backend Engineer",
      company_name: "토스",
      company_slug: "toss",
      career_type: "experienced",
      employment_type: "FULL_TIME",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://careers.toss.im/job-1",
      last_verified_at: "2026-07-12T15:00:00.000Z",
    },
  ],
};

const skillStats: SkillStatsResponse = {
  total: 1,
  items: [
    {
      skill: "Kubernetes",
      category: "infra",
      count: 14,
      required_count: 8,
      preferred_count: 4,
      unspecified_count: 2,
    },
  ],
};

const graph: SkillGraphResponse = {
  seed: "Java",
  nodes: [],
  edges: [],
  evidence: [
    {
      posting_id: "job-1",
      title: "Backend Engineer",
      company_name: "토스",
      skills: ["Java", "Spring", "Kafka"],
      required: ["Java", "Spring"],
      preferred: ["Kafka"],
      unspecified: [],
    },
  ],
  meta: { limit: 30, min_confidence: 0.8 },
};

function ready<T>(data: T): ResourceState<T> {
  return { status: "ready", data };
}

function buildSnapshot() {
  return buildHomeFeedSnapshot({
    postings: ready(postings),
    skillStats: ready(skillStats),
    graph: ready(graph),
    ownedSkills: ["Java", "Kafka"],
  });
}

describe("HomeFeed", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders mixed social and verified market content", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

    expect(
      screen.getByRole("heading", { name: "내 커리어와 가까운 이야기" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "추천" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("article", { name: /3년차 백엔드 개발자/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: "Kubernetes을 요구하는 공식 공고를 확인했어요",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("필수 8건")).toBeInTheDocument();
    expect(screen.getByText("우대 4건")).toBeInTheDocument();
    expect(screen.getByText("7월 13일 00:00")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "토스 기업 채용 현황" }),
    ).toHaveAttribute("href", "/companies/toss");
    const communityPost = screen.getByRole("article", {
      name: /3년차 백엔드 개발자/,
    });
    expect(
      within(communityPost).getByRole("link", {
        name: "백엔드 커뮤니티 검색",
      }),
    ).toHaveAttribute("href", "/search?q=%EB%B0%B1%EC%97%94%EB%93%9C&scope=community");
    expect(screen.getByRole("link", { name: "저장 보관함" })).toHaveAttribute(
      "href",
      "/career/saved",
    );
    expect(screen.getByRole("link", { name: "내 질문" })).toHaveAttribute(
      "href",
      "/career/questions",
    );
  });

  it("shows an honest empty state instead of invented recent topics", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

    const recent = screen.getByRole("region", { name: "최근 본 주제" });
    expect(recent).toHaveTextContent(
      "커뮤니티 글을 열면 이 브라우저에 최근 주제가 표시됩니다.",
    );
    expect(
      within(recent).queryByRole("link", { name: "# 백엔드" }),
    ).not.toBeInTheDocument();
  });

  it("restores recent topics in newest-first order and reacts to same-tab views", async () => {
    recordRecentCommunityTopic(
      {
        postId: "career-move-3y-backend",
        title: "3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?",
        topicLabel: "백엔드",
        source: "mock",
      },
      { viewedAt: "2026-07-14T01:00:00.000Z" },
    );
    recordRecentCommunityTopic(
      {
        postId: "kubernetes-experience",
        title: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
        topicLabel: "Kubernetes",
        source: "mock",
      },
      { viewedAt: "2026-07-14T02:00:00.000Z" },
    );
    render(<HomeFeed snapshot={buildSnapshot()} />);

    const recent = screen.getByRole("region", { name: "최근 본 주제" });
    const restoredLinks = await within(recent).findAllByRole("link", {
      name: /다시 보기/,
    });
    expect(restoredLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/posts/kubernetes-experience",
      "/posts/career-move-3y-backend",
    ]);
    expect(restoredLinks[0]).toHaveAccessibleName(
      "Kubernetes: Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요? 다시 보기",
    );

    act(() => {
      recordRecentCommunityTopic(
        {
          postId: "salary-negotiation-range",
          title: "연봉 협상 범위, 시장 데이터와 어떻게 맞춰보시나요?",
          topicLabel: "연봉 협상",
          source: "mock",
        },
        { viewedAt: "2026-07-14T03:00:00.000Z" },
      );
    });
    expect(
      await within(recent).findByRole("link", {
        name: "연봉 협상: 연봉 협상 범위, 시장 데이터와 어떻게 맞춰보시나요? 다시 보기",
      }),
    ).toHaveAttribute("href", "/posts/salary-negotiation-range");
  });

  it("builds the following tab from browser-owned author choices", async () => {
    const firstRender = render(<HomeFeed snapshot={buildSnapshot()} />);

    fireEvent.click(screen.getByRole("tab", { name: "팔로잉" }));

    expect(
      screen.getByText("팔로우한 작성자가 없습니다."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "추천 탭에서 작성자 찾기" }),
    );
    expect(screen.getByRole("tab", { name: "추천" })).toHaveFocus();

    const communityPost = screen.getByRole("article", {
      name: /3년차 백엔드 개발자/,
    });
    const follow = within(communityPost).getByRole("button", {
      name: "서버정원 팔로우",
    });
    await waitFor(() => expect(follow).toBeEnabled());
    fireEvent.click(follow);
    expect(follow).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("ejik-fit:social-interactions")).toContain(
      "server-garden",
    );

    firstRender.unmount();
    render(<HomeFeed snapshot={buildSnapshot()} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "서버정원 팔로우 해제" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    fireEvent.click(screen.getByRole("tab", { name: "팔로잉" }));

    expect(screen.queryByRole("article", { name: /Backend Engineer/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("article", {
        name: "Kubernetes을 요구하는 공식 공고를 확인했어요",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: /3년차 백엔드 개발자/ }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "서버정원 팔로우 해제" }),
    );
    expect(
      screen.getByText("팔로우한 작성자가 없습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "서버정원 팔로우를 해제했습니다.",
    );
  });

  it("toggles local reactions and saves without changing server facts", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);
    const article = screen.getByRole("article", { name: /3년차 백엔드 개발자/ });
    const reaction = within(article).getByRole("button", { name: /공감/ });
    const save = within(article).getByRole("button", { name: /저장/ });

    expect(reaction).toHaveAttribute("aria-pressed", "false");
    expect(reaction).toHaveTextContent("32");
    fireEvent.click(reaction);
    expect(reaction).toHaveAttribute("aria-pressed", "true");
    expect(reaction).toHaveTextContent("33");

    expect(save).toHaveAttribute("aria-pressed", "false");
    expect(save).toHaveTextContent("18");
    fireEvent.click(save);
    expect(save).toHaveAttribute("aria-pressed", "true");
    expect(save).toHaveTextContent("19");
  });

  it("restores shared post reactions, saves, and browser comment counts", async () => {
    addLocalPostComment("career-move-3y-backend", "상세에서 남긴 댓글", {
      createdAt: "2026-07-14T02:00:00.000Z",
      id: "home-sync-comment",
    });
    const { unmount } = render(<HomeFeed snapshot={buildSnapshot()} />);
    const firstArticle = screen.getByRole("article", {
      name: /3년차 백엔드 개발자/,
    });

    expect(
      await within(firstArticle).findByRole("link", {
        name: /댓글 48개/,
      }),
    ).toBeInTheDocument();
    fireEvent.click(within(firstArticle).getByRole("button", { name: /공감/ }));
    fireEvent.click(within(firstArticle).getByRole("button", { name: /저장/ }));
    unmount();

    render(<HomeFeed snapshot={buildSnapshot()} />);
    const restoredArticle = screen.getByRole("article", {
      name: /3년차 백엔드 개발자/,
    });
    await waitFor(() => {
      expect(
        within(restoredArticle).getByRole("button", { name: /공감/ }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        within(restoredArticle).getByRole("button", { name: /저장/ }),
      ).toHaveAttribute("aria-pressed", "true");
    });
    expect(
      within(restoredArticle).getByRole("link", { name: /댓글 48개/ }),
    ).toBeInTheDocument();
  });

  it("persists recommended job saves in the shared browser list", async () => {
    const { unmount } = render(<HomeFeed snapshot={buildSnapshot()} />);
    const save = await screen.findByRole("button", {
      name: "Backend Engineer 저장",
    });

    fireEvent.click(save);
    expect(localStorage.getItem("ejik-fit:saved-job-ids")).toBe('["job-1"]');
    unmount();

    render(<HomeFeed snapshot={buildSnapshot()} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Backend Engineer 저장" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("validates, persists, restores, and deletes a browser-only post", async () => {
    const { unmount } = render(<HomeFeed snapshot={buildSnapshot()} />);

    fireEvent.click(screen.getByRole("button", { name: "커뮤니티 글쓰기" }));
    fireEvent.click(screen.getByRole("button", { name: "피드에 올리기" }));

    expect(screen.getByText("제목을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("내용을 입력해 주세요.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "첫 이직 준비에서 배운 점" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "공고의 요구 기술을 먼저 비교하니 준비할 순서가 훨씬 선명해졌습니다." },
    });
    fireEvent.change(screen.getByLabelText("태그 (선택)"), {
      target: { value: "이직 준비, Java, Java, 백엔드" },
    });
    fireEvent.click(screen.getByRole("button", { name: "피드에 올리기" }));

    expect(screen.queryByRole("dialog", { name: "커뮤니티 글쓰기" })).not.toBeInTheDocument();
    const firstArticle = screen.getAllByRole("article")[0];
    expect(
      within(firstArticle).getByRole("heading", { name: "첫 이직 준비에서 배운 점" }),
    ).toBeInTheDocument();
    const stored = JSON.parse(
      localStorage.getItem("ejik-fit:local-community-posts")!,
    );
    expect(stored).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^local-/),
        title: "첫 이직 준비에서 배운 점",
        body: "공고의 요구 기술을 먼저 비교하니 준비할 순서가 훨씬 선명해졌습니다.",
        tags: ["이직 준비", "Java", "백엔드"],
      }),
    ]);
    expect(
      within(firstArticle).getByRole("link", {
        name: "첫 이직 준비에서 배운 점",
      }),
    ).toHaveAttribute("href", `/posts/${stored[0].id}`);
    expect(
      screen.getByText("작성한 글을 이 브라우저에 저장했습니다."),
    ).toBeInTheDocument();
    act(() => {
      recordRecentCommunityTopic(
        {
          postId: stored[0].id,
          title: "첫 이직 준비에서 배운 점",
          topicLabel: "이직 준비",
          source: "local",
        },
        { viewedAt: "2026-07-14T05:00:00.000Z" },
      );
    });
    expect(
      await screen.findByRole("link", {
        name: "이직 준비: 첫 이직 준비에서 배운 점 다시 보기",
      }),
    ).toBeInTheDocument();

    unmount();
    render(<HomeFeed snapshot={buildSnapshot()} />);
    const restoredArticle = await screen.findByRole("article", {
      name: "첫 이직 준비에서 배운 점",
    });
    fireEvent.click(
      within(restoredArticle).getByRole("button", {
        name: "첫 이직 준비에서 배운 점 삭제",
      }),
    );
    expect(
      screen.queryByRole("article", { name: "첫 이직 준비에서 배운 점" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("ejik-fit:local-community-posts")).toBe("[]");
    expect(readRecentCommunityTopics()).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "작성한 글을 이 브라우저에서 삭제했습니다.",
    );
  });

  it("reacts to local post changes elsewhere in the same tab", async () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

    act(() => {
      createLocalCommunityPost(
        { title: "다른 화면에서 쓴 글", body: "동기화 본문", tags: ["동기화"] },
        {
          id: "local-same-tab",
          createdAt: "2026-07-14T04:00:00.000Z",
        },
      );
    });

    expect(
      await screen.findByRole("article", { name: "다른 화면에서 쓴 글" }),
    ).toBeInTheDocument();
  });

  it("keeps the composer open when browser post storage is blocked", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    fireEvent.click(screen.getByRole("button", { name: "커뮤니티 글쓰기" }));
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "저장되지 않을 글" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "작성 중인 내용은 유지되어야 합니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "피드에 올리기" }));

    expect(
      screen.getByRole("dialog", { name: "커뮤니티 글쓰기" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "글을 브라우저에 저장하지 못했습니다.",
    );
    expect(screen.getByLabelText("제목")).toHaveValue("저장되지 않을 글");
    expect(
      screen.queryByRole("article", { name: "저장되지 않을 글" }),
    ).not.toBeInTheDocument();
  });

  it("supports arrow-key tab selection", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);
    const recommended = screen.getByRole("tab", { name: "추천" });
    const following = screen.getByRole("tab", { name: "팔로잉" });
    const popular = screen.getByRole("tab", { name: "인기" });

    recommended.focus();
    fireEvent.keyDown(recommended, { key: "ArrowRight" });
    expect(following).toHaveAttribute("aria-selected", "true");
    expect(following).toHaveFocus();

    fireEvent.keyDown(following, { key: "End" });
    expect(popular).toHaveAttribute("aria-selected", "true");
    expect(popular).toHaveFocus();
  });

  it("keeps Tab focus inside the composer dialog", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);
    fireEvent.click(screen.getByRole("button", { name: "커뮤니티 글쓰기" }));
    const close = screen.getByRole("button", { name: "글쓰기 닫기" });
    const submit = screen.getByRole("button", { name: "피드에 올리기" });

    submit.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(submit).toHaveFocus();
  });

  it("keeps social content visible with an explicit partial-data notice", () => {
    const snapshot = buildSnapshot();

    render(
      <HomeFeed
        snapshot={{
          ...snapshot,
          dataStatus: "partial",
          resourceErrors: ["graph offline"],
        }}
      />,
    );

    expect(screen.getByText("일부 실데이터를 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByText("graph offline")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "데이터 다시 불러오기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: /3년차 백엔드 개발자/ }),
    ).toBeInTheDocument();
  });
});
