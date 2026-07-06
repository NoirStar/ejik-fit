import type { Metadata } from "next";
import Link from "next/link";

import { LandingMotion } from "@/components/landing-motion";
import { SkillGraphExperience } from "@/components/skill-graph-experience";
import { getSkillGraph } from "@/lib/api";
import type { SkillGraphResponse } from "@/lib/types";


export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "스킬 그래프",
  description:
    "보유 기술과 채용공고 요구사항의 관계를 그래프로 탐색합니다.",
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
    <main className="graph-page overflow-x-hidden w-full max-w-full">
      <LandingMotion />

      <section className="graph-hero">
        <div className="graph-hero__copy">
          <Link href="/" className="back-link">
            홈으로 돌아가기
          </Link>
          <p className="eyebrow">Skill Map</p>
          <h1>스킬 그래프</h1>
          <p>
            보유 기술을 입력하고, 공고 안에서 함께 등장하는 기술과 분야를
            연결해서 봅니다. 혼합 직무도 하나의 그래프 안에서 해석합니다.
          </p>
        </div>
        <div className="graph-hero__panel gsap-image-reveal">
          <span>현재 기준</span>
          <strong>{graph.nodes.length}개 스킬 노드</strong>
          <p>
            필수, 우대, 언급 스킬을 분리하고 공고 근거가 있는 관계만 표시합니다.
          </p>
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
