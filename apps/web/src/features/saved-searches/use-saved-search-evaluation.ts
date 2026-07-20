"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SavedJobSearch } from "@/lib/saved-job-searches";
import {
  type SavedSearchEvaluationGroup,
  type SavedSearchEvaluationResponse,
  type SavedSearchEvaluationState,
} from "@/lib/saved-search-notifications";

import type {
  SavedJobSearchesController,
  SavedJobSearchesState,
} from "./use-saved-job-searches";

const LOAD_ERROR = "저장 검색 공고를 확인하지 못했습니다.";
const PARTIAL_ERROR = "일부 저장 검색 공고를 확인하지 못했습니다.";
const IDLE_STATE: SavedSearchEvaluationState = {
  status: "idle",
  groups: [],
  error: "",
};

type EvaluationOptions = {
  includePaused?: boolean;
  fetcher?: typeof fetch;
};

type PendingCheckpoint = {
  requestId: number;
  ids: string[];
  evaluatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEvaluationGroup(value: unknown): value is SavedSearchEvaluationGroup {
  if (
    !isRecord(value) ||
    typeof value.searchId !== "string" ||
    !Array.isArray(value.items)
  ) {
    return false;
  }
  if (value.status === "error") {
    return value.total === null && value.items.length === 0;
  }
  return (
    value.status === "ready" &&
    Number.isSafeInteger(value.total) &&
    Number(value.total) >= 0
  );
}

function isEvaluationResponse(
  value: unknown,
): value is SavedSearchEvaluationResponse {
  return (
    isRecord(value) &&
    typeof value.evaluatedAt === "string" &&
    Number.isFinite(Date.parse(value.evaluatedAt)) &&
    Array.isArray(value.groups) &&
    value.groups.every(isEvaluationGroup)
  );
}

function searchSignature(
  searches: SavedJobSearch[],
  includePaused: boolean,
) {
  return JSON.stringify([
    includePaused,
    searches.map((search) => ({
      id: search.id,
      query: search.query,
      category: search.category,
      careerType: search.careerType,
      enabled: search.enabled,
    })),
  ]);
}

export function useSavedSearchEvaluation(
  searches: SavedJobSearch[],
  loadStatus: SavedJobSearchesState["status"],
  markChecked: SavedJobSearchesController["markChecked"],
  options: EvaluationOptions = {},
) {
  const includePaused = options.includePaused ?? false;
  const signature = searchSignature(searches, includePaused);
  const [state, setState] =
    useState<SavedSearchEvaluationState>(IDLE_STATE);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const fetcherRef = useRef(options.fetcher);
  const markCheckedRef = useRef(markChecked);
  const requestSequence = useRef(0);
  const activeRequest = useRef(0);
  const pendingCheckpoint = useRef<PendingCheckpoint | null>(null);
  const mounted = useRef(false);
  fetcherRef.current = options.fetcher;
  markCheckedRef.current = markChecked;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    pendingCheckpoint.current = null;
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    activeRequest.current = requestId;

    if (loadStatus !== "ready") {
      setState(IDLE_STATE);
      return;
    }

    const evaluationSearches = includePaused
      ? searches
      : searches.filter((search) => search.enabled);
    if (evaluationSearches.length === 0) {
      setState({ status: "ready", groups: [], error: "" });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setState((current) => ({
      status: "loading",
      groups: current.groups,
      error: "",
    }));

    async function evaluate() {
      try {
        const fetcher = fetcherRef.current ?? window.fetch;
        const response = await fetcher(
          "/notifications/saved-search-jobs",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              searches: evaluationSearches.map((search) => ({
                id: search.id,
                query: search.query,
                category: search.category,
                careerType: search.careerType,
                lastCheckedAt: search.lastCheckedAt,
              })),
            }),
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Saved search evaluation failed");
        const body: unknown = await response.json();
        if (!isEvaluationResponse(body)) {
          throw new Error("Invalid saved search evaluation response");
        }
        if (
          cancelled ||
          controller.signal.aborted ||
          activeRequest.current !== requestId
        ) {
          return;
        }

        const readyGroups = body.groups.filter(
          (group) => group.status === "ready",
        );
        if (readyGroups.length === 0) {
          setState({ status: "error", groups: [], error: LOAD_ERROR });
          return;
        }

        const enabledIds = new Set(
          evaluationSearches
            .filter((search) => search.enabled)
            .map((search) => search.id),
        );
        const checkpointIds = readyGroups
          .map((group) => group.searchId)
          .filter((id, index, ids) =>
            enabledIds.has(id) && ids.indexOf(id) === index,
          );
        const partial = readyGroups.length !== body.groups.length;
        if (checkpointIds.length > 0) {
          pendingCheckpoint.current = {
            requestId,
            ids: checkpointIds,
            evaluatedAt: body.evaluatedAt,
          };
        }
        setState(
          partial
            ? {
                status: "partial",
                groups: body.groups,
                error: PARTIAL_ERROR,
              }
            : { status: "ready", groups: body.groups, error: "" },
        );
      } catch {
        if (
          cancelled ||
          controller.signal.aborted ||
          activeRequest.current !== requestId
        ) {
          return;
        }
        pendingCheckpoint.current = null;
        setState({ status: "error", groups: [], error: LOAD_ERROR });
      }
    }

    void evaluate();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [includePaused, loadStatus, refreshVersion, signature]);

  useEffect(() => {
    const checkpoint = pendingCheckpoint.current;
    if (
      !checkpoint ||
      checkpoint.requestId !== activeRequest.current ||
      (state.status !== "ready" && state.status !== "partial")
    ) {
      return;
    }
    pendingCheckpoint.current = null;
    queueMicrotask(() => {
      if (
        !mounted.current ||
        checkpoint.requestId !== activeRequest.current
      ) {
        return;
      }
      try {
        void markCheckedRef
          .current(checkpoint.ids, checkpoint.evaluatedAt)
          .catch(() => undefined);
      } catch {
        // The saved-search controller owns mutation error state.
      }
    });
  }, [state]);

  const refresh = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  return { state, refresh };
}
