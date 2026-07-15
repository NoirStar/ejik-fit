"use client";

import { useEffect, useState } from "react";

import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import type { FitAnalyzeResponse } from "@/lib/types";

export type MarketFitState =
  | { status: "empty"; ownedSkills: string[]; data: null }
  | { status: "loading"; ownedSkills: string[]; data: null }
  | { status: "ready"; ownedSkills: string[]; data: FitAnalyzeResponse }
  | { status: "error"; ownedSkills: string[]; data: null };

export function useMarketFit(careerType: string): MarketFitState {
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [state, setState] = useState<MarketFitState>({
    status: "empty",
    ownedSkills: [],
    data: null,
  });

  useEffect(() => {
    setOwnedSkills(readOwnedSkills());
    return subscribeOwnedSkills(setOwnedSkills);
  }, []);

  useEffect(() => {
    if (ownedSkills.length === 0) {
      setState({ status: "empty", ownedSkills: [], data: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", ownedSkills, data: null });
    fetch("/skills/graph/fit", {
      body: JSON.stringify({
        owned_skills: ownedSkills,
        ...(careerType ? { career_type: careerType } : {}),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`fit request failed: ${response.status}`);
        return (await response.json()) as FitAnalyzeResponse;
      })
      .then((data) => {
        setState({ status: "ready", ownedSkills, data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", ownedSkills, data: null });
      });

    return () => controller.abort();
  }, [careerType, ownedSkills]);

  return state;
}
