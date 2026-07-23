"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { normalizePostingSummary } from "@/lib/posting-contract";
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

const LOAD_ERROR =
  "공고 알림 결과를 확인하지 못했습니다. 이전 결과는 그대로 유지됩니다.";
const PARTIAL_ERROR =
  "일부 공고 알림 결과를 확인하지 못했습니다. 확인한 결과는 그대로 유지됩니다.";
const CHECKPOINT_ERROR =
  "새 공고 결과는 유지했지만 확인 시각을 저장하지 못했습니다.";
const MAX_RESPONSE_GROUPS = 10;
const MAX_GROUP_ITEMS = 5;
const MAX_FUTURE_EVALUATION_MS = 5 * 60 * 1_000;
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
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

type SettledEvaluationState = Extract<
  SavedSearchEvaluationState,
  { status: "ready" | "partial" | "error" }
>;

type SettledEvaluation = {
  identity: string;
  state: SettledEvaluationState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: string[],
) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    const leapYear =
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseEvaluationTime(value: unknown) {
  if (typeof value !== "string") return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] =
    match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) &&
    parsed <= Date.now() + MAX_FUTURE_EVALUATION_MS
    ? parsed
    : null;
}

function normalizeEvaluationResponse(
  value: unknown,
  requestedSearchIds: string[],
): SavedSearchEvaluationResponse | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["evaluatedAt", "groups"]) ||
    typeof value.evaluatedAt !== "string" ||
    parseEvaluationTime(value.evaluatedAt) === null ||
    !Array.isArray(value.groups) ||
    value.groups.length > MAX_RESPONSE_GROUPS ||
    value.groups.length !== requestedSearchIds.length
  ) {
    return null;
  }
  const requestedIds = new Set(requestedSearchIds);
  if (
    requestedIds.size !== requestedSearchIds.length ||
    requestedIds.size > MAX_RESPONSE_GROUPS
  ) {
    return null;
  }

  const seenIds = new Set<string>();
  const groups: SavedSearchEvaluationGroup[] = [];
  try {
    for (const candidate of value.groups) {
      if (
        !isRecord(candidate) ||
        !hasExactKeys(candidate, [
          "searchId",
          "status",
          "total",
          "items",
        ]) ||
        typeof candidate.searchId !== "string" ||
        !requestedIds.has(candidate.searchId) ||
        seenIds.has(candidate.searchId) ||
        !Array.isArray(candidate.items)
      ) {
        return null;
      }
      seenIds.add(candidate.searchId);
      if (candidate.status === "error") {
        if (candidate.total !== null || candidate.items.length !== 0) {
          return null;
        }
        groups.push({
          searchId: candidate.searchId,
          status: "error",
          total: null,
          items: [],
        });
        continue;
      }
      if (
        candidate.status !== "ready" ||
        !Number.isSafeInteger(candidate.total) ||
        Number(candidate.total) < 0 ||
        candidate.items.length > MAX_GROUP_ITEMS
      ) {
        return null;
      }
      groups.push({
        searchId: candidate.searchId,
        status: "ready",
        total: Number(candidate.total),
        items: candidate.items.map(normalizePostingSummary),
      });
    }
  } catch {
    return null;
  }
  return seenIds.size === requestedIds.size
    ? { evaluatedAt: value.evaluatedAt, groups }
    : null;
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

function searchIdentity(searches: SavedJobSearch[]) {
  const ids = searches.map((search) => search.id);
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    return null;
  }
  return JSON.stringify([...ids].sort());
}

function groupsMatchSearchIdentity(
  groups: SavedSearchEvaluationGroup[],
  searches: SavedJobSearch[],
) {
  if (groups.length !== searches.length) return false;
  const searchIds = new Set(searches.map((search) => search.id));
  const groupIds = new Set(groups.map((group) => group.searchId));
  return (
    searchIds.size === searches.length &&
    groupIds.size === groups.length &&
    groups.every((group) => searchIds.has(group.searchId))
  );
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
  const lastSettledEvaluation = useRef<SettledEvaluation | null>(null);
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

    const evaluationSearches = includePaused
      ? searches
      : searches.filter((search) => search.enabled);
    const identity = searchIdentity(evaluationSearches);

    if (loadStatus !== "ready") {
      const settled = lastSettledEvaluation.current;
      if (!identity || settled?.identity !== identity) {
        lastSettledEvaluation.current = null;
        setState(IDLE_STATE);
        return;
      }
      setState((current) =>
        current.status === "loading" ? settled.state : current,
      );
      return;
    }

    if (evaluationSearches.length === 0) {
      lastSettledEvaluation.current = null;
      setState({ status: "ready", groups: [], error: "" });
      return;
    }

    if (lastSettledEvaluation.current?.identity !== identity) {
      lastSettledEvaluation.current = null;
    }

    const controller = new AbortController();
    let cancelled = false;
    setState((current) => ({
      status: "loading",
      groups: groupsMatchSearchIdentity(
        current.groups,
        evaluationSearches,
      )
        ? current.groups
        : [],
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
        const body = normalizeEvaluationResponse(
          await response.json(),
          evaluationSearches.map((search) => search.id),
        );
        if (!body) {
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
          setState((current) => {
            const next: SettledEvaluationState = {
              status: "error",
              groups: current.groups,
              error: LOAD_ERROR,
            };
            lastSettledEvaluation.current = identity
              ? { identity, state: next }
              : null;
            return next;
          });
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
        const next: SettledEvaluationState =
          partial
            ? {
                status: "partial",
                groups: body.groups,
                error: PARTIAL_ERROR,
              }
            : { status: "ready", groups: body.groups, error: "" };
        lastSettledEvaluation.current = identity
          ? { identity, state: next }
          : null;
        setState(next);
      } catch {
        if (
          cancelled ||
          controller.signal.aborted ||
          activeRequest.current !== requestId
        ) {
          return;
        }
        pendingCheckpoint.current = null;
        setState((current) => {
          const next: SettledEvaluationState = {
            status: "error",
            groups: current.groups,
            error: LOAD_ERROR,
          };
          lastSettledEvaluation.current = identity
            ? { identity, state: next }
            : null;
          return next;
        });
      }
    }

    queueMicrotask(() => {
      if (
        cancelled ||
        controller.signal.aborted ||
        activeRequest.current !== requestId
      ) {
        return;
      }
      void evaluate();
    });
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
      async function saveCheckpoint(currentCheckpoint: PendingCheckpoint) {
        let saved = false;
        try {
          saved = await markCheckedRef.current(
            currentCheckpoint.ids,
            currentCheckpoint.evaluatedAt,
          );
        } catch {
          saved = false;
        }
        if (
          saved ||
          !mounted.current ||
          currentCheckpoint.requestId !== activeRequest.current
        ) {
          return;
        }
        setState((current) => {
          if (
            current.status !== "ready" &&
            current.status !== "partial"
          ) {
            return current;
          }
          const next: SettledEvaluationState = {
            status: "partial",
            groups: current.groups,
            error:
              current.status === "partial"
                ? `${current.error} ${CHECKPOINT_ERROR}`
                : CHECKPOINT_ERROR,
          };
          const settled = lastSettledEvaluation.current;
          if (settled) {
            lastSettledEvaluation.current = {
              identity: settled.identity,
              state: next,
            };
          }
          return next;
        });
      }
      void saveCheckpoint(checkpoint);
    });
  }, [state]);

  const refresh = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  return { state, refresh };
}
