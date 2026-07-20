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
  sanitizeSavedJobSearchIds,
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

type AccountToken = {
  viewerId: string;
  generation: number;
};

type StateChange =
  | SavedJobSearchesState
  | ((current: SavedJobSearchesState) => SavedJobSearchesState);

export function useSavedJobSearches(
  viewer: AuthViewer | null,
  injectedStore?: SavedJobSearchStore,
): SavedJobSearchesController {
  const viewerId = viewer?.id;
  const [state, setState] = useState<SavedJobSearchesState>(IDLE_STATE);
  const stateRef = useRef<SavedJobSearchesState>(IDLE_STATE);
  const stateRevision = useRef(0);
  const mounted = useRef(false);
  const account = useRef({ viewerId, generation: 0 });
  const loadRequest = useRef(0);
  const createQueue = useRef({
    generation: 0,
    tail: Promise.resolve(),
  });
  const productionStore = useRef<
    SavedJobSearchStore | null | undefined
  >(undefined);

  if (account.current.viewerId !== viewerId) {
    const generation = account.current.generation + 1;
    account.current = { viewerId, generation };
    loadRequest.current += 1;
    createQueue.current = {
      generation,
      tail: Promise.resolve(),
    };
  }

  const commitState = useCallback((change: StateChange) => {
    const next =
      typeof change === "function" ? change(stateRef.current) : change;
    stateRef.current = next;
    stateRevision.current += 1;
    setState(next);
    return stateRevision.current;
  }, []);

  const tokenFor = useCallback((expectedViewerId: string | undefined) => {
    const current = account.current;
    if (!expectedViewerId || current.viewerId !== expectedViewerId) {
      return null;
    }
    return {
      viewerId: expectedViewerId,
      generation: current.generation,
    };
  }, []);

  const isAccountActive = useCallback((token: AccountToken) => {
    const current = account.current;
    return (
      mounted.current &&
      current.viewerId === token.viewerId &&
      current.generation === token.generation
    );
  }, []);

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
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadRequest.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!viewerId) {
      commitState(IDLE_STATE);
      return;
    }

    const token = tokenFor(viewerId);
    if (!token) return;

    let active = true;
    const request = loadRequest.current + 1;
    loadRequest.current = request;
    const store = resolveStore();
    commitState({ status: "loading", items: [], error: "" });
    if (!store) {
      if (isAccountActive(token) && loadRequest.current === request) {
        commitState(failed([], LOAD_ERROR));
      }
      return () => {
        active = false;
      };
    }

    void store
      .list(viewerId)
      .then((items) => {
        if (
          active &&
          isAccountActive(token) &&
          loadRequest.current === request
        ) {
          commitState(ready(items));
        }
      })
      .catch(() => {
        if (
          active &&
          isAccountActive(token) &&
          loadRequest.current === request
        ) {
          commitState(failed([], LOAD_ERROR));
        }
      });

    return () => {
      active = false;
    };
  }, [
    commitState,
    isAccountActive,
    resolveStore,
    tokenFor,
    viewerId,
  ]);

  const reload = useCallback(async () => {
    if (!viewerId) {
      if (account.current.viewerId === undefined) {
        commitState(IDLE_STATE);
      }
      return;
    }

    const token = tokenFor(viewerId);
    if (!token) return;
    const request = loadRequest.current + 1;
    loadRequest.current = request;
    const previousItems = stateRef.current.items;
    const store = resolveStore();
    commitState({ status: "loading", items: previousItems, error: "" });
    if (!store) {
      if (isAccountActive(token) && loadRequest.current === request) {
        commitState(failed(previousItems, LOAD_ERROR));
      }
      return;
    }

    try {
      const items = await store.list(viewerId);
      if (isAccountActive(token) && loadRequest.current === request) {
        commitState(ready(items));
      }
    } catch {
      if (isAccountActive(token) && loadRequest.current === request) {
        commitState(failed(previousItems, LOAD_ERROR));
      }
    }
  }, [
    commitState,
    isAccountActive,
    resolveStore,
    tokenFor,
    viewerId,
  ]);

  const create = useCallback(
    async (
      filters: SavedJobSearchFilters,
      name?: string,
    ): Promise<CreateSavedJobSearchResult> => {
      const token = tokenFor(viewerId);
      if (!token) return { status: "error" };
      const normalized = normalizeSavedJobSearchFilters(filters);
      const filterKey = savedJobSearchFilterKey(normalized);
      const nameToSave = savedName(normalized, name);
      loadRequest.current += 1;

      const queue = createQueue.current;
      if (queue.generation !== token.generation) {
        return { status: "error" };
      }

      const operation = queue.tail.then(
        async (): Promise<CreateSavedJobSearchResult> => {
          if (!isAccountActive(token)) return { status: "error" };

          const items = stateRef.current.items;
          if (!hasSavedJobSearchFilter(normalized) || !nameToSave) {
            commitState(failed(items));
            return { status: "error" };
          }

          const duplicate = items.find(
            (item) => item.filterKey === filterKey,
          );
          if (duplicate) {
            return { status: "duplicate", item: duplicate };
          }
          if (items.length >= MAX_SAVED_JOB_SEARCHES) {
            return { status: "limit" };
          }

          const store = resolveStore();
          if (!store) {
            commitState(failed(items));
            return { status: "error" };
          }

          try {
            const item = await store.insert(
              token.viewerId,
              normalized,
              nameToSave,
              new Date().toISOString(),
            );
            if (!isAccountActive(token)) return { status: "error" };

            commitState((current) =>
              ready([
                item,
                ...current.items.filter(
                  (candidate) => candidate.id !== item.id,
                ),
              ]),
            );
            return { status: "created", item };
          } catch {
            if (!isAccountActive(token)) return { status: "error" };
            commitState((current) => failed(current.items));
            return { status: "error" };
          }
        },
      );
      queue.tail = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [
      commitState,
      isAccountActive,
      resolveStore,
      tokenFor,
      viewerId,
    ],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const token = tokenFor(viewerId);
      if (!token) return false;
      const item = stateRef.current.items.find(
        (candidate) => candidate.id === id,
      );
      if (!item) return false;

      const nextName = name
        .trim()
        .slice(0, MAX_SAVED_JOB_SEARCH_NAME_LENGTH);
      if (!nextName) return false;
      if (nextName === item.name) return true;

      const store = resolveStore();
      if (!store) {
        commitState((current) => failed(current.items));
        return false;
      }

      loadRequest.current += 1;
      const previousItems = stateRef.current.items;
      const optimisticRevision = commitState(
        ready(
          previousItems.map((candidate) =>
            candidate.id === id
              ? { ...candidate, name: nextName }
              : candidate,
          ),
        ),
      );
      try {
        const updated = await store.update(token.viewerId, id, {
          name: nextName,
        });
        if (!isAccountActive(token)) return false;
        commitState((current) =>
          ready(
            current.items.map((candidate) =>
              candidate.id === id ? updated : candidate,
            ),
          ),
        );
        return true;
      } catch {
        if (!isAccountActive(token)) return false;
        if (stateRevision.current === optimisticRevision) {
          commitState(failed(previousItems));
        } else {
          commitState((current) => failed(current.items));
        }
        return false;
      }
    },
    [
      commitState,
      isAccountActive,
      resolveStore,
      tokenFor,
      viewerId,
    ],
  );

  const setEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      const token = tokenFor(viewerId);
      if (!token) return false;
      const item = stateRef.current.items.find(
        (candidate) => candidate.id === id,
      );
      if (!item) return false;
      if (item.enabled === enabled) return true;

      const store = resolveStore();
      if (!store) {
        commitState((current) => failed(current.items));
        return false;
      }

      loadRequest.current += 1;
      const checkedAt = enabled ? new Date().toISOString() : undefined;
      const patch = checkedAt
        ? { enabled, lastCheckedAt: checkedAt }
        : { enabled };
      const previousItems = stateRef.current.items;
      const optimisticRevision = commitState(
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
        const updated = await store.update(token.viewerId, id, patch);
        if (!isAccountActive(token)) return false;
        commitState((current) =>
          ready(
            current.items.map((candidate) =>
              candidate.id === id ? updated : candidate,
            ),
          ),
        );
        return true;
      } catch {
        if (!isAccountActive(token)) return false;
        if (stateRevision.current === optimisticRevision) {
          commitState(failed(previousItems));
        } else {
          commitState((current) => failed(current.items));
        }
        return false;
      }
    },
    [
      commitState,
      isAccountActive,
      resolveStore,
      tokenFor,
      viewerId,
    ],
  );

  const remove = useCallback(
    async (id: string) => {
      const token = tokenFor(viewerId);
      if (!token) return false;
      if (!stateRef.current.items.some((item) => item.id === id)) return false;

      const store = resolveStore();
      if (!store) {
        commitState((current) => failed(current.items));
        return false;
      }

      loadRequest.current += 1;
      const previousItems = stateRef.current.items;
      const optimisticRevision = commitState(
        ready(previousItems.filter((item) => item.id !== id)),
      );
      try {
        await store.remove(token.viewerId, id);
        if (!isAccountActive(token)) return false;
        return true;
      } catch {
        if (!isAccountActive(token)) return false;
        if (stateRevision.current === optimisticRevision) {
          commitState(failed(previousItems));
        } else {
          commitState((current) => failed(current.items));
        }
        return false;
      }
    },
    [
      commitState,
      isAccountActive,
      resolveStore,
      tokenFor,
      viewerId,
    ],
  );

  const markChecked = useCallback(
    async (ids: string[], evaluatedAt: string) => {
      const token = tokenFor(viewerId);
      if (!token) return false;
      const checkpointIds = sanitizeSavedJobSearchIds(ids);
      if (checkpointIds.length === 0) return true;

      const store = resolveStore();
      if (!store) {
        commitState((current) => failed(current.items));
        return false;
      }

      loadRequest.current += 1;
      try {
        await store.markChecked(
          token.viewerId,
          checkpointIds,
          evaluatedAt,
        );
        if (!isAccountActive(token)) return false;
        const checkedIds = new Set(checkpointIds);
        commitState((current) =>
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
        if (!isAccountActive(token)) return false;
        commitState((current) => failed(current.items));
        return false;
      }
    },
    [
      commitState,
      isAccountActive,
      resolveStore,
      tokenFor,
      viewerId,
    ],
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
