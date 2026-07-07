import type { Metadata } from "next";

import { SkillGraphExperience } from "@/components/skill-graph-experience";
import { getSkillGraph } from "@/lib/api";
import type { SkillGraphResponse } from "@/lib/types";


export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "시장 적합도 대시보드",
  description:
    "보유 기술에서 연결되는 채용시장, 부족한 준비, 관련 공고를 한 화면에서 확인합니다.",
};


const DEFAULT_OWNED_SKILLS = ["C++", "Python", "Linux"];


function emptyGraph(): SkillGraphResponse {
  return {
    seed: "C++",
    nodes: [],
    edges: [],
    evidence: [],
    meta: {
      limit: 30,
      min_confidence: 0.8,
    },
  };
}


export default async function SkillGraphPage() {
  let graph = emptyGraph();
  let failed = false;

  try {
    graph = await getSkillGraph({
      seed: "C++",
      owned_skills: DEFAULT_OWNED_SKILLS,
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
        initialOwnedSkills={DEFAULT_OWNED_SKILLS}
      />
    </main>
  );
}
