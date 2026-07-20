import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthViewer } from "@/features/auth/use-auth-viewer";
import { writeOwnedSkills } from "@/lib/owned-skills";

import { AccountOverview } from "./account-overview";

const accountActionMocks = vi.hoisted(() => ({
  createArchive: vi.fn(),
  deleteAccount: vi.fn(),
  downloadArchive: vi.fn(),
  loadPreference: vi.fn(),
  savePreference: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/auth/use-auth-viewer", () => ({
  useAuthViewer: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: accountActionMocks.replace,
    refresh: accountActionMocks.refresh,
  }),
}));

vi.mock("./account-actions", () => ({
  createAccountDataArchive: accountActionMocks.createArchive,
  deleteCurrentAccount: accountActionMocks.deleteAccount,
  downloadAccountDataArchive: accountActionMocks.downloadArchive,
  loadNotificationPreference: accountActionMocks.loadPreference,
  saveNotificationPreference: accountActionMocks.savePreference,
}));

const signOut = vi.fn<() => Promise<boolean>>();

describe("AccountOverview", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    signOut.mockReset();
    signOut.mockResolvedValue(true);
    accountActionMocks.createArchive.mockReset();
    accountActionMocks.createArchive.mockResolvedValue({
      format: "ejikfit-account-export",
      version: 1,
      exportedAt: "2026-07-20T00:00:00.000Z",
    });
    accountActionMocks.deleteAccount.mockReset();
    accountActionMocks.deleteAccount.mockResolvedValue(undefined);
    accountActionMocks.downloadArchive.mockReset();
    accountActionMocks.loadPreference.mockReset();
    accountActionMocks.loadPreference.mockResolvedValue({
      enabled: true,
      supported: true,
    });
    accountActionMocks.savePreference.mockReset();
    accountActionMocks.savePreference.mockResolvedValue(undefined);
    accountActionMocks.replace.mockReset();
    accountActionMocks.refresh.mockReset();
  });

  it("guides a guest to email login without implying cloud sync", () => {
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: null,
      ready: true,
      signingOut: false,
      error: "",
      signOut,
    });

    render(<AccountOverview />);

    expect(screen.getByRole("heading", { name: "계정 및 동기화" })).toBeInTheDocument();
    expect(screen.getByText(/현재 이 브라우저에만 저장/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이메일로 로그인" })).toHaveAttribute(
      "href",
      "/login?next=%2Fcareer%2Faccount",
    );
  });

  it("shows the signed-in account and real browser career counts", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python", "Docker"]),
    );
    window.localStorage.setItem(
      "ejik-fit:saved-job-ids",
      JSON.stringify(["job-1", "job-2"]),
    );
    window.localStorage.setItem(
      "ejik-fit:job-application-stages",
      JSON.stringify({ "job-1": "interview" }),
    );
    window.localStorage.setItem(
      "ejik-fit:followed-company-slugs",
      JSON.stringify(["naver"]),
    );
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      signingOut: false,
      error: "",
      signOut,
    });

    render(<AccountOverview />);

    expect(screen.getByText("dev@example.com")).toBeInTheDocument();
    expect(screen.getByText("내 기술").closest("a")).toHaveTextContent("2개");
    expect(screen.getByText("저장 공고").closest("a")).toHaveTextContent("2건");
    expect(screen.getByText("지원 기록").closest("a")).toHaveTextContent("1건");
    expect(screen.getByText("관심 기업").closest("a")).toHaveTextContent("1곳");
    expect(screen.getByText("공고 알림").closest("a")).toHaveAttribute(
      "href",
      "/career/alerts",
    );
    expect(screen.getByText("공고 알림").closest("a")).toHaveTextContent(
      "계정 저장",
    );

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("refreshes counts when account reconciliation updates browser state", async () => {
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      signingOut: false,
      error: "",
      signOut,
    });

    render(<AccountOverview />);
    expect(screen.getByText("내 기술").closest("a")).toHaveTextContent("0개");

    writeOwnedSkills(["Python", "Kubernetes"]);

    await waitFor(() =>
      expect(screen.getByText("내 기술").closest("a")).toHaveTextContent("2개"),
    );
  });

  it("manages account notifications, export, and confirmed deletion", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      signingOut: false,
      error: "",
      signOut,
    });

    render(<AccountOverview />);

    const notificationSwitch = await screen.findByRole("switch", {
      name: "새 공고 알림",
    });
    expect(notificationSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(notificationSwitch);
    await waitFor(() =>
      expect(accountActionMocks.savePreference).toHaveBeenCalledWith(
        "viewer-1",
        false,
      ),
    );
    expect(notificationSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    await waitFor(() =>
      expect(accountActionMocks.downloadArchive).toHaveBeenCalledOnce(),
    );

    fireEvent.click(screen.getByRole("button", { name: "계정 삭제" }));
    const confirmation = screen.getByRole("textbox", { name: "확인 문구" });
    fireEvent.change(confirmation, { target: { value: "탈퇴" } });
    fireEvent.click(screen.getByRole("button", { name: "영구 삭제" }));

    await waitFor(() =>
      expect(accountActionMocks.deleteAccount).toHaveBeenCalledOnce(),
    );
    expect(window.localStorage.getItem("ejik-fit:owned-skills")).toBeNull();
    expect(accountActionMocks.replace).toHaveBeenCalledWith("/");
    expect(accountActionMocks.refresh).toHaveBeenCalledOnce();
  });
});
