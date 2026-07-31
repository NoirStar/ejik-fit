import type { Metadata } from "next";

import { CareerMap } from "@/features/career-map/career-map";
import {
  loadHomeSnapshot,
  type HomeSearchParams,
} from "@/features/home-feed/load-home-snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커리어 방향 비교",
  description:
    "내 직무와 업무 경험에서 이어지는 커리어 방향을 실제 채용공고 근거와 함께 비교합니다.",
  alternates: { canonical: "/career-map" },
};

type CareerMapPageProps = {
  searchParams?: Promise<HomeSearchParams>;
};

export default async function CareerMapPage({
  searchParams,
}: CareerMapPageProps) {
  return (
    <CareerMap
      snapshot={await loadHomeSnapshot((await searchParams) ?? {})}
    />
  );
}
