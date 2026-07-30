import type { Metadata } from "next";

import { CareerMap } from "@/features/career-map/career-map";
import {
  loadHomeSnapshot,
  type HomeSearchParams,
} from "@/features/home-feed/load-home-snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커리어맵",
  description: "내 경력과 기술을 중심으로 연결 근거가 확인된 커리어 분야와 실제 채용공고를 비교합니다.",
};

type SkillMapPageProps = {
  searchParams?: Promise<HomeSearchParams>;
};

export default async function SkillMapPage({ searchParams }: SkillMapPageProps) {
  return <CareerMap snapshot={await loadHomeSnapshot((await searchParams) ?? {})} />;
}
