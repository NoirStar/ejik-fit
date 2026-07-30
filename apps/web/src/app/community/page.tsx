import type { Metadata } from "next";

import { loadInitialCommunityFeed } from "@/features/community/server-community-feed";
import { HomeFeed } from "@/features/home-feed/home-feed";
import { buildHomeFeedSnapshot } from "@/features/home-feed/model";
import {
  communityComposeMode,
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

const COMMUNITY_SNAPSHOT = buildHomeFeedSnapshot({
  postings: { status: "ready", data: { items: [], total: 0 } },
  skillStats: { status: "ready", data: { items: [], total: 0 } },
  fit: null,
  ownedSkills: [],
});

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialCommunityFeed = await loadInitialCommunityFeed(10);

  return (
    <HomeFeed
      communityOnly
      composeMode={communityComposeMode(resolvedSearchParams)}
      initialCommunityFeed={initialCommunityFeed}
      snapshot={COMMUNITY_SNAPSHOT}
    />
  );
}
