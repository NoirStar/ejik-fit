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

  it("adds, validates, removes and clears browser-owned skills", async () => {
    render(
      <CareerOverview
        suggestions={suggestions}
        suggestionsUnavailable={false}
      />,
    );
    await screen.findByText("먼저 보유 기술을 저장해 주세요.");

    fireEvent.change(screen.getByLabelText("추가할 기술"), {
      target: { value: " Python " },
    });
    fireEvent.click(screen.getByRole("button", { name: "기술 추가" }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("ejik-fit:owned-skills")!)).toEqual([
        "Python",
      ]);
    });
    expect(screen.getByText("Python")).toBeInTheDocument();

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
    await screen.findByText("Kubernetes");
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
    const backendBranch = screen.getByRole("heading", {
      level: 3,
      name: "백엔드",
    }).closest("article")!;
    expect(within(backendBranch).getByText("보유 기술").parentElement).toHaveTextContent(
      "Python",
    );
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
