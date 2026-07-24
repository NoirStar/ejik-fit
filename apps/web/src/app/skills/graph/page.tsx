import type { Metadata } from "next";

import { SkillGraphExperience } from "@/components/skill-graph-experience";
import { getSkillGraph } from "@/lib/api";
import { normalizeCareerPreferences } from "@/lib/career-preferences";
import { PRODUCT_TERMS } from "@/lib/labels";
import { ownedSkillsFromSearchParams } from "@/lib/owned-skills";
import type { SkillGraphResponse } from "@/lib/types";


export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: PRODUCT_TERMS.skillMap,
  description: "내 기술과 함께 자주 요구되는 기술을 보여줍니다.",
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
  const careerType = normalizeCareerPreferences({
    careerCondition: firstValue(resolvedSearchParams.career_type),
    targetDomain: "",
  }).careerCondition;
  const ownedSkills = ownedSkillsFromSearchParams(resolvedSearchParams);
  let graph = emptyGraph();
  let failed = false;

  try {
    graph = await getSkillGraph({
      ...(seed ? { seed } : {}),
      ...(careerType ? { career_type: careerType } : {}),
      owned_skills: ownedSkills,
      limit: 30,
      include_evidence: false,
    });
  } catch {
    failed = true;
  }

  return (
    <SkillGraphExperience
      initialGraph={graph}
      initialOwnedSkills={ownedSkills}
      careerType={careerType || undefined}
      loadFailed={failed}
      retryHref={buildRetryHref(resolvedSearchParams)}
    />
  );
}
