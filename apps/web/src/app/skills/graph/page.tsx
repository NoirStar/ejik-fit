import type { Metadata } from "next";
import Link from "next/link";

import { LandingMotion } from "@/components/landing-motion";
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
    <main className="graph-page dashboard-page overflow-x-hidden w-full max-w-full">
      <LandingMotion />

      <section className="dashboard-hero">
        <div className="dashboard-hero__copy">
          <Link href="/" className="back-link">
            홈으로 돌아가기
          </Link>
          <p className="eyebrow">Market fit dashboard</p>
          <h1>스킬에서 시장 요구까지 한 화면으로.</h1>
          <p>
            그래프는 탐색 도구이고, 목표는 준비 방향입니다. 보유 스킬을 기준으로
            관련 분야, 부족한 기술, 근거 공고를 함께 봅니다.
          </p>
        </div>
        <div className="dashboard-hero__panel gsap-image-reveal">
          <span>현재 기준</span>
          <strong>
            {failed ? "데이터 연결 대기" : `${graph.nodes.length}개 스킬 노드`}
          </strong>
          <p>공개 공고에서 확인된 관계만 시장 신호로 사용합니다.</p>
        </div>
      </section>

      {failed && (
        <div className="state-message graph-state-message" role="alert">
          <strong>그래프 데이터를 불러오지 못했습니다.</strong>
          <p>API 서버가 준비되면 같은 화면에서 바로 그래프를 확인할 수 있습니다.</p>
        </div>
      )}

      <SkillGraphExperience
        initialGraph={graph}
        initialOwnedSkills={DEFAULT_OWNED_SKILLS}
      />
    </main>
  );
}
