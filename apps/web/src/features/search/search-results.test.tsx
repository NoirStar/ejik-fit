import {
  act,
  cleanup,
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

import type { SearchSnapshot } from "./model";
import { SearchResults } from "./search-results";

const EMPTY_SEARCH_COPY =
  "검색 결과가 없습니다. 검색어를 줄이거나 기술·기업 이름으로 검색해 주세요.";
const GUIDE_DISCLOSURE = "활용 가이드는 실제 사용자 글이 아닙니다.";
const START_DISCLOSURE =
  "기업·공고·기술은 공개 채용 데이터에서, 커뮤니티는 공개 계정 글과 이 브라우저의 이전 저장 글, 활용 가이드에서 찾습니다.";
const COMMUNITY_DISCLOSURE =
  "커뮤니티 결과는 공개 계정 글에서 찾습니다. 이전 저장 글은 이 브라우저에서만 복구할 수 있고, 계정 글과 구분해 표시합니다.";
const COMMUNITY_MERGE_COPY =
  "공고·기업·기술 검색 결과는 유지한 채 공개 커뮤니티 결과를 합치는 중입니다.";
const COMMUNITY_EMPTY_COPY =
  "공개 계정 글에서 일치하는 결과가 없습니다.";
const IMPLEMENTATION_JARGON = /API|서버|응답/;

const serverSearchPost: CommunityPost = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  author: {
    id: "22222222-2222-4222-8222-222222222222",
    nickname: "파이썬정원",
  },
  category: "커리어 질문",
  title: "실제 Python 커뮤니티 검색 질문",
  body: "Python 백엔드 이직을 준비하며 계정에 작성한 공개 글입니다.",
  tags: ["Python", "백엔드"],
  metrics: { reactions: 2, comments: 1, saves: 0 },
  createdAt: "2026-07-21T05:00:00.000Z",
  updatedAt: "2026-07-21T05:00:00.000Z",
};

