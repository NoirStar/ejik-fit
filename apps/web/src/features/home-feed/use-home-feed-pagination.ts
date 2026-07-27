"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { normalizePostingList } from "@/lib/posting-contract";

import {
  HOME_FEED_PAGE_SIZE,
  interleaveHomeSources,
  takeUniqueFeedPage,
} from "./feed-pagination";
import { postingSummaryToFeedItem } from "./model";
import type {
  CommunityPostFeedItem,
  FeedItem,
  FeedTab,
  MarketInsightFeedItem,
  RecommendedJobFeedItem,
} from "./types";

const LOAD_MORE_ERROR = "피드를 더 불러오지 못했습니다.";

export type HomeFeedJobPage = {
  items: RecommendedJobFeedItem[];
  total: number;
};

export type HomeFeedCommunityPage = {
  items: CommunityPostFeedItem[];
  hasMore: boolean;
};

export type HomeFeedJobRequest = {
  careerType: string;
  limit: number;
  offset: number;
  ownedSkills: string[];
  signal: AbortSignal;
};

export type HomeFeedPaginationController = {
  items: FeedItem[];
  loading: boolean;
  error: string;
  complete: boolean;
  loadNext(tab: FeedTab): Promise<void>;
  retry(tab: FeedTab): Promise<void>;
  prepend(item: CommunityPostFeedItem): void;
  remove(itemId: string): void;
};

type UseHomeFeedPaginationOptions = {
  activeTab: FeedTab;
  careerType?: string;
  enabled?: boolean;
  initialCommunity: CommunityPostFeedItem[];
  initialCommunityHasMore: boolean;
  initialInsights: MarketInsightFeedItem[];
  initialJobs: RecommendedJobFeedItem[];
  jobTotal: number;
  liveCommunity?: CommunityPostFeedItem[];
  loadCommunity?: () => Promise<HomeFeedCommunityPage>;
  loadJobs?: (request: HomeFeedJobRequest) => Promise<HomeFeedJobPage>;
  ownedSkills: string[];
};

type PaginationState = {
  items: FeedItem[];
  buffer: FeedItem[];
  error: string;
  jobOffset: number;
  jobTotal: number;
  loading: boolean;
  seenIds: Set<string>;
  sourceEnded: {
    community: boolean;
    jobs: boolean;
  };
};

function includesJobs(tab: FeedTab) {
  return tab === "recommended" || tab === "latest";
}

function eligibleForTab(item: FeedItem, tab: FeedTab) {
  return includesJobs(tab) || item.type === "community_post";
}

function hasEligibleBuffer(buffer: FeedItem[], tab: FeedTab) {
  return buffer.some((item) => eligibleForTab(item, tab));
}

function takeBufferedPage(
  buffer: FeedItem[],
  seenIds: ReadonlySet<string>,
  tab: FeedTab,
) {
  const eligible: FeedItem[] = [];
  const deferred: FeedItem[] = [];
  for (const item of buffer) {
    (eligibleForTab(item, tab) ? eligible : deferred).push(item);
  }
  const page = takeUniqueFeedPage(eligible, seenIds, HOME_FEED_PAGE_SIZE);
  return {
    items: page.items,
    remaining: [...page.remaining, ...deferred],
  };
}

async function defaultLoadJobs({
  careerType,
  limit,
  offset,
  ownedSkills,
  signal,
}: HomeFeedJobRequest): Promise<HomeFeedJobPage> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (careerType) params.set("career_type", careerType);
  const response = await fetch(`/api/home-feed/postings?${params}`, {
    signal,
  });
  if (!response.ok) throw new Error(LOAD_MORE_ERROR);
  const page = normalizePostingList(await response.json());
  return {
    items: page.items.map((posting) =>
      postingSummaryToFeedItem(posting, ownedSkills),
    ),
    total: page.total,
  };
}

