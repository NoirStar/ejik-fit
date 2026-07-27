import type {
  CommunityPostFeedItem,
  FeedItem,
  FeedTab,
} from "./types";

function isSocialItem(
  item: FeedItem,
): item is CommunityPostFeedItem {
  return item.type === "community_post";
}

function engagementScore(item: CommunityPostFeedItem) {
  return item.metrics.reactions + item.metrics.comments * 2 + item.metrics.saves;
}

function itemTime(item: FeedItem) {
  const value = isSocialItem(item)
    ? item.createdAt
    : item.type === "recommended_job"
      ? item.firstSeenAt
      : null;
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function itemsForTab(
  items: FeedItem[],
  tab: FeedTab,
  followedAuthorIds: string[] = [],
): FeedItem[] {
  const realItems = items.filter(
    (item) => !isSocialItem(item) || item.source === "server",
  );

  if (tab === "recommended") return realItems;

  if (tab === "following") {
    const followed = new Set(followedAuthorIds);
    return realItems.filter(
      (item) =>
        isSocialItem(item) && followed.has(item.authorId),
    );
  }

  if (tab === "latest") {
    return [...realItems].sort((left, right) => itemTime(right) - itemTime(left));
  }

  return realItems
    .filter(isSocialItem)
    .sort((left, right) => engagementScore(right) - engagementScore(left));
}
