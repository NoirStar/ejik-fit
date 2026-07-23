import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthViewerProvider } from "@/features/auth/auth-viewer-context";
import type { AccountSyncStatus } from "@/features/auth/use-account-state-sync";
import { useAuthViewer } from "@/features/auth/use-auth-viewer";
import { writeOwnedSkills } from "@/lib/owned-skills";

import { AccountOverview } from "./account-overview";

const accountActionMocks = vi.hoisted(() => ({
  createArchive: vi.fn(),
  deleteAccount: vi.fn(),
  downloadArchive: vi.fn(),
  loadPreference: vi.fn(),
  loadProfile: vi.fn(),
  savePreference: vi.fn(),
  saveNickname: vi.fn(),
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

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({}),
}));

vi.mock("./user-profile-store", () => ({
  createSupabaseUserProfileStore: () => ({
    load: accountActionMocks.loadProfile,
    updateNickname: accountActionMocks.saveNickname,
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

function renderAccountOverview(
  accountSyncStatus: AccountSyncStatus = "synced",
) {
  return render(
    <AuthViewerProvider
      accountSyncStatus={accountSyncStatus}
      ready
      viewer={null}
    >
      <AccountOverview />
    </AuthViewerProvider>,
  );
}

describe("AccountOverview", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    signOut.mockReset();
    signOut.mockResolvedValue(true);
    accountActionMocks.createArchive.mockReset();
    accountActionMocks.createArchive.mockResolvedValue({
      format: "ejikfit-account-export",
      version: 2,
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
    accountActionMocks.loadProfile.mockReset();
    accountActionMocks.loadProfile.mockResolvedValue({
      userId: "viewer-1",
      nickname: "커리어곰",
    });
    accountActionMocks.savePreference.mockReset();
    accountActionMocks.savePreference.mockResolvedValue(undefined);
    accountActionMocks.saveNickname.mockReset();
    accountActionMocks.saveNickname.mockResolvedValue(undefined);
    accountActionMocks.replace.mockReset();
    accountActionMocks.refresh.mockReset();
  });

  it("guides a guest to email login without implying cloud sync", () => {
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: null,
      ready: true,
      status: "unauthenticated",
      signingOut: false,
      error: "",
      signOut,
    });

    renderAccountOverview("local");

    expect(screen.getByRole("heading", { name: "계정" })).toBeInTheDocument();
    expect(screen.getByText("이 기기에 저장됨")).toBeInTheDocument();
    expect(
      screen.getByText(/로그인하면 현재 이 기기의 커리어 데이터를 계정에 합칩니다/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이메일로 로그인" })).toHaveAttribute(
      "href",
      "/login?next=%2Fcareer%2Faccount",
    );
    expect(
      screen.getByText("커뮤니티 게시는 로그인 확인 뒤 진행합니다."),
    ).toBeInTheDocument();
    expect(screen.getByText(/현재 탭의 임시 글로만 보관/)).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveTextContent(
      /브라우저|서버|동기화|병합|저장 검색/,
    );
  });

  it.each<{
    expected: string;
    status: AccountSyncStatus;
  }>([
    { expected: "계정에 저장 중…", status: "syncing" },
    { expected: "계정에 저장됨", status: "synced" },
    { expected: "이 기기에 저장됨", status: "error" },
  ])("shows truthful $status account storage", ({ expected, status }) => {
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      status: "authenticated",
      signingOut: false,
      error: "",
      signOut,
    });

    renderAccountOverview(status);

    const section = screen
      .getByRole("heading", { level: 2, name: "내 커리어 데이터" })
      .closest("section");
    expect(section).not.toBeNull();
    expect(within(section!).getAllByText(expected).length).toBeGreaterThan(0);
    if (status === "error") {
      expect(
        within(section!).getByText("계정에 저장하지 못했습니다."),
      ).toBeInTheDocument();
    } else {
      expect(
        within(section!).queryByText("계정에 저장하지 못했습니다."),
      ).not.toBeInTheDocument();
    }
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
      status: "authenticated",
      signingOut: false,
      error: "",
      signOut,
    });

    renderAccountOverview();

    expect(await screen.findByDisplayValue("dev@example.com")).toHaveAttribute(
      "readonly",
    );
    expect(screen.getByText("내 기술").closest("a")).toHaveTextContent("2개");
    expect(screen.getByText("저장 목록").closest("a")).toHaveTextContent("2건");
    expect(screen.getByText("지원 기록").closest("a")).toHaveTextContent("1건");
    expect(screen.getByText("관심 기업").closest("a")).toHaveTextContent("1곳");
    expect(screen.getByText("공고 알림").closest("a")).toHaveAttribute(
      "href",
      "/career/alerts",
    );
    expect(screen.getByText("공고 알림").closest("a")).toHaveTextContent(
      "계정에서 관리",
    );
    expect(
      screen.getByText("계정 커뮤니티 활동도 함께 보관합니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/글과 댓글, 공감·저장·팔로우는 계정에 보관/),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveTextContent(
      /브라우저|서버|동기화|병합|저장 검색/,
    );

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("refreshes counts when account reconciliation updates browser state", async () => {
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      status: "authenticated",
      signingOut: false,
      error: "",
      signOut,
    });

    renderAccountOverview();
    expect(screen.getByText("내 기술").closest("a")).toHaveTextContent("0개");

    writeOwnedSkills(["Python", "Kubernetes"]);

    await waitFor(() =>
      expect(screen.getByText("내 기술").closest("a")).toHaveTextContent("2개"),
    );
  });

  it("validates and updates the public nickname without exposing the email", async () => {
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      status: "authenticated",
      signingOut: false,
      error: "",
      signOut,
    });

    renderAccountOverview();

    const nickname = await screen.findByRole("textbox", { name: "닉네임" });
    const saveButton = screen.getByRole("button", { name: "저장" });
    await waitFor(() => expect(nickname).toHaveValue("커리어곰"));
    expect(saveButton).toBeDisabled();

    fireEvent.change(nickname, { target: { value: "x" } });
    fireEvent.click(saveButton);
    expect(await screen.findByText(/닉네임은 2자 이상/)).toBeInTheDocument();
    expect(accountActionMocks.saveNickname).not.toHaveBeenCalled();

    fireEvent.change(nickname, { target: { value: " 새닉네임 " } });
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(accountActionMocks.saveNickname).toHaveBeenCalledWith(
        "viewer-1",
        "새닉네임",
      ),
    );
    expect(await screen.findByText("닉네임을 저장했습니다.")).toBeInTheDocument();
  });

  it("keeps the nickname value and focus after a save failure", async () => {
    accountActionMocks.saveNickname.mockRejectedValueOnce(
      new Error("provider profile write failed"),
    );
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      status: "authenticated",
      signingOut: false,
      error: "",
      signOut,
    });
    renderAccountOverview();

    const nickname = await screen.findByRole("textbox", { name: "닉네임" });
    await waitFor(() => expect(nickname).toHaveValue("커리어곰"));
    fireEvent.change(nickname, { target: { value: "재시도할닉네임" } });
    const saveButton = screen.getByRole("button", { name: "저장" });
    saveButton.focus();
    fireEvent.click(saveButton);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "닉네임을 저장하지 못했습니다. 입력한 내용은 그대로 유지됩니다.",
    );
    expect(alert).not.toHaveTextContent("provider profile write failed");
    expect(nickname).toHaveValue("재시도할닉네임");
    expect(nickname).toHaveFocus();
  });

  it("offers a retry when the profile cannot be loaded", async () => {
    accountActionMocks.loadProfile.mockRejectedValueOnce(new Error("missing"));
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      status: "authenticated",
      signingOut: false,
      error: "",
      signOut,
    });

    renderAccountOverview();

    expect(
      await screen.findByText("프로필 설정을 아직 불러오지 못했습니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "닉네임" })).toHaveValue(
        "커리어곰",
      ),
    );
    expect(accountActionMocks.loadProfile).toHaveBeenCalledTimes(2);
  });

  it("manages account notifications, export, and confirmed deletion", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: { id: "viewer-1", email: "dev@example.com" },
      ready: true,
      status: "authenticated",
      signingOut: false,
      error: "",
      signOut,
    });

    renderAccountOverview();

    const notificationSwitch = await screen.findByRole("switch", {
      name: "새 공고 알림",
    });
    await waitFor(() => expect(notificationSwitch).toBeEnabled());
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

  it("does not present an auth lookup failure as a signed-out account", () => {
    vi.mocked(useAuthViewer).mockReturnValue({
      viewer: null,
      ready: true,
      status: "error",
      signingOut: false,
      error: "로그인 상태를 확인하지 못했습니다.",
      signOut,
    });

    renderAccountOverview("error");

    expect(
      screen.getByRole("heading", { name: "로그인 상태를 확인하지 못했습니다." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("로그인 없이 이용 중")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "이메일로 로그인" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "로그인 상태를 확인하지 못했습니다.",
    );
  });
});
