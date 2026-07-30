import type { Metadata } from "next";

import { HomeFeed } from "@/features/home-feed/home-feed";
import {
  communityComposeMode,
  loadHomeSnapshot,
  type HomeSearchParams,
} from "@/features/home-feed/load-home-snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: "커리어 고민과 직무 전환, 현직 업무 경험을 질문하고 나눕니다.",
};

type CommunityPageProps = {
  searchParams?: Promise<HomeSearchParams>;
};

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const snapshot = await loadHomeSnapshot(resolvedSearchParams);

  return (
    <HomeFeed
      composeMode={communityComposeMode(resolvedSearchParams)}
      snapshot={{ ...snapshot, feedItems: [] }}
    />
  );
}