function initialState({
  initialCommunity,
  initialCommunityHasMore,
  initialInsights,
  initialJobs,
  jobTotal,
}: UseHomeFeedPaginationOptions): PaginationState {
  const queue = interleaveHomeSources({
    community: initialCommunity,
    insights: initialInsights,
    jobs: initialJobs,
  });
  const page = takeUniqueFeedPage(queue, new Set(), HOME_FEED_PAGE_SIZE);
  return {
    items: page.items,
    buffer: page.remaining,
    error: "",
    jobOffset: initialJobs.length,
    jobTotal,
    loading: false,
    seenIds: new Set(page.items.map(({ id }) => id)),
    sourceEnded: {
      community: !initialCommunityHasMore,
      jobs: initialJobs.length >= jobTotal,
    },
  };
}

export function useHomeFeedPagination(
  options: UseHomeFeedPaginationOptions,
): HomeFeedPaginationController {
  const [state, setState] = useState<PaginationState>(() => initialState(options));
  const stateRef = useRef(state);
  const optionsRef = useRef(options);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  optionsRef.current = options;

  const commit = useCallback(
    (change: (current: PaginationState) => PaginationState) => {
      const next = change(stateRef.current);
      stateRef.current = next;
      if (mountedRef.current) setState(next);
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = null;
    if (options.enabled === false) {
      commit((current) => ({
        ...current,
        error: "",
        loading: false,
      }));
    }
  }, [commit, options.enabled]);

  useEffect(() => {
    if (options.enabled === false || !options.initialCommunityHasMore) return;
    commit((current) =>
      current.sourceEnded.community
        ? {
            ...current,
            sourceEnded: { ...current.sourceEnded, community: false },
          }
        : current,
    );
  }, [commit, options.enabled, options.initialCommunityHasMore]);

  useEffect(() => {
    const liveCommunity = options.liveCommunity;
    if (!liveCommunity || liveCommunity.length === 0) return;
    const byId = new Map(liveCommunity.map((item) => [item.id, item]));
    commit((current) => {
      let changed = false;
      const replace = (item: FeedItem) => {
        if (item.type !== "community_post") return item;
        const replacement = byId.get(item.id);
        if (!replacement || replacement === item) return item;
        changed = true;
        return replacement;
      };
      const items = current.items.map(replace);
      const buffer = current.buffer.map(replace);
      return changed ? { ...current, buffer, items } : current;
    });
  }, [commit, options.liveCommunity]);

  const runNext = useCallback(
    async (tab: FeedTab) => {
      const activeOptions = optionsRef.current;
      if (activeOptions.enabled === false) return;
      const generation = generationRef.current;
      const current = stateRef.current;
      const buffered = takeBufferedPage(current.buffer, current.seenIds, tab);
      if (buffered.items.length > 0) {
        commit((value) => {
          const seenIds = new Set(value.seenIds);
          for (const item of buffered.items) seenIds.add(item.id);
          return {
            ...value,
            items: [...value.items, ...buffered.items],
            buffer: buffered.remaining,
            error: "",
            seenIds,
          };
        });
        return;
      }

      const loadCommunity = activeOptions.loadCommunity;
      const loadJobs = activeOptions.loadJobs ?? defaultLoadJobs;
      const wantsCommunity = !current.sourceEnded.community;
      const wantsJobs = includesJobs(tab) && !current.sourceEnded.jobs;

      if (!wantsCommunity && !wantsJobs) {
        if (current.error) {
          commit((value) => ({ ...value, error: "" }));
        }
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      commit((value) => ({ ...value, error: "", loading: true }));

      const communityRequest = wantsCommunity && loadCommunity
        ? loadCommunity()
            .then((page) => ({ page, error: false as const }))
            .catch(() => ({ page: null, error: true as const }))
        : Promise.resolve({
            page: null,
            error: wantsCommunity as boolean,
          });
      const jobRequest = wantsJobs
        ? loadJobs({
            careerType: activeOptions.careerType ?? "",
            limit: HOME_FEED_PAGE_SIZE,
            offset: current.jobOffset,
            ownedSkills: activeOptions.ownedSkills,
            signal: controller.signal,
          })
            .then((page) => ({ page, error: false as const }))
            .catch(() => ({ page: null, error: true as const }))
        : Promise.resolve({ page: null, error: false as const });

      const [communityResult, jobResult] = await Promise.all([
        communityRequest,
        jobRequest,
      ]);
      if (
        controller.signal.aborted ||
        generationRef.current !== generation ||
        !mountedRef.current
      ) {
        return;
      }

      const communityItems = communityResult.page?.items ?? [];
      const jobItems = jobResult.page?.items ?? [];
      const additions = interleaveHomeSources({
        community: communityItems,
        jobs: jobItems,
      });
      const failed = communityResult.error || jobResult.error;

      commit((value) => {
        const queue = [...value.buffer, ...additions];
        const page = takeBufferedPage(queue, value.seenIds, tab);
        const seenIds = new Set(value.seenIds);
        for (const item of page.items) seenIds.add(item.id);

        const nextJobOffset = jobResult.page
          ? value.jobOffset + jobResult.page.items.length
          : value.jobOffset;
        const nextJobTotal = jobResult.page?.total ?? value.jobTotal;
        const communityEnded = communityResult.page
          ? !communityResult.page.hasMore || communityResult.page.items.length === 0
          : value.sourceEnded.community;
        const jobsEnded = jobResult.page
          ? jobResult.page.items.length === 0 || nextJobOffset >= nextJobTotal
          : value.sourceEnded.jobs;

        return {
          ...value,
          items: [...value.items, ...page.items],
          buffer: page.remaining,
          error: failed ? LOAD_MORE_ERROR : "",
          jobOffset: nextJobOffset,
          jobTotal: nextJobTotal,
          loading: false,
          seenIds,
          sourceEnded: {
            community: communityResult.error
              ? value.sourceEnded.community
              : communityEnded,
            jobs: jobResult.error ? value.sourceEnded.jobs : jobsEnded,
          },
        };
      });
      abortRef.current = null;
    },
    [commit],
  );

  const loadNext = useCallback(
    (tab: FeedTab) => {
      if (inFlightRef.current) return inFlightRef.current;
      const operation = runNext(tab).finally(() => {
        if (inFlightRef.current === operation) inFlightRef.current = null;
      });
      inFlightRef.current = operation;
      return operation;
    },
    [runNext],
  );

  const retry = useCallback(
    async (tab: FeedTab) => {
      commit((current) => ({ ...current, error: "" }));
      await loadNext(tab);
    },
    [commit, loadNext],
  );

  const prepend = useCallback(
    (item: CommunityPostFeedItem) => {
      commit((current) => {
        if (current.seenIds.has(item.id)) {
          return {
            ...current,
            items: current.items.map((currentItem) =>
              currentItem.id === item.id ? item : currentItem,
            ),
            buffer: current.buffer.map((currentItem) =>
              currentItem.id === item.id ? item : currentItem,
            ),
          };
        }
        const seenIds = new Set(current.seenIds);
        seenIds.add(item.id);
        return {
          ...current,
          items: [item, ...current.items],
          buffer: current.buffer.filter(({ id }) => id !== item.id),
          seenIds,
        };
      });
    },
    [commit],
  );

  const remove = useCallback(
    (itemId: string) => {
      commit((current) => ({
        ...current,
        items: current.items.filter(({ id }) => id !== itemId),
        buffer: current.buffer.filter(({ id }) => id !== itemId),
      }));
    },
    [commit],
  );

  const complete = useMemo(() => {
    if (options.enabled === false) return true;
    const communityEnded = state.sourceEnded.community &&
      !options.initialCommunityHasMore;
    const sourcesEnded = communityEnded &&
      (!includesJobs(options.activeTab) || state.sourceEnded.jobs);
    return !hasEligibleBuffer(state.buffer, options.activeTab) && sourcesEnded;
  }, [
    options.activeTab,
    options.enabled,
    options.initialCommunityHasMore,
    state.buffer,
    state.sourceEnded,
  ]);

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    complete,
    loadNext,
    prepend,
    remove,
    retry,
  };
}
