"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import {
  defaultSavedJobSearchName,
  hasSavedJobSearchFilter,
  MAX_SAVED_JOB_SEARCHES,
  MAX_SAVED_JOB_SEARCH_NAME_LENGTH,
  normalizeSavedJobSearchFilters,
  savedJobSearchFilterKey,
  type SavedJobSearch,
  type SavedJobSearchFilters,
} from "@/lib/saved-job-searches";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import {
  createSupabaseSavedJobSearchStore,
  type SavedJobSearchStore,
} from "./saved-job-search-store";

const LOAD_ERROR = "저장된 검색을 불러오지 못했습니다.";
const MUTATION_ERROR = "저장된 검색을 변경하지 못했습니다.";

export type SavedJobSearchesState =
  | { status: "idle" | "loading"; items: SavedJobSearch[]; error: "" }
  | { status: "ready"; items: SavedJobSearch[]; error: "" }
  | { status: "error"; items: SavedJobSearch[]; error: string };

export type CreateSavedJobSearchResult =
  | { status: "created"; item: SavedJobSearch }
  | { status: "duplicate"; item: SavedJobSearch }
  | { status: "limit" }
  | { status: "error" };

export type SavedJobSearchesController = {
  state: SavedJobSearchesState;
  reload(): Promise<void>;
  create(
    filters: SavedJobSearchFilters,
    name?: string,
  ): Promise<CreateSavedJobSearchResult>;
  rename(id: string, name: string): Promise<boolean>;
  setEnabled(id: string, enabled: boolean): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  markChecked(ids: string[], evaluatedAt: string): Promise<boolean>;
};

const IDLE_STATE: SavedJobSearchesState = {
  status: "idle",
  items: [],
  error: "",
};

function ready(items: SavedJobSearch[]): SavedJobSearchesState {
  return { status: "ready", items, error: "" };
}

function failed(
  items: SavedJobSearch[],
  error = MUTATION_ERROR,
): SavedJobSearchesState {
  return { status: "error", items, error };
}

function savedName(filters: SavedJobSearchFilters, name?: string) {
  const requested = name?.trim();
  return (requested || defaultSavedJobSearchName(filters)).slice(
    0,
    MAX_SAVED_JOB_SEARCH_NAME_LENGTH,
  );
}

