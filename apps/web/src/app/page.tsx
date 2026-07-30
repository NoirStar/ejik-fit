import type { Metadata } from "next";

import { CareerHome } from "@/features/career-home/career-home";
import {
  loadHomeSnapshot,
  type HomeSearchParams,
} from "@/features/home-feed/load-home-snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "커리어핏 | 경력과 채용공고를 연결하는 커리어 분석",
  },
  description:
    "내 경력과 기술이 이어지는 커리어 방향, 연결 근거와 실제 채용공고를 확인합니다.",
};

type HomeProps = {
  searchParams?: Promise<HomeSearchParams>;
};

export default async function Home({ searchParams }: HomeProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  return <CareerHome snapshot={await loadHomeSnapshot(resolvedSearchParams)} />;
}
