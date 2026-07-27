import type {
  CommunityPostFeedItem,
  FeedItem,
  MarketInsightFeedItem,
  RecommendedJobFeedItem,
} from "./types";

export const HOME_FEED_PAGE_SIZE = 10;

export function interleaveHomeSources({
  community,
  jobs,
  insights = [],
}: {
  community: CommunityPostFeedItem[];
  jobs: RecommendedJobFeedItem[];
  insights?: MarketInsightFeedItem[];
}): FeedItem[] {
  const real: FeedItem[] = [];
  let communityIndex = 0;
  let jobIndex = 0;

  while (communityIndex < community.length || jobIndex < jobs.length) {
    if (communityIndex < community.length) {
      real.push(community[communityIndex]);
      communityIndex += 1;
    }
    for (
      let count = 0;
      count < 2 && jobIndex < jobs.length;
      count += 1
    ) {
      real.push(jobs[jobIndex]);
      jobIndex += 1;
    }
    if (communityIndex >= community.length) {
      while (jobIndex < jobs.length) {
        real.push(jobs[jobIndex]);
        jobIndex += 1;
      }
    }
    if (jobIndex >= jobs.length) {
      while (communityIndex < community.length) {
        real.push(community[communityIndex]);
        communityIndex += 1;
      }
    }
  }

  const result = [...real];
  if (insights[0]) result.splice(Math.min(2, result.length), 0, insights[0]);
  if (insights[1]) result.splice(Math.min(7, result.length), 0, insights[1]);
  return result;
}

export function takeUniqueFeedPage(
  queue: FeedItem[],
  seen: ReadonlySet<string>,
  limit = HOME_FEED_PAGE_SIZE,
) {
  const items: FeedItem[] = [];
  const remaining: FeedItem[] = [];
  const pageSeen = new Set(seen);

  for (const item of queue) {
    if (pageSeen.has(item.id)) continue;
    if (items.length < limit) {
      items.push(item);
      pageSeen.add(item.id);
    } else {
      remaining.push(item);
    }
  }
  return { items, remaining };
}
