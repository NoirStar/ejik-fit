import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
