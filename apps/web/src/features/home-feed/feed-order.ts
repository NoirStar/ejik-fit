import type {
  CommunityPostFeedItem,
  FeedItem,
  FeedTab,
  InterviewReviewFeedItem,
} from "./types";

function isSocialItem(
  item: FeedItem,
): item is CommunityPostFeedItem | InterviewReviewFeedItem {
  return item.type === "community_post" || item.type === "interview_review";
}

function engagementScore(
  item: CommunityPostFeedItem | InterviewReviewFeedItem,
) {
  return item.metrics.reactions + item.metrics.comments * 2 + item.metrics.saves;
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
    return [...realItems].sort((left, right) => {
      const rightTime = isSocialItem(right) ? Date.parse(right.createdAt) : 0;
      const leftTime = isSocialItem(left) ? Date.parse(left.createdAt) : 0;
      return rightTime - leftTime;
    });
  }

  return realItems
    .filter(isSocialItem)
    .sort((left, right) => engagementScore(right) - engagementScore(left));
}
