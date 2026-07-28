import type {
  FeedItem,
  RecommendedJobFeedItem,
} from "./types";

type NonJobFeedItem = Exclude<FeedItem, RecommendedJobFeedItem>;

export type FeedDisplayGroup =
  | { kind: "item"; item: NonJobFeedItem }
  | { kind: "jobs"; items: RecommendedJobFeedItem[] };

export function groupFeedForDisplay(items: FeedItem[]): FeedDisplayGroup[] {
  const groups: FeedDisplayGroup[] = [];

  for (const item of items) {
    const previous = groups.at(-1);
    if (item.type === "recommended_job") {
      if (previous?.kind === "jobs") {
        previous.items.push(item);
      } else {
        groups.push({ kind: "jobs", items: [item] });
      }
      continue;
    }

    groups.push({ kind: "item", item });
  }

  return groups;
}
