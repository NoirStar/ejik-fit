import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthViewer } from "./use-auth-viewer";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ auth }),
}));

describe("useAuthViewer", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    localStorage.clear();
    auth.getUser.mockReset();
    auth.onAuthStateChange.mockReset();
    auth.signOut.mockReset();
    auth.unsubscribe.mockReset();
    auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "developer@example.com" } },
      error: null,
    });
    auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: auth.unsubscribe } },
    });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it("uses a verified user and clears the viewer after sign out", async () => {
    localStorage.setItem("ejik-fit:owned-skills", '["Python"]');
    localStorage.setItem("ejik-fit:saved-job-ids", '["job-1"]');
    const { result, unmount } = renderHook(() => useAuthViewer());

    await waitFor(() => {
      expect(result.current.viewer).toEqual({
        id: "user-1",
        email: "developer@example.com",
      });
    });

    await act(async () => {
      expect(await result.current.signOut()).toBe(true);
    });
    expect(result.current.viewer).toBeNull();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("ejik-fit:owned-skills")).toBeNull();
    expect(localStorage.getItem("ejik-fit:saved-job-ids")).toBeNull();

    unmount();
    expect(auth.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("reports an explicit error instead of treating an auth timeout as a guest", () => {
    vi.useFakeTimers();
    auth.getUser.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useAuthViewer());
    expect(result.current.ready).toBe(false);
    expect(result.current.status).toBe("loading");

    act(() => vi.advanceTimersByTime(3_000));

    expect(result.current.ready).toBe(true);
    expect(result.current.status).toBe("error");
    expect(result.current.viewer).toBeNull();
    expect(result.current.error).toBe(
      "로그인 상태를 확인하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.",
    );
  });

  it("reports a rejected auth lookup without silently becoming a guest", async () => {
    auth.getUser.mockRejectedValue(new Error("network unavailable"));

    const { result } = renderHook(() => useAuthViewer());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.ready).toBe(true);
    expect(result.current.viewer).toBeNull();
    expect(result.current.error).toBe(
      "로그인 상태를 확인하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.",
    );
  });

  it("treats Supabase's expected missing-session result as a signed-out viewer", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        name: "AuthSessionMissingError",
        message: "Auth session missing!",
      },
    });

    const { result } = renderHook(() => useAuthViewer());

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.ready).toBe(true);
    expect(result.current.viewer).toBeNull();
    expect(result.current.error).toBe("");
  });
});
