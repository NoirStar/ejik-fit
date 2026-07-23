import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthPanel } from "./auth-panel";

const mocks = vi.hoisted(() => ({
  clientAvailable: true,
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
  createBrowserSupabaseClient: () =>
    mocks.clientAvailable
      ? {
          auth: {
            getUser: mocks.getUser,
            resend: mocks.resend,
            resetPasswordForEmail: mocks.resetPasswordForEmail,
            signInWithPassword: mocks.signInWithPassword,
            signUp: mocks.signUp,
            updateUser: mocks.updateUser,
          },
        }
      : null,
}));

function fillEmail(value = "developer@example.com") {
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value },
  });
}

function submitValidForm(mode: "reset" | "signin" | "signup") {
  fillEmail();
  if (mode !== "reset") {
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "career2026" },
    });
  }
  if (mode === "signup") {
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "career2026" },
    });
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "커리어곰" },
    });
  }
  fireEvent.click(
    screen.getByRole("button", {
      name:
        mode === "signin"
          ? "로그인"
          : mode === "signup"
            ? "회원가입"
            : "재설정 메일 보내기",
    }),
  );
}

describe("AuthPanel", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => {
      if (typeof mock === "function") mock.mockReset();
    });
    mocks.clientAvailable = true;
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
    expect(screen.getByRole("status")).toHaveTextContent(
      "developer@example.com의 메일함에서 가입을 확인해 주세요.",
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

    expect(screen.queryByText(/가입 여부와 관계없이/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("가입된 주소인지 여부는 화면에 표시하지 않습니다."),
    ).not.toBeInTheDocument();
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
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("비밀번호 재설정 요청을 완료했습니다.");
    expect(status).toHaveTextContent(
      "developer@example.com의 메일함을 확인해 주세요.",
    );
  });

  it.each([
    {
      expected:
        "로그인을 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      mode: "signin",
    },
    {
      expected:
        "회원가입을 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      mode: "signup",
    },
    {
      expected:
        "메일 전송을 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      mode: "reset",
    },
  ] as const)(
    "shows the exact missing-client error in $mode mode",
    ({ expected, mode }) => {
      mocks.clientAvailable = false;
      render(<AuthPanel initialMode={mode} nextPath="/career" />);

      submitValidForm(mode);

      expect(screen.getByRole("alert")).toHaveTextContent(
        new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      );
    },
  );

  it.each([
    {
      expected: "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      mode: "signin",
      reject: () => mocks.signInWithPassword.mockRejectedValue(new Error("offline")),
    },
    {
      expected: "회원가입하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      mode: "signup",
      reject: () => mocks.signUp.mockRejectedValue(new Error("offline")),
    },
    {
      expected: "재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
      mode: "reset",
      reject: () =>
        mocks.resetPasswordForEmail.mockRejectedValue(new Error("offline")),
    },
  ] as const)(
    "shows the exact generic asynchronous error in $mode mode",
    async ({ expected, mode, reject }) => {
      reject();
      render(<AuthPanel initialMode={mode} nextPath="/career" />);

      submitValidForm(mode);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      );
    },
  );

  it("shows exact recovery checking and missing-link copy", async () => {
    let resolveGetUser!: (value: {
      data: { user: null };
      error: { message: string };
    }) => void;
    mocks.getUser.mockReturnValue(
      new Promise((resolve) => {
        resolveGetUser = resolve;
      }),
    );

    render(<AuthPanel initialMode="update-password" nextPath="/career" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /^재설정 링크를 확인하고 있습니다\.$/,
    );

    await act(async () => {
      resolveGetUser({
        data: { user: null },
        error: { message: "Auth session missing" },
      });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^이 링크는 만료되었거나 사용할 수 없습니다\.$/,
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
    expect(
      screen.getByText("올바른 이메일 주소를 입력해 주세요."),
    ).toBeInTheDocument();
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
      "이메일 또는 비밀번호를 확인해 주세요.",
    );
    expect(screen.queryByText("User does not exist")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  });
});