function serverSearchStore() {
  return {
    searchPosts: vi.fn(async () => ({ items: [serverSearchPost], nextCursor: null })),
    listPostPage: vi.fn(async () => ({ items: [serverSearchPost], nextCursor: null })),
    listFollowingPostPage: vi.fn(async () => ({
      items: [serverSearchPost],
      nextCursor: null,
    })),
    listSavedPostPage: vi.fn(async () => ({ items: [], nextCursor: null })),
    listPosts: vi.fn(async () => [serverSearchPost]),
    listSavedPosts: vi.fn(async () => []),
    getPost: vi.fn(async () => serverSearchPost),
    getComment: vi.fn(async () => null),
    listCommentPage: vi.fn(async () => ({ items: [], nextCursor: null })),
    listComments: vi.fn(async () => []),
    loadViewerState: vi.fn(async () => ({
      reactedPostIds: [],
      savedPostIds: [],
      followedAuthorIds: [],
    })),
    createPost: vi.fn(async () => serverSearchPost),
    updatePost: vi.fn(async () => serverSearchPost),
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

function snapshot(
  overrides: Partial<SearchSnapshot> = {},
): SearchSnapshot {
  return {
    query: "Python",
    scope: "all",
    dataStatus: "ready",
    companies: [
      {
        slug: "naver",
        name: "NAVER",
        href: "/companies/naver",
        postingCount: 2,
        latestVerifiedAt: "2026-07-14T03:00:00.000Z",
        skillNames: ["Python", "Docker"],
        sourceUrl: "https://recruit.navercorp.com/job-python",
      },
    ],
    jobs: [
      {
        id: "job-python",
        title: "Python Backend Engineer",
        companyName: "NAVER",
        companyHref: "/companies/naver",
        href: "/jobs/job-python",
        sourceUrl: "https://recruit.navercorp.com/job-python",
        careerType: "experienced",
        employmentType: "FULL_TIME_WORKER",
        location: "서울",
        lastVerifiedAt: "2026-07-14T03:00:00.000Z",
        requiredSkills: ["Python"],
        preferredSkills: ["Docker"],
        unspecifiedSkills: [],
      },
    ],
    skills: [
      {
        name: "Python",
        category: "language",
        postingCount: 18,
        requiredCount: 12,
        preferredCount: 4,
        unspecifiedCount: 2,
        skillHref: "/skill-map?skill=Python",
        jobsHref: "/jobs?q=Python",
      },
    ],
    community: [
      {
        id: "python-career",
        category: "커리어 질문",
        title: "Python에서 Go로 옮긴 경험이 궁금해요",
        summary: "언어 전환을 준비하는 질문입니다.",
        tags: ["Python", "커리어 전환"],
        href: "/posts/python-career",
        authorName: "코드산책",
        authorHeadline: "백엔드 개발자 · 4년차",
        createdLabel: "1시간 전",
        source: "mock",
      },
    ],
    counts: { companies: 1, jobs: 1, skills: 1, community: 1 },
    errors: [],
    hasAnyResults: true,
    ...overrides,
  };
}

function saveLocalSearchPost({
  body = "Python 공고를 비교한 뒤 남긴 질문입니다.",
  id = "local-python-search",
  tags = ["Python", "이직 준비"],
  title = "Python 공고를 보고 남긴 내 질문",
}: {
  body?: string;
  id?: string;
  tags?: string[];
  title?: string;
} = {}) {
  window.localStorage.setItem(
    "ejik-fit:local-community-posts",
    JSON.stringify([
      {
        id,
        title,
        body,
        tags,
        createdAt: "2026-07-14T03:00:00.000Z",
      },
    ]),
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("SearchResults", () => {
  it("renders a useful no-query state without invented result numbers", () => {
    render(
      <SearchResults
        snapshot={
          snapshot({
            query: "",
            dataStatus: "idle",
            companies: [],
            jobs: [],
            skills: [],
            community: [],
            counts: {
              companies: null,
              jobs: null,
              skills: null,
              community: 0,
            },
            hasAnyResults: false,
          })
        }
      />,
    );

    expect(
      screen.getByRole("heading", { name: "무엇을 찾고 있나요?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "검색어" })).toHaveValue("");
    const startState = screen
      .getByText("검색어를 입력해 주세요.")
      .closest("section")!;
    expect(startState).toHaveTextContent(START_DISCLOSURE);
    expect(startState).not.toHaveTextContent(IMPLEMENTATION_JARGON);
    expect(
      screen.getByText("공고와 커뮤니티 글을 나누어 보여줍니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/전체 결과 \d+건/)).not.toBeInTheDocument();
  });

  it("separates official evidence from Ejikfit starting community posts", () => {
    render(<SearchResults snapshot={snapshot()} />);

    expect(
      screen.getByRole("heading", { name: "“Python” 검색 결과" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "검색어" })).toHaveValue(
      "Python",
    );
    expect(screen.getByRole("link", { name: /기업.*1/ })).toHaveAttribute(
      "href",
      "/search?q=Python&scope=companies",
    );

    const company = screen
      .getByRole("link", { name: "NAVER 기업 채용 현황" })
      .closest("article")!;
    expect(within(company).getByText("현재 검색 결과 공고 2건")).toBeInTheDocument();
    expect(within(company).getByRole("link", { name: "Python 스킬맵" })).toHaveAttribute(
      "href",
      "/skill-map?skill=Python",
    );

    const job = screen
      .getByRole("link", { name: "Python Backend Engineer" })
      .closest("article")!;
    expect(within(job).getByText("공식 공고")).toBeInTheDocument();
    const companyPageLink = within(job).getByRole("link", {
      name: "기업 채용페이지 보기",
    });
    expect(companyPageLink).toHaveAttribute(
      "href",
      "https://recruit.navercorp.com/job-python",
    );
    expect(companyPageLink).toHaveAttribute("target", "_blank");
    expect(companyPageLink).toHaveAttribute("rel", "noreferrer");
    const internalDetailLink = within(job).getByRole("link", {
      name: "공고 보기",
    });
    expect(internalDetailLink).toHaveAttribute("href", "/jobs/job-python");
    expect(internalDetailLink).not.toHaveAttribute("target");

    const skill = screen
      .getByRole("link", { name: "Python 스킬맵 보기" })
      .closest("article")!;
    expect(within(skill).getByText("공고 통계 표본")).toBeInTheDocument();
    expect(within(skill).getByText("18건 공고")).toBeInTheDocument();
    const unspecifiedHelp = screen.getByText(
      "미표기: 공고에서 필수 또는 우대로 구분하지 않은 기술",
    );
    expect(unspecifiedHelp).toBeVisible();
    const breakdown = within(skill).getByLabelText(
      "필수 12건, 우대 4건, 필수·우대 미표기 2건",
    );
    expect(breakdown).toHaveTextContent("필수 12 · 우대 4 · 미표기 2");
    expect(breakdown).toHaveAttribute("aria-describedby", unspecifiedHelp.id);
    expect(
      screen.getByText(
        "현재 기술 수요 상위 표본에서 이름이 일치한 기술입니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/API/)).not.toBeInTheDocument();

    const community = screen
      .getByRole("link", { name: "Python에서 Go로 옮긴 경험이 궁금해요" })
      .closest("article")!;
    expect(within(community).queryByText("활용 가이드")).not.toBeInTheDocument();
    const guide = screen.getByRole("region", { name: "커뮤니티 활용 가이드" });
    expect(
      within(guide).getByRole("article", {
        name: "Python에서 Go로 옮긴 경험이 궁금해요",
      }),
    ).toBeInTheDocument();
    expect(within(guide).getByText(GUIDE_DISCLOSURE)).toBeInTheDocument();
    expect(screen.getAllByText(GUIDE_DISCLOSURE)).toHaveLength(1);
    expect(
      within(community).getByRole("link", { name: "Python 커뮤니티 검색" }),
    ).toHaveAttribute("href", "/search?q=Python&scope=community");
    const disclosure = screen.getByText(COMMUNITY_DISCLOSURE);
    expect(disclosure).not.toHaveTextContent(GUIDE_DISCLOSURE);
    expect(disclosure).not.toHaveTextContent(IMPLEMENTATION_JARGON);
  });

  it("uses the full unspecified requirement label on a search job card", () => {
    const jobWithUnspecifiedSkill = {
      ...snapshot().jobs[0],
      requiredSkills: [],
      preferredSkills: [],
      unspecifiedSkills: ["Linux"],
    };

    render(
      <SearchResults
        snapshot={snapshot({ jobs: [jobWithUnspecifiedSkill] })}
      />,
    );

    const job = screen
      .getByRole("link", { name: "Python Backend Engineer" })
      .closest("article")!;
    expect(within(job).getByText("필수·우대 미표기 Linux")).toBeInTheDocument();
    expect(within(job).queryByText("언급 Linux")).not.toBeInTheDocument();
  });

  it("hydrates browser-owned posts ahead of mock results and keeps counts synchronized", async () => {
    saveLocalSearchPost();
    render(<SearchResults snapshot={snapshot()} />);

    const localResult = await screen.findByRole("article", {
      name: "Python 공고를 보고 남긴 내 질문",
    });
    expect(within(localResult).getByText("이전 저장 글")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "이전 기기 저장 글" }))
        .getByRole("article", { name: "Python 공고를 보고 남긴 내 질문" }),
    ).toBeInTheDocument();
    expect(
      within(localResult).getByRole("link", {
        name: "Python 공고를 보고 남긴 내 질문",
      }),
    ).toHaveAttribute("href", "/posts/local-python-search");
    expect(localResult).toHaveTextContent("나");
    expect(localResult).toHaveTextContent("이 브라우저에서 작성");
    expect(screen.getByRole("link", { name: /커뮤니티.*2/ })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Python Backend Engineer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: "Python에서 Go로 옮긴 경험이 궁금해요",
      }),
    ).not.toHaveTextContent("활용 가이드");
    expect(screen.getByText(COMMUNITY_DISCLOSURE)).toBeInTheDocument();

    deleteLocalCommunityPost("local-python-search");

    await waitFor(() => {
      expect(
        screen.queryByRole("article", {
          name: "Python 공고를 보고 남긴 내 질문",
        }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /커뮤니티.*1/ })).toBeInTheDocument();
  });

  it("searches all public account posts in their own result group", async () => {
    const store = serverSearchStore();
    render(
      <AuthViewerProvider
        ready
        viewer={{
          id: "11111111-1111-4111-8111-111111111111",
          email: "viewer@example.com",
        }}
      >
        <SearchResults communityStore={store} snapshot={snapshot()} />
      </AuthViewerProvider>,
    );

    const serverResult = await screen.findByRole("article", {
      name: serverSearchPost.title,
    });
    expect(store.searchPosts).toHaveBeenCalledWith({
      query: "Python",
      limit: 50,
    });
    expect(
      within(screen.getByRole("region", {
        name: "전체 공개 커뮤니티 검색 결과",
      })).getByRole("article", { name: serverSearchPost.title }),
    ).toBeInTheDocument();
    expect(within(serverResult).getByText("커뮤니티")).toBeInTheDocument();
    expect(
      within(serverResult).getByRole("link", { name: serverSearchPost.title }),
    ).toHaveAttribute("href", `/posts/${serverSearchPost.id}`);
    expect(screen.getByRole("link", { name: /커뮤니티.*2/ })).toBeInTheDocument();
    expect(screen.getByText(COMMUNITY_DISCLOSURE)).toBeInTheDocument();
  });

  it("describes an empty public account result without implementation jargon", async () => {
    const store = serverSearchStore();
    store.searchPosts.mockResolvedValue({ items: [], nextCursor: null });

    render(<SearchResults communityStore={store} snapshot={snapshot()} />);

    const emptyState = await screen.findByText(COMMUNITY_EMPTY_COPY);
    expect(emptyState).not.toHaveTextContent(IMPLEMENTATION_JARGON);
  });

  it("uses one direct community-search error while keeping other results", async () => {
    const store = serverSearchStore();
    store.searchPosts.mockRejectedValueOnce(new Error("server unavailable"));

    render(<SearchResults communityStore={store} snapshot={snapshot()} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "커뮤니티 검색 결과를 불러오지 못했습니다.",
    );
    expect(alert).not.toHaveTextContent("server unavailable");
    expect(
      screen.getByRole("link", { name: "Python Backend Engineer" }),
    ).toBeInTheDocument();
  });

  it("does not announce an empty search while recent public community posts are loading", async () => {
    const store = serverSearchStore();
    let resolvePosts:
      | ((page: { items: CommunityPost[]; nextCursor: null }) => void)
      | undefined;
    store.searchPosts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePosts = resolve;
        }),
    );
    render(
      <AuthViewerProvider ready viewer={null}>
        <SearchResults
          communityStore={store}
          snapshot={snapshot({
            companies: [],
            jobs: [],
            skills: [],
            community: [],
            counts: { companies: 0, jobs: 0, skills: 0, community: 0 },
            hasAnyResults: false,
          })}
        />
      </AuthViewerProvider>,
    );

    const loadingHeading = await screen.findByRole("heading", {
      name: "전체 공개 커뮤니티 글까지 검색하고 있습니다.",
    });
    const loadingState = loadingHeading.closest('[role="status"]')!;
    expect(loadingState).toHaveTextContent(COMMUNITY_MERGE_COPY);
    expect(loadingState).not.toHaveTextContent(IMPLEMENTATION_JARGON);
    expect(screen.queryByText(EMPTY_SEARCH_COPY)).not.toBeInTheDocument();

    await act(async () => {
      resolvePosts?.({ items: [serverSearchPost], nextCursor: null });
    });
    expect(
      await screen.findByRole("article", { name: serverSearchPost.title }),
    ).toBeInTheDocument();
  });

  it("replaces the completed empty state when only a local post matches", async () => {
    saveLocalSearchPost({
      body: "현재 브라우저에서만 찾을 수 있습니다.",
      id: "local-browser-search",
      tags: ["로컬 검색"],
      title: "로컬 검색으로 다시 찾는 내 질문",
    });
    render(
      <SearchResults
        snapshot={
          snapshot({
            query: "로컬 검색",
            companies: [],
            jobs: [],
            skills: [],
            community: [],
            counts: { companies: 0, jobs: 0, skills: 0, community: 0 },
            hasAnyResults: false,
          })
        }
      />,
    );

    expect(
      await screen.findByRole("link", {
        name: "로컬 검색으로 다시 찾는 내 질문",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_SEARCH_COPY)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /커뮤니티.*1/ })).toBeInTheDocument();
  });

  it("labels a missing skill requirement breakdown instead of inventing zeroes", () => {
    render(
      <SearchResults
        snapshot={snapshot({
          scope: "skills",
          skills: [
            {
              ...snapshot().skills[0],
              requiredCount: null,
              preferredCount: null,
              unspecifiedCount: null,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("필수·우대 분류 미제공")).toBeInTheDocument();
    expect(screen.queryByText(/필수 0/)).not.toBeInTheDocument();
  });

  it("shows only the selected result scope", () => {
    render(<SearchResults snapshot={snapshot({ scope: "skills" })} />);

    expect(screen.getByRole("heading", { name: "기술" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /기술.*1/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Python 스킬맵 보기" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Python Backend Engineer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "NAVER 기업 채용 현황" }),
    ).not.toBeInTheDocument();
  });

  it("keeps successful evidence visible when one actual API fails", () => {
    render(
      <SearchResults
        snapshot={snapshot({
          dataStatus: "partial",
          companies: [],
          jobs: [],
          counts: { companies: null, jobs: null, skills: 1, community: 1 },
          errors: ["공고 검색 결과를 불러오지 못했습니다."],
        })}
      />,
    );

    expect(
      screen.getByText("일부 실제 검색 결과를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("공고 검색 결과를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Python 스킬맵 보기" })).toBeInTheDocument();
    expect(
      screen.queryByText(EMPTY_SEARCH_COPY),
    ).not.toBeInTheDocument();
  });

  it("distinguishes a completed empty search from unavailable actual data", async () => {
    const store = serverSearchStore();
    store.searchPosts.mockResolvedValue({ items: [], nextCursor: null });
    const { rerender } = render(
      <SearchResults
        communityStore={store}
        snapshot={snapshot({
          companies: [],
          jobs: [],
          skills: [],
          community: [],
          counts: { companies: 0, jobs: 0, skills: 0, community: 0 },
          hasAnyResults: false,
        })}
      />,
    );
    expect(await screen.findByText(EMPTY_SEARCH_COPY)).toBeInTheDocument();

    rerender(
      <SearchResults
        communityStore={store}
        snapshot={snapshot({
          dataStatus: "error",
          companies: [],
          jobs: [],
          skills: [],
          community: [],
          counts: {
            companies: null,
            jobs: null,
            skills: null,
            community: 0,
          },
          errors: ["공고 검색 실패", "기술 검색 실패"],
          hasAnyResults: false,
        })}
      />,
    );
    expect(
      screen.getByText("실제 검색 데이터를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_SEARCH_COPY)).not.toBeInTheDocument();
  });
});
