"use client";

import { useEffect, useMemo, useState } from "react";

import type { SkillTrendResponse } from "@/lib/types";

import {
  buildTrendSkills,
  type MarketTrendResource,
} from "./market-trend";

type TrendSkillOption = { name: string };

export function useMarketTrends({
  availableSkills,
  selectedSkill,
}: {
  availableSkills: readonly TrendSkillOption[];
  selectedSkill: string;
}) {
  const availableKey = availableSkills.map((skill) => skill.name).join("\u0000");
  const availableNames = useMemo(
    () => (availableKey ? availableKey.split("\u0000") : []),
    [availableKey],
  );
  const [comparedSkills, setComparedSkills] = useState(() =>
    buildTrendSkills(selectedSkill, availableSkills),
  );
  const [resource, setResource] = useState<MarketTrendResource>({
    status: "idle",
  });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    setComparedSkills((current) =>
      buildTrendSkills(selectedSkill, [
        ...current.map((name) => ({ name })),
        ...availableNames.map((name) => ({ name })),
      ]),
    );
  }, [availableNames, selectedSkill]);

  const comparisonKey = useMemo(
    () => comparedSkills.join("\u0000"),
    [comparedSkills],
  );

  useEffect(() => {
    const requestedSkills = comparisonKey ? comparisonKey.split("\u0000") : [];
    if (requestedSkills.length === 0) {
      setResource({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    requestedSkills.forEach((skill) => params.append("skills", skill));
    setResource({ status: "loading" });

    void fetch(`/market/trend-data?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("trend request failed");
        return response.json() as Promise<SkillTrendResponse>;
      })
      .then((data) => setResource({ status: "ready", data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResource({ status: "error" });
      });

    return () => controller.abort();
  }, [comparisonKey, requestVersion]);

  return {
    addSkill(skill: string) {
      setComparedSkills((current) =>
        Array.from(new Set([...current, skill])).slice(0, 3),
      );
    },
    comparedSkills,
    removeSkill(skill: string) {
      setComparedSkills((current) =>
        current.filter((candidate) => candidate !== skill),
      );
    },
    resource,
    retry() {
      setRequestVersion((current) => current + 1);
    },
  };
}
