import type { Metadata } from "next";

import { SkillGraphExperience } from "@/components/skill-graph-experience";
import { getSkillCatalog, getSkillGraph } from "@/lib/api";
import { normalizeCareerPreferences } from "@/lib/career-preferences";
import { PRODUCT_TERMS } from "@/lib/labels";
import { ownedSkillsFromSearchParams } from "@/lib/owned-skills";
import {
  graphContainsSkill,
  mergeSkillGraphResponses,
} from "@/lib/skill-graph-data";
import type { SkillGraphResponse } from "@/lib/types";


export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: PRODUCT_TERMS.skillMap,
  description: "공개 채용 공고의 기술 관계와 다음 학습 방향을 한눈에 확인하세요.",
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
      limit: 60,
      min_confidence: 0.8,
    },
  };
}


function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function graphDepth(value: string | string[] | undefined): 1 | 2 {
  return firstValue(value) === "2" ? 2 : 1;
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
  const depth = graphDepth(resolvedSearchParams.depth);
  let graph = emptyGraph();
  let failed = false;
  const catalogPromise = getSkillCatalog()
    .then((catalog) => catalog.items)
    .catch(() => []);

  try {
    graph = await getSkillGraph({
      ...(careerType ? { career_type: careerType } : {}),
      depth: 1,
      limit: 60,
      include_evidence: false,
    });
    if (seed && !graphContainsSkill(graph, seed)) {
      try {
        const neighborhood = await getSkillGraph({
          seed,
          ...(careerType ? { career_type: careerType } : {}),
          depth,
          limit: 30,
          include_evidence: false,
        });
        graph = mergeSkillGraphResponses(graph, neighborhood);
      } catch {
        // The public atlas is still useful when a rare seed cannot be expanded.
      }
    }
  } catch {
    failed = true;
  }
  const catalog = await catalogPromise;

  return (
    <SkillGraphExperience
      initialGraph={graph}
      initialSelectedSkill={seed}
      initialSkillCatalog={catalog}
      initialDepth={depth}
      initialOwnedSkills={ownedSkills}
      careerType={careerType || undefined}
      loadFailed={failed}
      retryHref={buildRetryHref(resolvedSearchParams)}
    />
  );
}
