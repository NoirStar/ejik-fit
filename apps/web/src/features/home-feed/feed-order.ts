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

export function appendOnlyItemsForTab(
  items: FeedItem[],
  tab: FeedTab,
  previousOrderIds: string[],
  followedAuthorIds: string[] = [],
) {
  const ranked = itemsForTab(items, tab, followedAuthorIds);
  const byId = new Map(ranked.map((item) => [item.id, item]));
  const orderIds = previousOrderIds.filter((id) => byId.has(id));
  const retained = new Set(orderIds);

  for (const item of ranked) {
    if (retained.has(item.id)) continue;
    orderIds.push(item.id);
    retained.add(item.id);
  }

  return {
    items: orderIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    }),
    orderIds,
  };
}
