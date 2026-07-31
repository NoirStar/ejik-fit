"use client";

import { useEffect, useMemo, useState } from "react";

import type { CareerProfile } from "@/lib/career-profile";
import type { CareerAnalyzeResponse } from "@/lib/types";

import { careerAnalysisRequest, normalizeCareerAnalysis } from "./contract";

type AnalysisState =
  | { status: "idle" | "loading"; data: null; error: null }
  | { status: "ready"; data: CareerAnalyzeResponse; error: null }
  | { status: "error"; data: null; error: string };

const CACHE_TTL_MS = 5 * 60 * 1_000;
const cache = new Map<string, { data: CareerAnalyzeResponse; storedAt: number }>();

function cachedAnalysis(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function useCareerAnalysis(
  profile: CareerProfile,
  ownedSkills: string[],
  options: {
    enabled?: boolean;
    direction?: string;
    q?: string;
    careerType?: string;
    category?: string;
    connectionIds?: string[];
    limit?: number;
    offset?: number;
  } = {},
) {
  const [retryKey, setRetryKey] = useState(0);
  const enabled = options.enabled ?? true;
  const direction = options.direction ?? "";
  const query = options.q ?? "";
  const careerType = options.careerType ?? "";
  const category = options.category ?? "";
  const limit = options.limit ?? 12;
  const offset = options.offset ?? 0;
  const connectionIds = options.connectionIds ?? [];
  const connectionIdsKey = connectionIds.join("\u0000");
  const request = useMemo(
    () => careerAnalysisRequest(profile, ownedSkills, {
      direction,
      q: query,
      careerType,
      category,
      limit,
      offset,
      connectionIds,
    }),
    [careerType, category, connectionIdsKey, direction, limit, offset, ownedSkills, profile, query],
  );
  const key = useMemo(() => JSON.stringify(request), [request]);
  const [state, setState] = useState<AnalysisState>(() => {
    const cached = cachedAnalysis(key);
    return cached
      ? { status: "ready", data: cached, error: null }
      : { status: enabled ? "loading" : "idle", data: null, error: null };
  });

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle", data: null, error: null });
      return;
    }
    const cached = cachedAnalysis(key);
    if (cached) {
      setState({ status: "ready", data: cached, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading", data: null, error: null });
    void fetch("/api/career-analysis", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("analysis unavailable");
        return normalizeCareerAnalysis(await response.json());
      })
      .then((data) => {
        cache.set(key, { data, storedAt: Date.now() });
        setState({ status: "ready", data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[career-analysis] request failed", error);
        setState({
          status: "error",
          data: null,
          error: "커리어 분석을 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, [enabled, key, request, retryKey]);

  return {
    ...state,
    retry() {
      cache.delete(key);
      setRetryKey((value) => value + 1);
    },
  };
}
