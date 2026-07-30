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
  CommunityCursor,
  CommunityPost,
  CommunityViewerState,
  CreateCommunityPostInput,
} from "@/lib/community-contract";
import { CommunityStoreError } from "@/lib/community-contract";
import { createLocalCommunityPost } from "@/lib/local-community-posts";
import type {
  FitAnalyzeResponse,
  PostingListResponse,
  SkillStatsResponse,
} from "@/lib/types";

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
      required_skills: ["Java", "Spring"],
      preferred_skills: ["Kafka"],
      unspecified_skills: [],
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function installIntersectionObserver() {
  let callback!: IntersectionObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();

  class MockIntersectionObserver {
    constructor(next: IntersectionObserverCallback) {
      callback = next;
    }

    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "800px 0px";
    thresholds = [0];
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  return {
    disconnect,
    observe,
    async enter() {
      const target = observe.mock.calls.at(-1)?.[0] as Element;
      await act(async () => {
        callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
        await Promise.resolve();
      });
    },
  };
}

function buildSnapshot() {
  return buildHomeFeedSnapshot({
    postings: ready(postings),
    skillStats: ready(skillStats),
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
    searchPosts: vi.fn(async () => ({ items: [post], nextCursor: null })),
    listPostPage: vi.fn(async () => ({
      items: [post],
      nextCursor: null as CommunityCursor | null,
    })),
    listFollowingPostPage: vi.fn(async () => ({
      items: [post],
      nextCursor: null as CommunityCursor | null,
    })),
    listSavedPostPage: vi.fn(async () => ({
      items: [post],
      nextCursor: null as CommunityCursor | null,
    })),
    listPosts: vi.fn(async () => [post]),
    listSavedPosts: vi.fn(async () => [post]),
    getPost: vi.fn(async () => post),
    getComment: vi.fn(async () => null),
    listCommentPage: vi.fn(async () => ({ items: [], nextCursor: null })),
    listComments: vi.fn(async () => []),
    loadViewerState: vi.fn(
      async (
        _viewerId: string,
        _targets: { postIds: string[]; authorIds: string[] },
      ): Promise<CommunityViewerState> => ({
        reactedPostIds: [post.id],
        savedPostIds: [],
        followedAuthorIds: [],
      }),
    ),
    createPost: vi.fn(
      async (_authorId: string, _input: CreateCommunityPostInput) => post,
    ),
    updatePost: vi.fn(async () => post),
    deletePost: vi.fn(async () => undefined),
    createComment: vi.fn(async () => {
      throw new Error("not used");
    }),
    updateComment: vi.fn(async () => {
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
    vi.unstubAllGlobals();
  });

  it("renders verified market content without built-in community examples", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

    expect(
      screen.getByRole("heading", { name: "내 커리어 브리핑" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "추천 피드" }),
    ).toBeInTheDocument();
    expect(screen.getByText("채용 시장")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "추천" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("article", { name: /3년차 백엔드 개발자/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: "Kubernetes 요구 공고",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("필수 8건")).toBeInTheDocument();
    expect(screen.getByText("우대 4건")).toBeInTheDocument();
    expect(screen.getByText("구분 없음 2건")).toBeInTheDocument();
    expect(
      screen.queryByText(
        /커리어 이야기 둘러보기|채용 시장 인사이트|내 커리어 인사이트/,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "수집 기준 확인" }),
    ).toHaveAttribute("href", "/data-policy");
    expect(
      screen.queryByRole("region", { name: "커리어핏 커뮤니티 가이드" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "내 커리어 바로가기" }),
    ).not.toBeInTheDocument();
    const briefing = screen.getByRole("region", { name: "내 커리어 브리핑" });
    expect(within(briefing).getByText("다음에 준비할 기술")).toBeInTheDocument();
    expect(within(briefing).getByRole("link", {
      name: "Kubernetes 추천 근거 보기",
    }))
      .toHaveAttribute("href", "/skill-map?skill=Kubernetes");
    expect(within(briefing).getByText(
      "관련 공고 8건에서 반복적으로 부족했습니다.",
    ))
      .toBeInTheDocument();
    expect(within(briefing).getByText("준비도 높은 공고")).toBeInTheDocument();
    expect(within(briefing).getByText("4건")).toBeInTheDocument();
    expect(within(briefing).getByText("필수 기술 절반 이상 충족"))
      .toBeInTheDocument();
    expect(within(briefing).getByText("기술이 겹치는 공고"))
      .toBeInTheDocument();
    expect(within(briefing).getByText("12건")).toBeInTheDocument();
    expect(within(briefing).getByText("내 기술 한 개 이상 포함"))
      .toBeInTheDocument();
    expect(within(briefing).queryByText("현재 수요 상위"))
      .not.toBeInTheDocument();
    expect(within(briefing).getByText("경력 · 백엔드"))
      .toBeInTheDocument();
    expect(within(briefing).getByRole("link", {
      name: "내 커리어 기준 수정",
    })).toHaveAttribute("href", "/career");
    expect(screen.getByText("공고 1개 분석 · 최신 확인 7월 13일"))
      .toBeInTheDocument();
    const job = screen.getByRole("article", { name: "Backend Engineer" });
    expect(within(job).getByText("내 기술 2개 일치")).toBeInTheDocument();
    expect(within(job).queryByText("필수 1/2 일치")).not.toBeInTheDocument();
    expect(within(job).getByRole("link", {
      name: "Backend Engineer 공고 보기",
    })).toHaveAttribute("href", "/jobs/job-1");
    expect(within(job).getByRole("link", {
      name: "Backend Engineer 공식 원문",
    })).toHaveAttribute("href", "https://careers.toss.im/job-1");
    expect(within(job).queryByText("공고 상세")).not.toBeInTheDocument();
    expect(screen.getByText("모든 콘텐츠를 확인했습니다.")).toHaveAttribute(
      "role",
      "status",
    );

    fireEvent.click(screen.getByRole("tab", { name: "인기" }));
    expect(
      screen.getByText("다른 탭을 선택하거나 첫 글을 작성해 주세요."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/작성해 보세요/)).not.toBeInTheDocument();
  });

  it("does not render built-in community guidance as user activity", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

    expect(
      screen.queryByRole("region", { name: "커리어핏 커뮤니티 가이드" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("읽기 전용 커뮤니티 예시")).not.toBeInTheDocument();
  });

  it("shows all four community tags as consistent search links", async () => {
    const post: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "22222222-2222-4222-8222-222222222222",
        nickname: "태그작성자",
      },
      category: "커리어 질문",
      title: "태그 네 개가 있는 글",
      body: "허용된 태그를 모두 확인합니다.",
      tags: ["백엔드", "Kubernetes", "성능 최적화", "아주 긴 기술 태그 이름"],
      metrics: { reactions: 0, comments: 0, saves: 0 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };

    render(
      <AuthViewerProvider ready viewer={null}>
        <HomeFeed
          communityStore={serverCommunityStore(post)}
          snapshot={buildSnapshot()}
        />
      </AuthViewerProvider>,
    );

    const article = await screen.findByRole("article", { name: post.title });
    const tags = within(article).getByRole("list", {
      name: `${post.title} 태그`,
    });
    expect(within(tags).getAllByRole("link")).toHaveLength(4);
    expect(
      within(tags).getByRole("link", {
        name: "아주 긴 기술 태그 이름 커뮤니티 검색",
      }),
    ).toHaveAttribute(
      "href",
      "/search?q=%EC%95%84%EC%A3%BC+%EA%B8%B4+%EA%B8%B0%EC%88%A0+%ED%83%9C%EA%B7%B8+%EC%9D%B4%EB%A6%84&scope=community",
    );
    expect(within(tags).queryByText("+1")).not.toBeInTheDocument();
  });

  it("keeps previous-browser posts in a recovery-only section", async () => {
    createLocalCommunityPost(
      {
        title: "이전 브라우저에 남은 글",
        body: "서버 이전 전 남아 있는 내용입니다.",
        tags: ["복구"],
      },
      {
        id: "local-recovery-post",
        createdAt: "2026-07-14T04:00:00.000Z",
      },
    );

    render(<HomeFeed snapshot={buildSnapshot()} />);

    const recovery = await screen.findByRole("region", {
      name: "이 기기에 남은 글",
    });
    expect(
      within(screen.getByRole("tabpanel")).queryByRole("article", {
        name: "이전 브라우저에 남은 글",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(recovery).getByRole("link", {
        name: "이전 브라우저에 남은 글 내용 확인",
      }),
    ).toHaveAttribute("href", "/posts/local-recovery-post");
    expect(
      within(recovery).getByRole("button", {
        name: "이전 브라우저에 남은 글 삭제",
      }),
    ).toBeInTheDocument();
    expect(within(recovery).queryByText(/공감|댓글|저장 [0-9]/)).not.toBeInTheDocument();
  });

  it("loads the next page at the feed sentinel without replacing the first page", async () => {
    const observer = installIntersectionObserver();
    const first: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "11111111-1111-4111-8111-111111111111",
        nickname: "첫작성자",
      },
      category: "커리어 질문",
      title: "첫 페이지 실제 글",
      body: "서버 첫 페이지 본문",
      tags: ["백엔드"],
      metrics: { reactions: 0, comments: 0, saves: 0 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };
    const second: CommunityPost = {
      ...first,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "다음 페이지 실제 글",
      createdAt: "2026-07-20T04:00:00.000Z",
      updatedAt: "2026-07-20T04:00:00.000Z",
    };
    const store = serverCommunityStore(first);
    store.listPostPage
      .mockResolvedValueOnce({
        items: [first],
        nextCursor: { createdAt: first.createdAt, id: first.id },
      })
      .mockResolvedValueOnce({ items: [second], nextCursor: null });

    render(
      <AuthViewerProvider
        ready
        viewer={{
          id: "33333333-3333-4333-8333-333333333333",
          email: "reader@example.com",
        }}
      >
        <HomeFeed communityStore={store} snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );

    expect(
      await screen.findByRole("article", { name: "첫 페이지 실제 글" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(observer.observe).toHaveBeenCalledTimes(1));
    await observer.enter();

    expect(
      await screen.findByRole("article", { name: "다음 페이지 실제 글" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "첫 페이지 실제 글" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "커뮤니티 글 더 보기" }),
    ).not.toBeInTheDocument();
  });

  it("waits for authentication initialization before observing the feed sentinel", async () => {
    const observer = installIntersectionObserver();
    const first: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "11111111-1111-4111-8111-111111111111",
        nickname: "첫작성자",
      },
      category: "커리어 질문",
      title: "인증 확인 전 서버 글",
      body: "서버에서 먼저 렌더링한 글입니다.",
      tags: ["백엔드"],
      metrics: { reactions: 0, comments: 0, saves: 0 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };
    const store = serverCommunityStore(first);
    const initialCommunityFeed = {
      status: "ready" as const,
      page: {
        items: [first],
        nextCursor: { createdAt: first.createdAt, id: first.id },
      },
    };
    const view = render(
      <AuthViewerProvider ready={false} viewer={null}>
        <HomeFeed
          communityStore={store}
          initialCommunityFeed={initialCommunityFeed}
          snapshot={buildSnapshot()}
        />
      </AuthViewerProvider>,
    );

    expect(
      screen.getByRole("article", { name: "인증 확인 전 서버 글" }),
    ).toBeInTheDocument();
    expect(observer.observe).not.toHaveBeenCalled();

    view.rerender(
      <AuthViewerProvider ready viewer={null}>
        <HomeFeed
          communityStore={store}
          initialCommunityFeed={initialCommunityFeed}
          snapshot={buildSnapshot()}
        />
      </AuthViewerProvider>,
    );

    await waitFor(() => expect(observer.observe).toHaveBeenCalledTimes(1));
  });

  it("uses the shell write action without repeating a central write button", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

    expect(
      screen.getByRole("heading", { name: "추천 피드" }),
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
      fit: null,
      ownedSkills: [],
    });

    render(<HomeFeed snapshot={snapshot} />);

    expect(
      screen.getByRole("heading", { name: "내 커리어 브리핑" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "둘러보기" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const briefing = screen.getByRole("region", { name: "내 커리어 브리핑" });
    expect(within(briefing).queryByText("내 기술 0개")).not.toBeInTheDocument();
    expect(within(briefing).getAllByRole("link", { name: "내 기술 등록" }))
      .toHaveLength(1);
    expect(
      within(briefing).getByText(
        "내 기술을 등록하면 부족 기술과 준비도 높은 공고를 바로 찾을 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "내 기술 추가" }),
    ).not.toBeInTheDocument();
    const job = screen.getByRole("article", { name: "Backend Engineer" });
    expect(within(job).getByText("Java")).toBeInTheDocument();
    expect(within(job).getByText("Spring")).toBeInTheDocument();
  });

  it("keeps a compact recovery action when personalized analysis is unavailable", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      fit: { status: "error", message: "fit offline" },
      ownedSkills: ["Java"],
    });

    render(<HomeFeed snapshot={snapshot} />);

    const briefing = screen.getByRole("region", { name: "내 커리어 브리핑" });
    expect(within(briefing).getByText("내 기술 분석을 불러오지 못했습니다."))
      .toBeInTheDocument();
    expect(within(briefing).getByText("잠시 후 다시 확인해 주세요."))
      .toBeInTheDocument();
    expect(within(briefing).queryByText("현재 수요 상위"))
      .not.toBeInTheDocument();
    expect(within(briefing).getByRole("link", {
      name: "내 커리어 기준 수정",
    })).toHaveAttribute("href", "/career");
  });

  it("states clearly when no public posting matches the saved skills", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      fit: ready({
        coverage: {
          matching_posting_count: 0,
          strong_fit_posting_count: 0,
        },
        domain_branches: [],
        recommended_next_skills: [],
      }),
      ownedSkills: ["Rust"],
    });

    render(<HomeFeed snapshot={snapshot} />);

    const briefing = screen.getByRole("region", { name: "내 커리어 브리핑" });
    expect(within(briefing).getByText(
      "현재 공개 공고에서 일치 항목을 찾지 못했습니다.",
    )).toBeInTheDocument();
    expect(within(briefing).getByText(
      "내 기술을 더 추가하거나 커리어 기준을 조정해 보세요.",
    )).toBeInTheDocument();
    expect(within(briefing).getAllByText("0건")).toHaveLength(2);
  });

  it("renders consecutive jobs as one recommendation group", () => {
    const groupedPostings: PostingListResponse = {
      total: 3,
      items: Array.from({ length: 3 }, (_, index) => ({
        ...postings.items[0],
        id: `job-${index + 1}`,
        title: `Backend Engineer ${index + 1}`,
      })),
    };
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(groupedPostings),
      skillStats: ready({ total: 0, items: [] }),
      fit: null,
      ownedSkills: [],
    });

    render(<HomeFeed snapshot={snapshot} />);

    const group = screen.getByRole("region", { name: "추천 공고 3개" });
    expect(within(group).getAllByRole("article")).toHaveLength(3);
  });

  it("does not promote old browser-only follows into real activity", () => {
    localStorage.setItem(
      "ejik-fit:social-interactions",
      JSON.stringify({
        reactedPostIds: [],
        savedPostIds: [],
        followedAuthorIds: ["server-garden"],
        commentsByPostId: {},
      }),
    );
    render(<HomeFeed snapshot={buildSnapshot()} />);
    expect(
      screen.queryByRole("region", { name: "팔로우 중인 글" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "팔로잉" }));

    expect(
      screen.getByText("팔로우한 작성자의 글이 없습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("다른 글에서 관심 있는 작성자를 팔로우해 주세요."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "추천 탭에서 작성자 찾기" }),
    );
    expect(screen.getByRole("tab", { name: "추천" })).toHaveFocus();
  });

  it("loads followed authors from the complete server feed beyond the public first page", async () => {
    const publicPost: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "22222222-2222-4222-8222-222222222222",
        nickname: "첫페이지작성자",
      },
      category: "커리어 질문",
      title: "공개 첫 페이지 글",
      body: "최신 공개 피드에 있는 글입니다.",
      tags: [],
      metrics: { reactions: 0, comments: 0, saves: 0 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };
    const followedPost: CommunityPost = {
      ...publicPost,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      author: {
        id: "33333333-3333-4333-8333-333333333333",
        nickname: "팔로우작성자",
      },
      title: "첫 페이지 밖의 팔로잉 글",
      createdAt: "2026-06-01T04:00:00.000Z",
      updatedAt: "2026-06-01T04:00:00.000Z",
    };
    const store = serverCommunityStore(publicPost);
    store.listFollowingPostPage.mockResolvedValue({
      items: [followedPost],
      nextCursor: null,
    });
    store.loadViewerState.mockImplementation(async (_viewerId, targets) => ({
      reactedPostIds: [],
      savedPostIds: [],
      followedAuthorIds: targets.authorIds.includes(followedPost.author.id)
        ? [followedPost.author.id]
        : [],
    }));

    render(
      <AuthViewerProvider
        ready
        viewer={{
          id: "11111111-1111-4111-8111-111111111111",
          email: "reader@example.com",
        }}
      >
        <HomeFeed communityStore={store} snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );
    expect(
      await screen.findByRole("article", { name: publicPost.title }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "팔로잉" }));

    expect(
      await screen.findByRole("article", { name: followedPost.title }),
    ).toBeInTheDocument();
    expect(store.listFollowingPostPage).toHaveBeenCalledWith({ limit: 10 });
    expect(
      screen.queryByRole("article", { name: publicPost.title }),
    ).not.toBeInTheDocument();
  });

  it("does not reuse the public cursor after a completed following feed loads", async () => {
    const observer = installIntersectionObserver();
    const publicPost: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "22222222-2222-4222-8222-222222222222",
        nickname: "공개작성자",
      },
      category: "일반",
      title: "다음 페이지가 있는 공개 글",
      body: "공개 피드에는 다음 페이지가 있습니다.",
      tags: [],
      metrics: { reactions: 0, comments: 0, saves: 0 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };
    const followedPost: CommunityPost = {
      ...publicPost,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      author: {
        id: "33333333-3333-4333-8333-333333333333",
        nickname: "팔로우작성자",
      },
      title: "마지막 팔로잉 글",
    };
    const store = serverCommunityStore(publicPost);
    store.listPostPage.mockResolvedValue({
      items: [publicPost],
      nextCursor: { createdAt: publicPost.createdAt, id: publicPost.id },
    });
    store.listFollowingPostPage.mockResolvedValue({
      items: [followedPost],
      nextCursor: null,
    });
    store.loadViewerState.mockImplementation(async (_viewerId, targets) => ({
      reactedPostIds: [],
      savedPostIds: [],
      followedAuthorIds: targets.authorIds.includes(followedPost.author.id)
        ? [followedPost.author.id]
        : [],
    }));

    render(
      <AuthViewerProvider
        ready
        viewer={{
          id: "11111111-1111-4111-8111-111111111111",
          email: "reader@example.com",
        }}
      >
        <HomeFeed communityStore={store} snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );

    expect(
      await screen.findByRole("article", { name: publicPost.title }),
    ).toBeInTheDocument();
    await waitFor(() => expect(observer.observe).toHaveBeenCalled());
    const publicObserverCount = observer.observe.mock.calls.length;

    fireEvent.click(screen.getByRole("tab", { name: "팔로잉" }));

    expect(
      await screen.findByRole("article", { name: followedPost.title }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(store.listFollowingPostPage).toHaveBeenCalledTimes(1),
    );
    expect(observer.observe).toHaveBeenCalledTimes(publicObserverCount);
    expect(
      screen.queryByText("피드를 더 불러오지 못했습니다."),
    ).not.toBeInTheDocument();
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
      screen.queryByText("실제작성자 팔로우를 시작했습니다."),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "팔로우 중인 글" })).getByRole(
        "link",
        { name: `실제작성자의 글: ${post.title}` },
      ),
    ).toHaveAttribute("href", `/posts/${post.id}`);
  });

  it.each(["reaction", "save"] as const)(
    "clears a failed %s message after a successful retry",
    async (action) => {
      const post: CommunityPost = {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        author: {
          id: "22222222-2222-4222-8222-222222222222",
          nickname: "실제작성자",
        },
        category: "커리어 질문",
        title: "다시 시도할 커뮤니티 질문",
        body: "첫 시도가 실패해도 같은 글에서 다시 시도합니다.",
        tags: ["백엔드"],
        metrics: { reactions: 4, comments: 2, saves: 1 },
        createdAt: "2026-07-21T04:00:00.000Z",
        updatedAt: "2026-07-21T04:00:00.000Z",
      };
      const store = serverCommunityStore(post);
      if (action === "reaction") {
        store.setPostReaction.mockRejectedValueOnce(
          new Error("reaction offline"),
        );
      } else {
        store.setPostSaved.mockRejectedValueOnce(new Error("save offline"));
      }

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

      const article = await screen.findByRole("article", { name: post.title });
      const control =
        action === "reaction"
          ? within(article).getByRole("button", { name: /공감 취소/ })
          : within(article).getByRole("button", {
              name: `${post.title} 저장`,
            });
      fireEvent.click(control);
      expect(
        await screen.findByText(
          "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      ).toBeInTheDocument();

      fireEvent.click(control);
      await waitFor(() =>
        expect(control).toHaveAttribute(
          "aria-pressed",
          action === "reaction" ? "false" : "true",
        ),
      );
      expect(
        screen.queryByText(
          "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    {
      action: "reaction" as const,
      code: "permission" as const,
      message: "이 작업을 처리할 권한이 없습니다.",
    },
    {
      action: "save" as const,
      code: "conflict" as const,
      message: "이미 처리된 커뮤니티 활동입니다.",
    },
  ])(
    "shows the safe $code guidance on a first-page $action failure",
    async ({ action, code, message }) => {
      const post: CommunityPost = {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        author: {
          id: "22222222-2222-4222-8222-222222222222",
          nickname: "실제작성자",
        },
        category: "커리어 질문",
        title: "오류 안내를 확인할 커뮤니티 질문",
        body: "다음 페이지가 없어도 안전한 오류 안내를 표시합니다.",
        tags: ["백엔드"],
        metrics: { reactions: 4, comments: 2, saves: 1 },
        createdAt: "2026-07-21T04:00:00.000Z",
        updatedAt: "2026-07-21T04:00:00.000Z",
      };
      const store = serverCommunityStore(post);
      const failure = new CommunityStoreError(code, message);
      if (action === "reaction") {
        store.setPostReaction.mockRejectedValueOnce(failure);
      } else {
        store.setPostSaved.mockRejectedValueOnce(failure);
      }

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

      const article = await screen.findByRole("article", { name: post.title });
      fireEvent.click(
        action === "reaction"
          ? within(article).getByRole("button", { name: /공감 취소/ })
          : within(article).getByRole("button", { name: `${post.title} 저장` }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(
        screen.queryByText(
          "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      ).not.toBeInTheDocument();
    },
  );

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

    expect(screen.queryByText("계정에 저장되는 글")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "일반" })).toBeChecked();
    expect(
      screen
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["일반", "커리어 질문", "커리어 고민", "면접 후기"]);
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
          category: "일반",
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

  it("keeps a signed-in draft after publishing fails without exposing the provider error", async () => {
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
    store.createPost.mockRejectedValueOnce(
      new Error("provider raw insert failure"),
    );
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

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "실패해도 남을 제목" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "실패해도 남을 본문" },
    });
    const publish = screen.getByRole("button", { name: "피드에 올리기" });
    await waitFor(() => expect(publish).toBeEnabled());
    fireEvent.click(publish);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "글을 게시하지 못했습니다. 작성 내용은 그대로 두었습니다.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "provider raw insert failure",
    );
    expect(screen.getByLabelText("제목")).toHaveValue("실패해도 남을 제목");
    expect(screen.getByLabelText("내용")).toHaveValue("실패해도 남을 본문");
  });

  it("uses a Unicode ellipsis while a post is being published", async () => {
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
    const pending = deferred<CommunityPost>();
    const store = serverCommunityStore(existing);
    store.createPost.mockImplementationOnce(() => pending.promise);
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
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "게시를 기다리는 글" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "게시를 기다리는 본문" },
    });
    const publish = screen.getByRole("button", { name: "피드에 올리기" });
    await waitFor(() => expect(publish).toBeEnabled());
    fireEvent.click(publish);

    expect(screen.getByRole("button", { name: "게시 중…" })).toBeDisabled();
    expect(screen.queryByText(/게시 중\.\.\./)).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve({
        ...existing,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        title: "게시를 기다리는 글",
        body: "게시를 기다리는 본문",
      });
      await pending.promise;
    });
  });

  it("explains invalid tags instead of silently dropping extras", async () => {
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
          composeMode="new"
          snapshot={buildSnapshot()}
        />
      </AuthViewerProvider>,
    );
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "태그 검증 글" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "태그가 사라지지 않아야 합니다." },
    });
    fireEvent.change(screen.getByLabelText("태그 (선택)"), {
      target: { value: "하나, 둘, 셋, 넷, 다섯" },
    });
    const publish = screen.getByRole("button", { name: "피드에 올리기" });
    await waitFor(() => expect(publish).toBeEnabled());
    fireEvent.click(publish);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "태그는 중복을 제외하고 최대 4개",
    );
    expect(store.createPost).not.toHaveBeenCalled();
    expect(screen.getByLabelText("태그 (선택)")).toHaveValue(
      "하나, 둘, 셋, 넷, 다섯",
    );
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
        screen.getByRole("button", { name: "Backend Engineer 저장 해제" }),
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

  it("sends a guest community action to a safe same-origin login return path", async () => {
    const guestPost: CommunityPost = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      author: {
        id: "22222222-2222-4222-8222-222222222222",
        nickname: "실제작성자",
      },
      category: "커리어 질문",
      title: "로그인이 필요한 실제 글",
      body: "공개로 읽되 반응은 계정에 저장합니다.",
      tags: ["백엔드"],
      metrics: { reactions: 0, comments: 0, saves: 0 },
      createdAt: "2026-07-21T04:00:00.000Z",
      updatedAt: "2026-07-21T04:00:00.000Z",
    };

    render(
      <AuthViewerProvider ready viewer={null}>
        <HomeFeed
          communityStore={serverCommunityStore(guestPost)}
          snapshot={buildSnapshot()}
        />
      </AuthViewerProvider>,
    );

    const article = await screen.findByRole("article", {
      name: guestPost.title,
    });
    fireEvent.click(within(article).getByRole("button", { name: /공감$/ }));

    expect(navigation.push).toHaveBeenCalledWith("/login?next=%2F");
  });

  it("keeps the draft in place when the login state cannot be verified", () => {
    render(
      <AuthViewerProvider
        error="로그인 상태를 확인하지 못했습니다."
        ready
        status="error"
        viewer={null}
      >
        <HomeFeed composeMode="new" snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "확인 뒤 게시할 글" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "인증 장애를 비로그인으로 오인하면 안 됩니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "피드에 올리기" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "로그인 상태를 확인하지 못했습니다.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "로그인한 뒤 다시 시도해 주세요.",
    );
    expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("제목")).toHaveValue("확인 뒤 게시할 글");
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

  it("removes a restored session draft when the user cancels the composer", () => {
    saveCommunityDraft(
      {
        category: "커리어 고민",
        title: "취소할 임시 글",
        body: "명시적으로 취소하면 현재 탭에서도 제거되어야 합니다.",
        tags: ["임시 글"],
      },
      sessionStorage,
    );
    render(
      <AuthViewerProvider ready viewer={null}>
        <HomeFeed composeMode="resume" snapshot={buildSnapshot()} />
      </AuthViewerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(sessionStorage.getItem(COMMUNITY_DRAFT_STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "커뮤니티 글쓰기" }),
    ).not.toBeInTheDocument();
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
      "글을 게시하지 못했습니다. 작성 내용은 그대로 두었습니다.",
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

    expect(screen.getByText("일부 정보를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByText("graph offline")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 불러오기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Backend Engineer" }),
    ).toBeInTheDocument();
  });
});
