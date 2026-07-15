import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ActivityNotificationCenter } from "./activity-notification-center";

describe("ActivityNotificationCenter", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

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

    render(<ActivityNotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText("지원 기록 1건")).toBeInTheDocument();
    });
    expect(screen.getByText("면접 진행 1건")).toBeInTheDocument();
    expect(screen.getByText("저장한 공고 2건")).toBeInTheDocument();
    expect(screen.getByText("내 기술 2개")).toBeInTheDocument();
    expect(screen.getByText("지원 기록 1건").closest("a")).toHaveAttribute(
      "href",
      "/career/saved",
    );
    expect(screen.getByText("내 기술 2개").closest("a")).toHaveAttribute(
      "href",
      "/market",
    );
  });
});
