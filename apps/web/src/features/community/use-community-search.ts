"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  normalizeCommunitySearchQuery,
  type CommunityCursor,
  type CommunityPost,
} from "@/lib/community-contract";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import {
  createSupabaseCommunityStore,
  type CommunityStore,
} from "./community-store";

const SEARCH_ERROR =
  "커뮤니티 검색 결과를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";

export type CommunitySearchState = {
  status: "idle" | "loading" | "ready" | "error";
  posts: CommunityPost[];
  nextCursor: CommunityCursor | null;
  loadingMore: boolean;
  error: string;
};

export type CommunitySearchController = {
  state: CommunitySearchState;
  reload(): Promise<void>;
  loadMore(): Promise<void>;
};

type CommunitySearchOptions = {
  limit?: number;
  store?: CommunityStore;
};

const INITIAL_STATE: CommunitySearchState = {
  status: "idle",
  posts: [],
  nextCursor: null,
  loadingMore: false,
  error: "",
};

function appendUniquePosts(current: CommunityPost[], additions: CommunityPost[]) {
  const byId = new Map(current.map((post) => [post.id, post]));
  for (const post of additions) byId.set(post.id, post);
  return Array.from(byId.values());
}

export function useCommunitySearch(
  rawQuery: string,
  { limit = 20, store: injectedStore }: CommunitySearchOptions = {},
): CommunitySearchController {
  const query = normalizeCommunitySearchQuery(rawQuery);
  const [state, setState] = useState<CommunitySearchState>(INITIAL_STATE);
  const stateRef = useRef(state);
  const requestRef = useRef(0);
  const queryRef = useRef(query);
  const productionStoreRef = useRef<CommunityStore | null | undefined>(
    undefined,
  );
  queryRef.current = query;

  const commit = useCallback(
    (
      change:
        | CommunitySearchState
        | ((current: CommunitySearchState) => CommunitySearchState),
    ) => {
      const next =
        typeof change === "function" ? change(stateRef.current) : change;
      stateRef.current = next;
      setState(next);
    },
    [],
  );

  const resolveStore = useCallback(() => {
    if (injectedStore) return injectedStore;
    if (productionStoreRef.current !== undefined) {
      return productionStoreRef.current;
    }
    const client = createBrowserSupabaseClient();
    productionStoreRef.current = client
      ? createSupabaseCommunityStore(client)
      : null;
    return productionStoreRef.current;
  }, [injectedStore]);

  const load = useCallback(async () => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    if (!query) {
      commit(INITIAL_STATE);
      return;
    }
    commit({ ...INITIAL_STATE, status: "loading" });
    const store = resolveStore();
    if (!store) {
      if (requestRef.current === request) {
        commit({ ...INITIAL_STATE, status: "error", error: SEARCH_ERROR });
      }
      return;
    }

    try {
      const page = await store.searchPosts({ query, limit });
      if (requestRef.current !== request || queryRef.current !== query) return;
      commit({
        ...INITIAL_STATE,
        status: "ready",
        posts: page.items,
        nextCursor: page.nextCursor,
      });
    } catch {
      if (requestRef.current === request && queryRef.current === query) {
        commit({ ...INITIAL_STATE, status: "error", error: SEARCH_ERROR });
      }
    }
  }, [commit, limit, query, resolveStore]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    const activeQuery = queryRef.current;
    if (
      !activeQuery ||
      !current.nextCursor ||
      current.loadingMore ||
      current.status !== "ready"
    ) {
      return;
    }
    const store = resolveStore();
    if (!store) return;
    const before = current.nextCursor;
    commit((value) => ({ ...value, loadingMore: true, error: "" }));
    try {
      const page = await store.searchPosts({
        query: activeQuery,
        before,
        limit,
      });
      if (queryRef.current !== activeQuery) return;
      commit((value) => ({
        ...value,
        posts: appendUniquePosts(value.posts, page.items),
        nextCursor: page.nextCursor,
        loadingMore: false,
      }));
    } catch {
      if (queryRef.current === activeQuery) {
        commit((value) => ({
          ...value,
          loadingMore: false,
          error: SEARCH_ERROR,
        }));
      }
    }
  }, [commit, limit, resolveStore]);

  return { state, reload: load, loadMore };
}
