"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import {
  type CommunityPost,
  type CommunityViewerState,
  type CreateCommunityPostInput,
} from "@/lib/community-contract";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import {
  createSupabaseCommunityStore,
  type CommunityStore,
} from "./community-store";

const EMPTY_VIEWER_STATE: CommunityViewerState = {
  reactedPostIds: [],
  savedPostIds: [],
  followedAuthorIds: [],
};

const LOAD_ERROR =
  "커뮤니티 새 글을 불러오지 못했습니다. 기존 콘텐츠는 계속 볼 수 있어요.";
const ACTION_ERROR =
  "커뮤니티 활동을 반영하지 못했습니다. 다시 시도해주세요.";

export type CommunityFeedState = {
  status: "idle" | "loading" | "ready" | "error";
  posts: CommunityPost[];
  viewerState: CommunityViewerState;
  error: string;
  actionError: string;
  pendingKeys: string[];
};

export type CommunityFeedController = {
  state: CommunityFeedState;
  reload(): Promise<void>;
  createPost(input: CreateCommunityPostInput): Promise<CommunityPost | null>;
  deletePost(postId: string): Promise<boolean>;
  toggleReaction(postId: string): Promise<boolean>;
  toggleSaved(postId: string): Promise<boolean>;
  toggleFollowed(authorId: string): Promise<boolean>;
};

type UseCommunityFeedOptions = {
  authReady: boolean;
  authorId?: string;
  enabled?: boolean;
  limit?: number;
  savedOnly?: boolean;
  viewer: AuthViewer | null;
  store?: CommunityStore;
};

const INITIAL_STATE: CommunityFeedState = {
  status: "idle",
  posts: [],
  viewerState: EMPTY_VIEWER_STATE,
  error: "",
  actionError: "",
  pendingKeys: [],
};

function membershipWith(
  values: string[],
  id: string,
  active: boolean,
) {
  return active
    ? values.includes(id)
      ? values
      : [...values, id]
    : values.filter((value) => value !== id);
}

function metricWith(
  posts: CommunityPost[],
  postId: string,
  field: "reactions" | "saves",
  delta: number,
) {
  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          metrics: {
            ...post.metrics,
            [field]: Math.max(0, post.metrics[field] + delta),
          },
        }
      : post,
  );
}