export function useSavedJobSearches(
  viewer: AuthViewer | null,
  injectedStore?: SavedJobSearchStore,
): SavedJobSearchesController {
  const viewerId = viewer?.id;
  const [state, setState] = useState<SavedJobSearchesState>(IDLE_STATE);
  const productionStore = useRef<
    SavedJobSearchStore | null | undefined
  >(undefined);
  const currentViewerId = useRef(viewerId);
  currentViewerId.current = viewerId;

  const resolveStore = useCallback(() => {
    if (injectedStore) return injectedStore;
    if (productionStore.current !== undefined) {
      return productionStore.current;
    }

    const client = createBrowserSupabaseClient();
    productionStore.current = client
      ? createSupabaseSavedJobSearchStore(client)
      : null;
    return productionStore.current;
  }, [injectedStore]);

  useEffect(() => {
    if (!viewerId) {
      setState(IDLE_STATE);
      return;
    }

    let active = true;
    const store = resolveStore();
    setState({ status: "loading", items: [], error: "" });
    if (!store) {
      setState(failed([], LOAD_ERROR));
      return () => {
        active = false;
      };
    }

    void store
      .list(viewerId)
      .then((items) => {
        if (active) setState(ready(items));
      })
      .catch(() => {
        if (active) setState(failed([], LOAD_ERROR));
      });

    return () => {
      active = false;
    };
  }, [resolveStore, viewerId]);

  const reload = useCallback(async () => {
    if (!viewerId) {
      setState(IDLE_STATE);
      return;
    }

    const previousItems = state.items;
    const store = resolveStore();
    setState({ status: "loading", items: previousItems, error: "" });
    if (!store) {
      setState(failed(previousItems, LOAD_ERROR));
      return;
    }

    try {
      const items = await store.list(viewerId);
      if (currentViewerId.current === viewerId) setState(ready(items));
    } catch {
      if (currentViewerId.current === viewerId) {
        setState(failed(previousItems, LOAD_ERROR));
      }
    }
  }, [resolveStore, state.items, viewerId]);

  const create = useCallback(
    async (
      filters: SavedJobSearchFilters,
      name?: string,
    ): Promise<CreateSavedJobSearchResult> => {
      if (!viewerId) return { status: "error" };

      const normalized = normalizeSavedJobSearchFilters(filters);
      if (!hasSavedJobSearchFilter(normalized)) {
        setState(failed(state.items));
        return { status: "error" };
      }

      const filterKey = savedJobSearchFilterKey(normalized);
      const duplicate = state.items.find(
        (item) => item.filterKey === filterKey,
      );
      if (duplicate) return { status: "duplicate", item: duplicate };
      if (state.items.length >= MAX_SAVED_JOB_SEARCHES) {
        return { status: "limit" };
      }

      const nameToSave = savedName(normalized, name);
      if (!nameToSave) {
        setState(failed(state.items));
        return { status: "error" };
      }

      const store = resolveStore();
      if (!store) {
        setState(failed(state.items));
        return { status: "error" };
      }

      try {
        const item = await store.insert(
          viewerId,
          normalized,
          nameToSave,
          new Date().toISOString(),
        );
        setState((current) => ready([item, ...current.items]));
        return { status: "created", item };
      } catch {
        setState(failed(state.items));
        return { status: "error" };
      }
    },
    [resolveStore, state.items, viewerId],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      if (!viewerId) return false;
      const item = state.items.find((candidate) => candidate.id === id);
      if (!item) return false;

      const nextName = name
        .trim()
        .slice(0, MAX_SAVED_JOB_SEARCH_NAME_LENGTH);
      if (!nextName) return false;
      if (nextName === item.name) return true;

      const store = resolveStore();
      if (!store) {
        setState(failed(state.items));
        return false;
      }

      const previousItems = state.items;
      setState(ready(
        previousItems.map((candidate) =>
          candidate.id === id ? { ...candidate, name: nextName } : candidate,
        ),
      ));
      try {
        const updated = await store.update(viewerId, id, { name: nextName });
        setState((current) =>
          ready(
            current.items.map((candidate) =>
              candidate.id === id ? updated : candidate,
            ),
          ),
        );
        return true;
      } catch {
        setState(failed(previousItems));
        return false;
      }
    },
    [resolveStore, state.items, viewerId],
  );

  const setEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      if (!viewerId) return false;
      const item = state.items.find((candidate) => candidate.id === id);
      if (!item) return false;
      if (item.enabled === enabled) return true;

      const store = resolveStore();
      if (!store) {
        setState(failed(state.items));
        return false;
      }

      const checkedAt = enabled ? new Date().toISOString() : undefined;
      const patch = checkedAt
        ? { enabled, lastCheckedAt: checkedAt }
        : { enabled };
      const previousItems = state.items;
      setState(
        ready(
          previousItems.map((candidate) =>
            candidate.id === id
              ? {
                  ...candidate,
                  enabled,
                  ...(checkedAt ? { lastCheckedAt: checkedAt } : {}),
                }
              : candidate,
          ),
        ),
      );
      try {
        const updated = await store.update(viewerId, id, patch);
        setState((current) =>
          ready(
            current.items.map((candidate) =>
              candidate.id === id ? updated : candidate,
            ),
          ),
        );
        return true;
      } catch {
        setState(failed(previousItems));
        return false;
      }
    },
    [resolveStore, state.items, viewerId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!viewerId) return false;
      if (!state.items.some((item) => item.id === id)) return false;

      const store = resolveStore();
      if (!store) {
        setState(failed(state.items));
        return false;
      }

      const previousItems = state.items;
      setState(ready(previousItems.filter((item) => item.id !== id)));
      try {
        await store.remove(viewerId, id);
        return true;
      } catch {
        setState(failed(previousItems));
        return false;
      }
    },
    [resolveStore, state.items, viewerId],
  );

  const markChecked = useCallback(
    async (ids: string[], evaluatedAt: string) => {
      if (!viewerId) return false;
      if (ids.length === 0) return true;

      const store = resolveStore();
      if (!store) {
        setState(failed(state.items));
        return false;
      }

      const previousItems = state.items;
      try {
        await store.markChecked(viewerId, ids, evaluatedAt);
        const checkedIds = new Set(ids);
        setState((current) =>
          ready(
            current.items.map((item) =>
              checkedIds.has(item.id)
                ? {
                    ...item,
                    lastCheckedAt: evaluatedAt,
                    updatedAt: evaluatedAt,
                  }
                : item,
            ),
          ),
        );
        return true;
      } catch {
        setState(failed(previousItems));
        return false;
      }
    },
    [resolveStore, state.items, viewerId],
  );

  return {
    state,
    reload,
    create,
    rename,
    setEnabled,
    remove,
    markChecked,
  };
}
