import type { Metadata } from "next";

import { SkillGraphExperience } from "@/components/skill-graph-experience";
import { getSkillGraph } from "@/lib/api";
import { ownedSkillsFromSearchParams } from "@/lib/owned-skills";
import type { SkillGraphResponse } from "@/lib/types";


export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "스킬맵",
  description:
    "보유 기술에서 연결되는 채용시장, 부족한 준비, 관련 공고를 한 화면에서 확인합니다.",
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
    <main className="dashboard-app-page overflow-x-hidden w-full max-w-full">
      {failed && (
        <div className="dashboard-app-error" role="alert">
          <strong>그래프 데이터를 불러오지 못했습니다.</strong>
          <p>API 서버가 준비되면 대시보드에서 바로 표시됩니다.</p>
        </div>
      )}

      <SkillGraphExperience
        initialGraph={graph}
        initialOwnedSkills={ownedSkills}
      />
    </main>
  );
}
