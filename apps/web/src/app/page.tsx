import type { Metadata } from "next";

import { DailyDashboardHome } from "@/components/dashboard/daily-dashboard-home";
import { buildDailyDashboardModel } from "@/components/dashboard/dashboard-model";
import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";
import type {
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이직핏 대시보드",
  description:
    "내 기술 스택과 채용 신호를 연결해 맞춤 공고, 보완 기술, 시장 변화를 매일 확인하는 이직핏 홈입니다.",
};

const DEFAULT_OWNED_SKILLS = ["C++", "Python", "Linux"];


function fulfilledOrNull<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : null;
}


export default async function Home() {
  const [postingsResult, statsResult, graphResult] = await Promise.allSettled([
    getPostings({}),
    getSkillStats({ limit: 8 }),
    getSkillGraph({
      seed: "C++",
      owned_skills: DEFAULT_OWNED_SKILLS,
      limit: 30,
    }),
  ]);

  const postings = fulfilledOrNull<PostingListResponse>(postingsResult);
  const skillStats = fulfilledOrNull<SkillStatsResponse>(statsResult);
  const graph = fulfilledOrNull<SkillGraphResponse>(graphResult);
  const failedCount = [postings, skillStats, graph].filter((value) => value === null).length;

  const model = buildDailyDashboardModel({
    postings,
    skillStats,
    graph,
    ownedSkills: DEFAULT_OWNED_SKILLS,
  });

  return (
    <main className="daily-dashboard-page">
      <DailyDashboardHome model={model} dataFailed={failedCount > 0} />
    </main>
  );
}