export function useCommunityFeed({
  authReady,
  authorId,
  enabled = true,
  limit = 20,
  savedOnly = false,
  store: injectedStore,
  viewer,
}: UseCommunityFeedOptions): CommunityFeedController {
  const viewerId = viewer?.id;
  const [state, setState] = useState<CommunityFeedState>(INITIAL_STATE);
  const stateRef = useRef(state);
  const requestRef = useRef(0);
  const viewerIdRef = useRef(viewerId);
  const pendingRef = useRef(new Set<string>());
  const productionStore = useRef<CommunityStore | null | undefined>(undefined);
  viewerIdRef.current = viewerId;

  const commit = useCallback(
    (
      change:
        | CommunityFeedState
        | ((current: CommunityFeedState) => CommunityFeedState),
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
    if (productionStore.current !== undefined) return productionStore.current;
    const client = createBrowserSupabaseClient();
    productionStore.current = client
      ? createSupabaseCommunityStore(client)
      : null;
    return productionStore.current;
  }, [injectedStore]);

  const load = useCallback(
    async (keepPosts: boolean) => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      if (!authReady || !enabled) {
        commit(INITIAL_STATE);
        return;
      }

      if (savedOnly && !viewerId) {
        commit({ ...INITIAL_STATE, status: "ready" });
        return;
      }

      const previousState = stateRef.current;
      const previousPosts = keepPosts ? previousState.posts : [];
      const previousViewerState = keepPosts
        ? previousState.viewerState
        : EMPTY_VIEWER_STATE;
      commit({
        ...INITIAL_STATE,
        status: "loading",
        posts: previousPosts,
        viewerState: previousViewerState,
      });
      const resolvedStore = resolveStore();
      if (!resolvedStore) {
        if (requestRef.current === request) {
          commit({
            ...INITIAL_STATE,
            status: "error",
            posts: previousPosts,
            viewerState: previousViewerState,
            error: LOAD_ERROR,
          });
        }
        return;
      }

      const activeViewerId = viewerId;
      try {
        const posts = savedOnly && activeViewerId
          ? await resolvedStore.listSavedPosts(activeViewerId, limit)
          : await resolvedStore.listPosts({
              ...(authorId ? { authorId } : {}),
              limit,
            });
        const viewerState = activeViewerId
          ? await resolvedStore.loadViewerState(activeViewerId, {
              postIds: posts.map((post) => post.id),
              authorIds: posts.map((post) => post.author.id),
            })
          : EMPTY_VIEWER_STATE;
        if (
          requestRef.current !== request ||
          viewerIdRef.current !== activeViewerId
        ) {
          return;
        }
        commit({
          ...INITIAL_STATE,
          status: "ready",
          posts,
          viewerState,
        });
      } catch {
        if (
          requestRef.current === request &&
          viewerIdRef.current === activeViewerId
        ) {
          commit({
            ...INITIAL_STATE,
            status: "error",
            posts: previousPosts,
            viewerState: previousViewerState,
            error: LOAD_ERROR,
          });
        }
      }
    },
    [
      authReady,
      authorId,
      commit,
      enabled,
      limit,
      resolveStore,
      savedOnly,
      viewerId,
    ],
  );

  useEffect(() => {
    void load(false);
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  const runMutation = useCallback(
    async (
      key: string,
      operation: (store: CommunityStore, viewerId: string) => Promise<void>,
      apply: (current: CommunityFeedState) => CommunityFeedState,
    ) => {
      const activeViewerId = viewerIdRef.current;
      const resolvedStore = resolveStore();
      if (!activeViewerId || !resolvedStore || pendingRef.current.has(key)) {
        return false;
      }

      pendingRef.current.add(key);
      commit((current) => ({
        ...current,
        actionError: "",
        pendingKeys: Array.from(pendingRef.current),
      }));
      try {
        await operation(resolvedStore, activeViewerId);
        if (viewerIdRef.current !== activeViewerId) return false;
        commit((current) => apply({ ...current, actionError: "" }));
        return true;
      } catch {
        if (viewerIdRef.current === activeViewerId) {
          commit((current) => ({ ...current, actionError: ACTION_ERROR }));
        }
        return false;
      } finally {
        pendingRef.current.delete(key);
        if (viewerIdRef.current === activeViewerId) {
          commit((current) => ({
            ...current,
            pendingKeys: Array.from(pendingRef.current),
          }));
        }
      }
    },
    [commit, resolveStore],
  );

  const createPost = useCallback(
    async (input: CreateCommunityPostInput) => {
      const activeViewerId = viewerIdRef.current;
      const resolvedStore = resolveStore();
      if (!activeViewerId || !resolvedStore) return null;
      const key = "create:post";
      if (pendingRef.current.has(key)) return null;
      pendingRef.current.add(key);
      commit((current) => ({
        ...current,
        actionError: "",
        pendingKeys: Array.from(pendingRef.current),
      }));
      try {
        const post = await resolvedStore.createPost(activeViewerId, input);
        if (viewerIdRef.current !== activeViewerId) return null;
        commit((current) => ({
          ...current,
          posts: [post, ...current.posts.filter((item) => item.id !== post.id)],
        }));
        return post;
      } catch {
        if (viewerIdRef.current === activeViewerId) {
          commit((current) => ({ ...current, actionError: ACTION_ERROR }));
        }
        return null;
      } finally {
        pendingRef.current.delete(key);
        if (viewerIdRef.current === activeViewerId) {
          commit((current) => ({
            ...current,
            pendingKeys: Array.from(pendingRef.current),
          }));
        }
      }
    },
    [commit, resolveStore],
  );

  const deletePost = useCallback(
    async (postId: string) =>
      runMutation(
        `delete:${postId}`,
        (store, activeViewerId) => store.deletePost(activeViewerId, postId),
        (current) => ({
          ...current,
          posts: current.posts.filter((post) => post.id !== postId),
          viewerState: {
            ...current.viewerState,
            reactedPostIds: current.viewerState.reactedPostIds.filter(
              (id) => id !== postId,
            ),
            savedPostIds: current.viewerState.savedPostIds.filter(
              (id) => id !== postId,
            ),
          },
        }),
      ),
    [runMutation],
  );

  const toggleReaction = useCallback(
    async (postId: string) => {
      const active = stateRef.current.viewerState.reactedPostIds.includes(postId);
      return runMutation(
        `reaction:${postId}`,
        (store, activeViewerId) =>
          store.setPostReaction(activeViewerId, postId, !active),
        (current) => ({
          ...current,
          posts: metricWith(current.posts, postId, "reactions", active ? -1 : 1),
          viewerState: {
            ...current.viewerState,
            reactedPostIds: membershipWith(
              current.viewerState.reactedPostIds,
              postId,
              !active,
            ),
          },
        }),
      );
    },
    [runMutation],
  );

  const toggleSaved = useCallback(
    async (postId: string) => {
      const active = stateRef.current.viewerState.savedPostIds.includes(postId);
      return runMutation(
        `save:${postId}`,
        (store, activeViewerId) =>
          store.setPostSaved(activeViewerId, postId, !active),
        (current) => ({
          ...current,
          posts: metricWith(current.posts, postId, "saves", active ? -1 : 1),
          viewerState: {
            ...current.viewerState,
            savedPostIds: membershipWith(
              current.viewerState.savedPostIds,
              postId,
              !active,
            ),
          },
        }),
      );
    },
    [runMutation],
  );

  const toggleFollowed = useCallback(
    async (authorId: string) => {
      if (authorId === viewerIdRef.current) return false;
      const active =
        stateRef.current.viewerState.followedAuthorIds.includes(authorId);
      return runMutation(
        `follow:${authorId}`,
        (store, activeViewerId) =>
          store.setAuthorFollowed(activeViewerId, authorId, !active),
        (current) => ({
          ...current,
          viewerState: {
            ...current.viewerState,
            followedAuthorIds: membershipWith(
              current.viewerState.followedAuthorIds,
              authorId,
              !active,
            ),
          },
        }),
      );
    },
    [runMutation],
  );

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  return {
    state,
    reload,
    createPost,
    deletePost,
    toggleReaction,
    toggleSaved,
    toggleFollowed,
  };
}
