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

export function itemsForTab(items: FeedItem[], tab: FeedTab): FeedItem[] {
  if (tab === "recommended") return [...items];

  if (tab === "following") {
    return items.filter((item) => isSocialItem(item) && item.isFollowing);
  }

  if (tab === "latest") {
    return [...items].sort((left, right) => {
      const rightTime = isSocialItem(right) ? Date.parse(right.createdAt) : 0;
      const leftTime = isSocialItem(left) ? Date.parse(left.createdAt) : 0;
      return rightTime - leftTime;
    });
  }

  return items
    .filter(isSocialItem)
    .sort((left, right) => engagementScore(right) - engagementScore(left));
}
