import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthViewer } from "@/features/auth/use-auth-viewer";

import type { CommunityStore } from "./community-store";
import { useCommunityLegacyMigration } from "./use-community-legacy-migration";

const migration = vi.hoisted(() => ({
  run: vi.fn(),
}));

vi.mock("./community-migration", () => ({
  migrateLocalCommunityContent: migration.run,
}));

const VIEWER: AuthViewer = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "viewer@example.com",
};

describe("useCommunityLegacyMigration", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs once when a guest becomes authenticated", async () => {
    migration.run.mockResolvedValue({ migratedPostIds: [], failures: [] });
    const store = {} as CommunityStore;
    const completedUserIds = new Set<string>();
    const { result, rerender } = renderHook(
      ({ viewer }: { viewer: AuthViewer | null }) =>
        useCommunityLegacyMigration(viewer, { completedUserIds, store }),
      { initialProps: { viewer: null as AuthViewer | null } },
    );

    expect(result.current).toEqual({ phase: "idle", failureCount: 0 });
    expect(migration.run).not.toHaveBeenCalled();

    rerender({ viewer: VIEWER });
    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(migration.run).toHaveBeenCalledTimes(1);
    expect(migration.run).toHaveBeenCalledWith(store, VIEWER.id, undefined);

    rerender({ viewer: { ...VIEWER } });
    await act(async () => undefined);
    expect(migration.run).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed migration retryable without rerunning on render", async () => {
    migration.run
      .mockResolvedValueOnce({
        migratedPostIds: [],
        failures: [{ localPostId: "local-1", message: "일시 오류" }],
      })
      .mockResolvedValueOnce({ migratedPostIds: ["local-1"], failures: [] });
    const store = {} as CommunityStore;
    const { result, rerender } = renderHook(() =>
      useCommunityLegacyMigration(VIEWER, {
        completedUserIds: new Set<string>(),
        store,
      }),
    );

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.failureCount).toBe(1);
    rerender();
    expect(migration.run).toHaveBeenCalledTimes(1);

    await act(async () => {
      if (result.current.phase === "failed") {
        await result.current.retry();
      }
    });

    expect(result.current).toEqual({ phase: "complete", failureCount: 0 });
    expect(migration.run).toHaveBeenCalledTimes(2);
  });
});
