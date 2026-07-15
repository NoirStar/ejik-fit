import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

const signInWithOtp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { signInWithOtp },
  }),
}));

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
    signInWithOtp.mockReset();
  });

  it("requests one passwordless email link and shows the sent state", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm nextPath="/career/saved" />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "developer@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인 링크 받기" }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "developer@example.com",
      options: {
        emailRedirectTo: expect.stringMatching(
          /\/auth\/callback\?next=%2Fcareer%2Fsaved$/,
        ),
        shouldCreateUser: true,
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "이메일에서 로그인 링크를 확인해주세요.",
    );
  });

  it("keeps the form usable when the auth request fails", async () => {
    signInWithOtp.mockResolvedValue({
      error: { message: "rate limited" },
    });
    render(<LoginForm nextPath="/career" />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "developer@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "로그인 링크 받기" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "로그인 링크를 보내지 못했습니다.",
    );
    expect(screen.getByRole("button", { name: "로그인 링크 받기" })).toBeEnabled();
  });
});
