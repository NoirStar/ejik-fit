import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CorrectionsPage from "./corrections/page";
import DataPolicyPage from "./data-policy/page";
import MethodologyPage from "./methodology/page";
import PrivacyPage from "./privacy/page";

describe("public trust pages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("publishes unique policy and methodology pages", () => {
    const { unmount } = render(<DataPolicyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "데이터 수집 정책" })).toBeInTheDocument();
    expect(screen.getByText(/3회 연속/)).toBeInTheDocument();
    expect(screen.getAllByText(/CAPTCHA/)).toHaveLength(2);
    unmount();

    render(<MethodologyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "분석 방법" })).toBeInTheDocument();
    expect(screen.getByText(/채용 가능성을 예측하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/0.80/)).toBeInTheDocument();
  });

  it("explains browser storage and provides a clear-data action", () => {
    localStorage.setItem("ejik-fit:owned-skills", '["Java"]');
    localStorage.setItem("ejik-fit:saved-job-ids", '["job-1"]');
    localStorage.setItem(
      "ejik-fit:job-application-stages",
      '{"job-1":"interview"}',
    );
    localStorage.setItem(
      "ejik-fit:social-interactions",
      '{"savedPostIds":["post-1"],"followedAuthorIds":["server-garden"]}',
    );
    window.history.replaceState({}, "", "/privacy?owned_skills=Java");
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "개인정보와 브라우저 저장" })).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:owned-skills/)).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:saved-job-ids/)).toBeInTheDocument();
    expect(
      screen.getByText(/ejik-fit:job-application-stages/),
    ).toBeInTheDocument();
    expect(screen.getByText(/ejik-fit:social-interactions/)).toBeInTheDocument();
    expect(screen.getByText(/작성자 팔로우/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "URL query" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이 브라우저의 저장 데이터 삭제" }));
    expect(localStorage.getItem("ejik-fit:owned-skills")).toBeNull();
    expect(localStorage.getItem("ejik-fit:saved-job-ids")).toBeNull();
    expect(
      localStorage.getItem("ejik-fit:job-application-stages"),
    ).toBeNull();
    expect(localStorage.getItem("ejik-fit:social-interactions")).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("does not claim deletion when browser storage rejects removal", () => {
    localStorage.setItem("ejik-fit:saved-job-ids", '["job-1"]');
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    render(<PrivacyPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "이 브라우저의 저장 데이터 삭제",
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "일부 저장 데이터를 삭제하지 못했습니다.",
    );
    expect(screen.queryByText("저장 데이터를 삭제했습니다.")).not.toBeInTheDocument();
    removeItem.mockRestore();
  });

  it("routes corrections to the public issue tracker", () => {
    render(<CorrectionsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "정보 정정 요청" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub Issues에서 요청하기" })).toHaveAttribute(
      "href",
      "https://github.com/NoirStar/ejik-fit/issues",
    );
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
