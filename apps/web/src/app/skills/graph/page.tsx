import type { Metadata } from "next";

import { SkillGraphExperience } from "@/components/skill-graph-experience";
import { getSkillGraph } from "@/lib/api";
import { ownedSkillsFromSearchParams } from "@/lib/owned-skills";
import type { SkillGraphResponse } from "@/lib/types";


export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "기술 관계 보기",
  description:
    "같은 채용공고에 함께 등장한 기술과 실제 공고 근거를 확인합니다.",
};

type SkillGraphSearchParams = Record<
  string,
  string | string[] | undefined
>;

type SkillGraphPageProps = {
  searchParams?: Promise<SkillGraphSearchParams>;
};


function emptyGraph(): SkillGraphResponse {
  return {
    seed: null,
    nodes: [],
    edges: [],
    evidence: [],
    meta: {
      limit: 30,
      min_confidence: 0.8,
    },
  };
}


function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildRetryHref(searchParams: SkillGraphSearchParams) {
  const output = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined) return;
    (Array.isArray(value) ? value : [value]).forEach((item) => {
      if (item) output.append(key, item);
    });
  });
  const query = output.toString();
  return `/skills/graph${query ? `?${query}` : ""}`;
}

export default async function SkillGraphPage({
  searchParams,
}: SkillGraphPageProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const seed = firstValue(resolvedSearchParams.seed)?.trim() || undefined;
  const ownedSkills = ownedSkillsFromSearchParams(resolvedSearchParams);
  let graph = emptyGraph();
  let failed = false;

  try {
    graph = await getSkillGraph({
      ...(seed ? { seed } : {}),
      owned_skills: ownedSkills,
      limit: 30,
    });
  } catch {
    failed = true;
  }

  return (
    <SkillGraphExperience
      initialGraph={graph}
      initialOwnedSkills={ownedSkills}
      loadFailed={failed}
      retryHref={buildRetryHref(resolvedSearchParams)}
    />
  );
}
