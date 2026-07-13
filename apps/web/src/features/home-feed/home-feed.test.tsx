import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

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
  afterEach(() => cleanup());

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
  });

  it("keeps only followed community content on the following tab", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

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

  it("validates the composer and adds a browser-only post first", () => {
    render(<HomeFeed snapshot={buildSnapshot()} />);

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
    expect(screen.getByText("작성한 글을 피드 맨 위에 추가했습니다.")).toBeInTheDocument();
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
