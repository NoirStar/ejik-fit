import type { Metadata } from "next";

import { buildDashboardSnapshot } from "@/features/dashboard/model";
import { settledResource } from "@/features/dashboard/state";
import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";
import { ownedSkillsFromSearchParams } from "@/lib/owned-skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이직핏 대시보드",
  description:
    "내 기술 스택과 채용 신호를 연결해 맞춤 공고, 보완 기술, 시장 변화를 매일 확인하는 이직핏 홈입니다.",
};

type HomeSearchParams = Record<string, string | string[] | undefined>;


type HomeProps = {
  searchParams?: Promise<HomeSearchParams>;
};


export default async function Home({ searchParams }: HomeProps = {}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const ownedSkills = ownedSkillsFromSearchParams(resolvedSearchParams);
  const seed = ownedSkills[0];

  const [postings, skillStats, graph] = await Promise.all([
    settledResource(getPostings({ limit: 100 })),
    settledResource(getSkillStats({ limit: 8 })),
    settledResource(getSkillGraph({
      ...(seed ? { seed } : {}),
      owned_skills: ownedSkills,
      limit: 30,
    })),
  ]);

  const snapshot = buildDashboardSnapshot({
    postings,
    skillStats,
    graph,
    ownedSkills,
  });

  return (
    <main className="daily-dashboard-page">
      <h1>공식 채용 데이터</h1>
      <p>상태: {snapshot.status}</p>
      <p data-numeric>{snapshot.displayedPostingCount}개 공고를 확인했습니다.</p>
    </main>
  );
}
