import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { writeOwnedSkills } from "@/lib/owned-skills";
import type { FitAnalyzeResponse } from "@/lib/types";

import { CareerOverview } from "./career-overview";

const fitResponse: FitAnalyzeResponse = {
  coverage: {
    matching_posting_count: 17,
    strong_fit_posting_count: 6,
  },
  recommended_next_skills: [
    {
      skill: "Kubernetes",
      reason: "server-generated reason",
      required_count: 8,
      preferred_count: 3,
      supporting_posting_count: 10,
    },
  ],
  domain_branches: [
    {
      domain: "backend",
      covered_skills: ["Python"],
      missing_required_skills: ["Kubernetes"],
      missing_preferred_skills: ["Kafka"],
      supporting_posting_count: 9,
    },
  ],
};

const suggestions = [
  { name: "Kubernetes", postingCount: 12 },
  { name: "Python", postingCount: 10 },
];

function jsonResponse(
  body: FitAnalyzeResponse | { error: string },
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("CareerOverview", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => jsonResponse(fitResponse));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts with an honest empty state and API-backed quick suggestions", async () => {
    render(
      <CareerOverview
        suggestions={suggestions}
        suggestionsUnavailable={false}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "내 커리어" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "저장 보관함" })).toHaveAttribute(
      "href",
      "/career/saved",
    );
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "먼저 보유 기술을 저장해 주세요.",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Kubernetes 빠르게 추가, 공개 공고 12건" }),
    ).toBeInTheDocument();
    expect(screen.getByText("실제 공고 수 기준")).toBeInTheDocument();
  });

  it("distinguishes an empty suggestion response from saving every suggestion", async () => {
    render(
      <CareerOverview suggestions={[]} suggestionsUnavailable={false} />,
    );

    await screen.findByText("먼저 보유 기술을 저장해 주세요.");
    expect(screen.getByText("현재 확인된 상위 기술 제안이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("현재 제안 기술을 모두 저장했습니다.")).not.toBeInTheDocument();
  });

  it("adds, validates, removes and clears browser-owned skills", async () => {
    render(
      <CareerOverview
        suggestions={suggestions}
        suggestionsUnavailable={false}
      />,
    );
    await screen.findByText("먼저 보유 기술을 저장해 주세요.");

    fireEvent.change(screen.getByLabelText("추가할 기술"), {
      target: { value: " python " },
    });
    fireEvent.click(screen.getByRole("button", { name: "기술 추가" }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("ejik-fit:owned-skills")!)).toEqual([
        "Python",
      ]);
    });
    expect(
      within(
        screen.getByRole("list", { name: "저장한 기술 목록" }),
      ).getByText("Python"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("추가할 기술"), {
      target: { value: "python" },
    });
    fireEvent.click(screen.getByRole("button", { name: "기술 추가" }));
    expect(screen.getByRole("alert")).toHaveTextContent("이미 저장한 기술입니다.");

    fireEvent.click(screen.getByRole("button", { name: "Python 제거" }));
    expect(
      await screen.findByText("먼저 보유 기술을 저장해 주세요."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Kubernetes 빠르게 추가, 공개 공고 12건",
      }),
    );
    expect(
      within(
        screen.getByRole("list", { name: "저장한 기술 목록" }),
      ).getByText("Kubernetes"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "전체 삭제" }));
    expect(window.localStorage.getItem("ejik-fit:owned-skills")).toBeNull();
  });

  it("reacts to same-tab stack changes and requests an updated comparison", async () => {
    render(
      <CareerOverview
        suggestions={suggestions}
        suggestionsUnavailable={false}
      />,
    );
    await screen.findByText("먼저 보유 기술을 저장해 주세요.");

    act(() => {
      writeOwnedSkills(["React"]);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      owned_skills: ["React"],
    });
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("sends the selected career condition and renders direct API evidence", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    render(
      <CareerOverview
        suggestions={suggestions}
        suggestionsUnavailable={false}
      />,
    );

    expect(
      await screen.findByRole("heading", { level: 2, name: "공고 비교 결과" }),
    ).toBeInTheDocument();
    expect(screen.getByText("겹치는 공개 공고").closest("div")).toHaveTextContent(
      "17건",
    );
    expect(screen.getByText("필수 기술 절반 이상").closest("div")).toHaveTextContent(
      "6건",
    );
    expect(
      screen.getByRole("link", { name: "Kubernetes 스킬맵 보기" }),
    ).toHaveAttribute("href", "/skill-map?skill=Kubernetes");
    expect(
      screen.getByRole("link", { name: "Kubernetes 관련 공고 보기" }),
    ).toHaveAttribute("href", "/jobs?q=Kubernetes");
    expect(
      screen.getByRole("heading", { level: 3, name: "다음 준비 기술" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "분야별 근거" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText("겹치는 공개 공고")
        .closest("div")
        ?.querySelectorAll(":scope > dd"),
    ).toHaveLength(2);
    const backendBranch = screen.getByRole("heading", {
      level: 4,
      name: "백엔드",
    }).closest("article")!;
    expect(
      within(backendBranch).getByText("보유 기술").parentElement,
    ).toHaveTextContent("Python");
    expect(
      within(backendBranch).getByText("부족 필수").parentElement,
    ).toHaveTextContent("Kubernetes");
    expect(screen.queryByText(/합격 가능성|적합도 점수/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "경력 조건" }), {
      target: { value: "experienced" },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      owned_skills: ["Python"],
      career_type: "experienced",
    });
  });

  it("sends an API-backed target domain and repeats the scope in results", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    render(
      <CareerOverview
        domainSuggestions={[
          { value: "robotics", label: "로보틱스", skillCount: 4 },
        ]}
        domainSuggestionsUnavailable={false}
        suggestions={suggestions}
        suggestionsUnavailable={false}
      />,
    );

    await screen.findByRole("heading", { level: 2, name: "공고 비교 결과" });
    fireEvent.change(screen.getByLabelText("희망 기술 분야"), {
      target: { value: "robotics" },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      owned_skills: ["Python"],
      domains: ["robotics"],
    });
    expect(screen.getByText("로보틱스 조건")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "로보틱스 · 연결 기술 4개" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/스킬 그래프가 제공하는 분야 메타데이터/),
    ).toBeInTheDocument();
  });

  it("clears a selected domain when refreshed graph choices no longer contain it", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    const { rerender } = render(
      <CareerOverview
        domainSuggestions={[
          { value: "robotics", label: "로보틱스", skillCount: 4 },
        ]}
        domainSuggestionsUnavailable={false}
        suggestions={suggestions}
        suggestionsUnavailable={false}
      />,
    );

    await screen.findByRole("heading", { level: 2, name: "공고 비교 결과" });
    fireEvent.change(screen.getByLabelText("희망 기술 분야"), {
      target: { value: "robotics" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    rerender(
      <CareerOverview
        domainSuggestions={[]}
        domainSuggestionsUnavailable
        suggestions={suggestions}
        suggestionsUnavailable={false}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByLabelText("희망 기술 분야")).toHaveValue("");
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      owned_skills: ["Python"],
    });
    expect(
      screen.getByText("분야 목록을 불러오지 못해 전체 기술 분야로 비교합니다."),
    ).toBeInTheDocument();
  });

  it("does not replace a newer result when an aborted response finishes late", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    let resolveFirstPayload: (value: FitAnalyzeResponse) => void = () => undefined;
    const firstPayload = new Promise<FitAnalyzeResponse>((resolve) => {
      resolveFirstPayload = resolve;
    });
    const newerResponse: FitAnalyzeResponse = {
      ...fitResponse,
      coverage: {
        matching_posting_count: 3,
        strong_fit_posting_count: 1,
      },
    };
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => firstPayload,
      } as Response)
      .mockResolvedValueOnce(jsonResponse(newerResponse));

    render(
      <CareerOverview suggestions={[]} suggestionsUnavailable={false} />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByRole("combobox", { name: "경력 조건" }), {
      target: { value: "experienced" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText("겹치는 공개 공고").closest("div")).toHaveTextContent(
        "3건",
      ),
    );

    await act(async () => {
      resolveFirstPayload(fitResponse);
      await firstPayload;
    });

    expect(screen.getByText("겹치는 공개 공고").closest("div")).toHaveTextContent(
      "3건",
    );
  });

  it("shows a safe retry state without leaking the proxy error", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "API request failed: http://internal-api/api/fit/analyze (503)" },
          503,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(fitResponse));

    render(
      <CareerOverview suggestions={[]} suggestionsUnavailable={true} />,
    );

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "공고 비교를 불러오지 못했습니다.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/internal-api|503/)).not.toBeInTheDocument();
    expect(screen.getByText("상위 기술 제안을 불러오지 못했습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "공고 비교 결과" }),
    ).toBeInTheDocument();
  });

  it("rejects malformed successful responses instead of showing invalid counts", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...fitResponse,
        coverage: {
          matching_posting_count: -1,
          strong_fit_posting_count: 0,
        },
      }),
    );

    render(
      <CareerOverview suggestions={[]} suggestionsUnavailable={false} />,
    );

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "공고 비교를 불러오지 못했습니다.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("-1건")).not.toBeInTheDocument();
  });

  it("distinguishes zero overlap from request failure", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    fetchMock.mockResolvedValue(
      jsonResponse({
        coverage: {
          matching_posting_count: 0,
          strong_fit_posting_count: 0,
        },
        recommended_next_skills: [],
        domain_branches: [],
      }),
    );

    render(
      <CareerOverview suggestions={[]} suggestionsUnavailable={false} />,
    );

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "현재 조건에서 겹치는 공고가 없습니다.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "전체 공고 보기" })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });
});
