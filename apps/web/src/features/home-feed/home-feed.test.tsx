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

import { AuthViewerProvider } from "@/features/auth/auth-viewer-context";
import {
  COMMUNITY_DRAFT_STORAGE_KEY,
  saveCommunityDraft,
} from "@/features/community/community-draft";
import type { CommunityStore } from "@/features/community/community-store";
import type {
  CommunityPost,
  CreateCommunityPostInput,
} from "@/lib/community-contract";
import { createLocalCommunityPost } from "@/lib/local-community-posts";
import {
  readRecentCommunityTopics,
  recordRecentCommunityTopic,
} from "@/lib/recent-community-topics";
import type {
  FitAnalyzeResponse,
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";
import { addLocalPostComment } from "@/lib/social-interactions";

import { HomeFeed } from "./home-feed";
import { buildHomeFeedSnapshot } from "./model";
import type { ResourceState } from "./resource-state";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

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

const fit: FitAnalyzeResponse = {
  coverage: {
    matching_posting_count: 12,
    strong_fit_posting_count: 4,
  },
  domain_branches: [],
  recommended_next_skills: [
    {
      skill: "Kubernetes",
      reason: "보유 스킬과 함께 등장한 공고에서 8회 부족 요구사항으로 확인됨",
      required_count: 6,
      preferred_count: 2,
      supporting_posting_count: 8,
    },
  ],
};

function ready<T>(data: T): ResourceState<T> {
  return { status: "ready", data };
}

function buildSnapshot() {
  return buildHomeFeedSnapshot({
    postings: ready(postings),
    skillStats: ready(skillStats),
    graph: ready(graph),
    fit: ready(fit),
    careerPreferences: {
      careerCondition: "experienced",
      targetDomain: "backend",
    },
    ownedSkills: ["Java", "Kafka"],
  });
}

function serverCommunityStore(post: CommunityPost) {
  return {
    listPosts: vi.fn(async () => [post]),
    listSavedPosts: vi.fn(async () => [post]),
    getPost: vi.fn(async () => post),
    getComment: vi.fn(async () => null),
    listComments: vi.fn(async () => []),
    loadViewerState: vi.fn(async () => ({
      reactedPostIds: [post.id],
      savedPostIds: [],
      followedAuthorIds: [],
    })),
    createPost: vi.fn(
      async (_authorId: string, _input: CreateCommunityPostInput) => post,
    ),
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

describe("HomeFeed", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    navigation.push.mockReset();
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
    expect(screen.getByText("미분류 2건")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "수집 기준 확인" }),
    ).toHaveAttribute("href", "/data-policy");
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
    expect(screen.getByRole("link", { name: "내 글" })).toHaveAttribute(
      "href",
      "/career/questions",
    );
    const insight = screen.getByRole("region", { name: "내 커리어 인사이트" });
    expect(within(insight).getByText("내 기술과 겹치는 공개 공고")).toBeInTheDocument();
    expect(within(insight).getByText("12건")).toBeInTheDocument();
    expect(within(insight).getByText("필수 기술 절반 이상 4건")).toBeInTheDocument();
    expect(within(insight).getByRole("link", { name: "Kubernetes 근거 보기" }))
      .toHaveAttribute("href", "/skill-map?skill=Kubernetes");
    expect(within(insight).getByText("필수 6 · 우대 2")).toBeInTheDocument();
    const marketContext = screen.getByRole("region", { name: "내 관심 시장" });
    expect(within(marketContext).getByText("경력 · 백엔드"))
      .toBeInTheDocument();
    expect(within(marketContext).getByText("내 기술 2개"))
      .toBeInTheDocument();
    expect(within(marketContext).getByRole("link", {
      name: "기술 관리 · 조건 수정",
    })).toHaveAttribute("href", "/career");
  });

  it("uses the shell write action without repeating a central write button", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

    expect(
      screen.getByRole("heading", { name: "내 커리어와 가까운 이야기" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "커뮤니티 글쓰기" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("커뮤니티 예시 + 공식 채용 데이터"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "현업의 고민과 면접 경험 사이에 확인 가능한 공고 근거를 함께 놓았습니다.",
      ),
    ).not.toBeInTheDocument();
  });

  it("uses an honest compact discovery state before personalization", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      graph: ready(graph),
      fit: null,
      ownedSkills: [],
    });

    render(<HomeFeed snapshot={snapshot} />);

    expect(
      screen.getByRole("heading", { name: "커리어 이야기 둘러보기" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "둘러보기" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("region", { name: "내 커리어 인사이트" }),
    ).not.toBeInTheDocument();
    const context = screen.getByRole("region", { name: "내 관심 시장" });
    expect(within(context).queryByText("내 기술 0개")).not.toBeInTheDocument();
    expect(
      within(context).getByRole("link", {
        name: "기술 추가 · 조건 설정",
      }),
    ).toHaveAttribute("href", "/career");
    expect(
      screen.getByRole("link", { name: "내 기술 추가" }),
    ).toHaveAttribute("href", "/career");
  });

  it("does not spend rail space on an empty recent-topic state", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

    expect(
      screen.queryByRole("region", { name: "최근 본 주제" }),
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
    expect(
      screen.queryByRole("region", { name: "팔로우 중인 글" }),
    ).not.toBeInTheDocument();

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
    const followingRail = screen.getByRole("region", {
      name: "팔로우 중인 글",
    });
    expect(
      within(followingRail).getByRole("link", {
        name: "서버정원의 글: 3년차 백엔드 개발자, 지금 이직하는 게 맞을까요?",
      }),
    ).toHaveAttribute("href", "/posts/career-move-3y-backend");
    fireEvent.click(
      within(followingRail).getByRole("button", { name: "팔로잉 탭 보기" }),
    );
    expect(screen.getByRole("tab", { name: "팔로잉" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "팔로잉" })).toHaveFocus();

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

  it("renders account community posts before fixtures without double-counting reactions", async () => {
    const post: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "22222222-2222-4222-8222-222222222222",
        nickname: "실제작성자",
      },
      category: "커리어 질문",
      title: "계정에 저장된 커뮤니티 질문",
      body: "서버에 저장된 실제 커뮤니티 본문입니다.",
      tags: ["백엔드"],
      metrics: { reactions: 4, comments: 2, saves: 1 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };
    const store = serverCommunityStore(post);

    render(
      <AuthViewerProvider
        ready
        viewer={{
          id: "11111111-1111-4111-8111-111111111111",
          email: "viewer@example.com",
        }}
      >
        <HomeFeed communityStore={store} snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );

    const article = await screen.findByRole("article", {
      name: "계정에 저장된 커뮤니티 질문",
    });
    expect(screen.getAllByRole("article")[0]).toBe(article);
    const reaction = within(article).getByRole("button", { name: /공감 취소/ });
    expect(reaction).toHaveTextContent("4");

    fireEvent.click(reaction);
    await waitFor(() =>
      expect(store.setPostReaction).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        post.id,
        false,
      ),
    );
    expect(reaction).toHaveTextContent("3");

    fireEvent.click(
      within(article).getByRole("button", { name: "실제작성자 팔로우" }),
    );
    await waitFor(() =>
      expect(store.setAuthorFollowed).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        post.author.id,
        true,
      ),
    );
    expect(
      within(screen.getByRole("region", { name: "팔로우 중인 글" })).getByRole(
        "link",
        { name: `실제작성자의 글: ${post.title}` },
      ),
    ).toHaveAttribute("href", `/posts/${post.id}`);
  });

  it("publishes signed-in composer drafts to the account instead of local storage", async () => {
    const existing: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "11111111-1111-4111-8111-111111111111",
        nickname: "나",
      },
      category: "커리어 질문",
      title: "기존 글",
      body: "기존 본문",
      tags: [],
      metrics: { reactions: 0, comments: 0, saves: 0 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };
    const store = serverCommunityStore(existing);
    store.createPost.mockImplementationOnce(async (_authorId, input) => ({
      ...existing,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      category: input.category,
      title: input.title,
      body: input.body,
      tags: input.tags,
    }));

    render(
      <AuthViewerProvider
        ready
        viewer={{
          id: "11111111-1111-4111-8111-111111111111",
          email: "viewer@example.com",
        }}
      >
        <HomeFeed
          communityStore={store}
          composeMode="new"
          snapshot={buildSnapshot()}
        />
      </AuthViewerProvider>,
    );

    expect(screen.getByText("계정에 저장되는 글")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "계정으로 올릴 글" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "브라우저가 아닌 계정에 저장할 본문입니다." },
    });
    fireEvent.change(screen.getByLabelText("태그 (선택)"), {
      target: { value: "백엔드, 백엔드, Java" },
    });
    const submit = screen.getByRole("button", { name: "피드에 올리기" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() =>
      expect(store.createPost).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        {
          category: "커리어 질문",
          title: "계정으로 올릴 글",
          body: "브라우저가 아닌 계정에 저장할 본문입니다.",
          tags: ["백엔드", "Java"],
        },
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "커뮤니티 글쓰기" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("article", { name: "계정으로 올릴 글" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("ejik-fit:local-community-posts")).toBeNull();
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

  it("keeps a guest draft in the session and sends publishing through login", async () => {
    render(
      <AuthViewerProvider ready viewer={null}>
        <HomeFeed composeMode="new" snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "피드에 올리기" }));

    expect(screen.getByText("제목을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("내용을 입력해 주세요.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "면접 후기" }));
    expect(
      screen.getByRole("radio", { name: "면접 후기" }),
    ).toBeChecked();
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "도움이 필요합니다" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "공고의 요구 기술을 비교한 뒤 무엇을 학습할지 궁금합니다." },
    });
    fireEvent.change(screen.getByLabelText("태그 (선택)"), {
      target: { value: "이직 준비, Java, Java, 백엔드" },
    });
    fireEvent.click(screen.getByRole("button", { name: "피드에 올리기" }));

    expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toContain(
      "도움이 필요합니다",
    );
    expect(localStorage.getItem("ejik-fit:local-community-posts")).toBeNull();
    expect(navigation.push).toHaveBeenCalledWith(
      "/login?next=%2F%3Fcompose%3Dresume",
    );
  });

  it("restores a guest draft after login and publishes only on confirmation", async () => {
    saveCommunityDraft(
      {
        category: "커리어 고민",
        title: "이어 쓰는 고민",
        body: "로그인 전 작성한 본문을 다시 확인합니다.",
        tags: ["이직"],
      },
      sessionStorage,
    );
    const existing: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "11111111-1111-4111-8111-111111111111",
        nickname: "나",
      },
      category: "커리어 질문",
      title: "기존 글",
      body: "기존 본문",
      tags: [],
      metrics: { reactions: 0, comments: 0, saves: 0 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };
    const store = serverCommunityStore(existing);

    render(
      <AuthViewerProvider
        ready
        viewer={{
          id: "11111111-1111-4111-8111-111111111111",
          email: "viewer@example.com",
        }}
      >
        <HomeFeed
          communityStore={store}
          composeMode="resume"
          snapshot={buildSnapshot()}
        />
      </AuthViewerProvider>,
    );

    expect(screen.getByLabelText("제목")).toHaveValue("이어 쓰는 고민");
    expect(screen.getByLabelText("내용")).toHaveValue(
      "로그인 전 작성한 본문을 다시 확인합니다.",
    );
    expect(screen.getByText("임시 저장된 글을 불러왔습니다.")).toBeInTheDocument();
    expect(store.createPost).not.toHaveBeenCalled();

    const publish = screen.getByRole("button", { name: "피드에 올리기" });
    await waitFor(() => expect(publish).toBeEnabled());
    fireEvent.click(publish);

    await waitFor(() =>
      expect(store.createPost).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        {
          category: "커리어 고민",
          title: "이어 쓰는 고민",
          body: "로그인 전 작성한 본문을 다시 확인합니다.",
          tags: ["이직"],
        },
      ),
    );
    expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toBeNull();
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

  it("keeps the composer open when session draft storage is blocked", () => {
    render(
      <AuthViewerProvider ready viewer={null}>
        <HomeFeed composeMode="new" snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

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
      "임시 글을 저장하지 못했습니다.",
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
    render(
      <AuthViewerProvider ready viewer={null}>
        <HomeFeed composeMode="new" snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );
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
