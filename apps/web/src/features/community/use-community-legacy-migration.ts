"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AuthViewer } from "@/features/auth/use-auth-viewer";

import type { CommunityStore } from "./community-store";

const completedMigrations = new Set<string>();

type MigrationPhaseState =
  | { phase: "idle" | "running" | "complete"; failureCount: 0 }
  | { phase: "failed"; failureCount: number };

export type LegacyMigrationStatus =
  | { phase: "idle" | "running" | "complete"; failureCount: 0 }
  | { phase: "failed"; failureCount: number; retry: () => Promise<void> };

type LegacyMigrationOptions = {
  completedUserIds?: Set<string>;
  storage?: Storage | null;
  store?: CommunityStore;
};

const IDLE_STATE: MigrationPhaseState = { phase: "idle", failureCount: 0 };

export function useCommunityLegacyMigration(
  viewer: AuthViewer | null,
  options: LegacyMigrationOptions = {},
): LegacyMigrationStatus {
  const viewerId = viewer?.id ?? null;
  const [state, setState] = useState<MigrationPhaseState>(IDLE_STATE);
  const viewerIdRef = useRef(viewerId);
  const attemptedUserIdRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const completedUserIdsRef = useRef(
    options.completedUserIds ?? completedMigrations,
  );
  const productionStoreRef = useRef<CommunityStore | null | undefined>(
    options.store,
  );
  viewerIdRef.current = viewerId;

  const resolveStore = useCallback(async () => {
    if (options.store) return options.store;
    if (productionStoreRef.current !== undefined) {
      return productionStoreRef.current;
    }
    const [{ createBrowserSupabaseClient }, { createSupabaseCommunityStore }] =
      await Promise.all([
        import("@/lib/supabase/client"),
        import("./community-store"),
      ]);
    const client = createBrowserSupabaseClient();
    productionStoreRef.current = client
      ? createSupabaseCommunityStore(client)
      : null;
    return productionStoreRef.current;
  }, [options.store]);

  const execute = useCallback(
    async (activeViewerId: string) => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      setState({ phase: "running", failureCount: 0 });

      try {
        const [{ migrateLocalCommunityContent }, store] = await Promise.all([
          import("./community-migration"),
          resolveStore(),
        ]);
        if (
          requestRef.current !== request ||
          viewerIdRef.current !== activeViewerId
        ) {
          return;
        }
        if (!store) {
          setState({ phase: "failed", failureCount: 1 });
          return;
        }
        const result = await migrateLocalCommunityContent(
          store,
          activeViewerId,
          options.storage,
        );
        if (
          requestRef.current !== request ||
          viewerIdRef.current !== activeViewerId
        ) {
          return;
        }
        if (result.failures.length > 0) {
          setState({
            phase: "failed",
            failureCount: result.failures.length,
          });
          return;
        }
        completedUserIdsRef.current.add(activeViewerId);
        setState({ phase: "complete", failureCount: 0 });
      } catch {
        if (
          requestRef.current === request &&
          viewerIdRef.current === activeViewerId
        ) {
          setState({ phase: "failed", failureCount: 1 });
        }
      }
    },
    [options.storage, resolveStore],
  );

  useEffect(() => {
    if (!viewerId) {
      attemptedUserIdRef.current = null;
      setState(IDLE_STATE);
      return;
    }
    if (completedUserIdsRef.current.has(viewerId)) {
      attemptedUserIdRef.current = viewerId;
      setState({ phase: "complete", failureCount: 0 });
      return;
    }
    if (attemptedUserIdRef.current === viewerId) return;
    attemptedUserIdRef.current = viewerId;
    void execute(viewerId);
  }, [execute, viewerId]);

  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    [],
  );

  const retry = useCallback(async () => {
    const activeViewerId = viewerIdRef.current;
    if (!activeViewerId) return;
    await execute(activeViewerId);
  }, [execute]);

  return useMemo(
    () =>
      state.phase === "failed"
        ? { ...state, retry }
        : state,
    [retry, state],
  );
}
