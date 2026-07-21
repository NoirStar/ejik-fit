import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthPanel } from "./auth-panel";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getUser: mocks.getUser,
      resend: mocks.resend,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      updateUser: mocks.updateUser,
    },
  }),
}));

function fillEmail(value = "developer@example.com") {
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value },
  });
}

describe("AuthPanel", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.resend.mockResolvedValue({ error: null });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "session" } },
      error: null,
    });
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ error: null });
  });

  afterEach(() => cleanup());

  it("creates a verified email account with a trimmed nickname", async () => {
    render(<AuthPanel initialMode="signup" nextPath="/career/saved" />);

    fillEmail();
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "career2026" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "career2026" },
    });
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: " 커리어곰 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1));
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "developer@example.com",
      password: "career2026",
      options: {
        data: { nickname: "커리어곰" },
        emailRedirectTo: expect.stringMatching(
          /\/auth\/callback\?next=%2Fcareer%2Fsaved$/,
        ),
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "확인 메일을 보냈습니다.",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "확인 메일 다시 보내기" }),
    );
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledTimes(1));
    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "developer@example.com",
      options: {
        emailRedirectTo: expect.stringMatching(
          /\/auth\/callback\?next=%2Fcareer%2Fsaved$/,
        ),
      },
    });
  });

  it("signs in with email and password and preserves the destination", async () => {
    render(<AuthPanel initialMode="signin" nextPath="/jobs?q=Python" />);

    fillEmail();
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "career2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() =>
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "developer@example.com",
        password: "career2026",
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/jobs?q=Python");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("requests a password recovery callback without exposing account state", async () => {
    render(<AuthPanel initialMode="reset" nextPath="/career/saved" />);

    fillEmail();
    fireEvent.click(
      screen.getByRole("button", { name: "재설정 메일 보내기" }),
    );

    await waitFor(() =>
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledTimes(1),
    );
    const [, options] = mocks.resetPasswordForEmail.mock.calls[0] as [
      string,
      { redirectTo: string },
    ];
    const callback = new URL(options.redirectTo);
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe(
      "/login?mode=update-password&next=%2Fcareer%2Fsaved",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "재설정 안내 메일을 보냈습니다.",
    );
  });

  it("updates the password only after confirming a recovery session", async () => {
    render(
      <AuthPanel initialMode="update-password" nextPath="/career/saved" />,
    );

    fireEvent.change(await screen.findByLabelText("새 비밀번호"), {
      target: { value: "career2026" },
    });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), {
      target: { value: "career2026" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "새 비밀번호 저장" }),
    );

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({
        password: "career2026",
      }),
    );
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/career/saved");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("blocks invalid signup values before calling Supabase", () => {
    render(<AuthPanel initialMode="signup" nextPath="/career" />);

    fillEmail("bad");
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "different" },
    });
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(screen.getByText("올바른 이메일 주소를 입력해주세요.")).toBeInTheDocument();
    expect(screen.getByText("비밀번호가 일치하지 않습니다.")).toBeInTheDocument();
  });

  it("keeps the signin form usable and hides provider errors", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "User does not exist", code: "invalid_credentials" },
    });
    render(<AuthPanel initialMode="signin" nextPath="/career" />);

    fillEmail();
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "career2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "이메일 또는 비밀번호를 확인해주세요.",
    );
    expect(screen.queryByText("User does not exist")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  });
});
