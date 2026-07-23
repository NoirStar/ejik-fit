import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthViewerProvider } from "@/features/auth/auth-viewer-context";
import type { AccountSyncStatus } from "@/features/auth/use-account-state-sync";

import { FollowedCompanies } from "./followed-companies";

describe("FollowedCompanies", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it.each<{
    expected: string;
    status: AccountSyncStatus;
    viewer: { id: string; email: string } | null;
  }>([
    { expected: "이 기기에 저장됨", status: "local", viewer: null },
    {
      expected: "계정에 저장 중…",
      status: "syncing",
      viewer: { id: "viewer-1", email: "viewer@example.com" },
    },
    {
      expected: "계정에 저장됨",
      status: "synced",
      viewer: { id: "viewer-1", email: "viewer@example.com" },
    },
    {
      expected: "이 기기에 저장됨",
      status: "error",
      viewer: { id: "viewer-1", email: "viewer@example.com" },
    },
  ])("shows truthful $status company storage", ({ expected, status, viewer }) => {
    render(
      <AuthViewerProvider
        accountSyncStatus={status}
        ready
        viewer={viewer}
      >
        <FollowedCompanies directory={null} directoryUnavailable />
      </AuthViewerProvider>,
    );

    const panel = screen
      .getByRole("heading", { level: 2, name: "저장한 기업" })
      .closest("section");
    expect(panel).not.toBeNull();
    expect(within(panel!).getByText(expected)).toBeInTheDocument();
    if (status === "error") {
      expect(
        within(panel!).getByText("계정에 저장하지 못했습니다."),
      ).toBeInTheDocument();
    } else {
      expect(
        within(panel!).queryByText("계정에 저장하지 못했습니다."),
      ).not.toBeInTheDocument();
    }
  });
});
