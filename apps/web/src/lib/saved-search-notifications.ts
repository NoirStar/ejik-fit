import type { SavedJobSearch } from "./saved-job-searches";
import type { PostingSummary } from "./types";

export type SavedSearchEvaluationGroup =
  | {
      searchId: string;
      status: "ready";
      total: number;
      items: PostingSummary[];
    }
  | {
      searchId: string;
      status: "error";
      total: null;
      items: [];
    };

export type SavedSearchEvaluationResponse = {
  evaluatedAt: string;
  groups: SavedSearchEvaluationGroup[];
};

export type SavedSearchEvaluationState =
  | { status: "idle"; groups: []; error: "" }
  | {
      status: "loading";
      groups: SavedSearchEvaluationGroup[];
      error: "";
    }
  | { status: "ready"; groups: SavedSearchEvaluationGroup[]; error: "" }
  | {
      status: "partial";
      groups: SavedSearchEvaluationGroup[];
      error: string;
    }
  | { status: "error"; groups: []; error: string };

export type SavedSearchNotification = {
  job: PostingSummary;
  searches: Array<Pick<SavedJobSearch, "id" | "name">>;
};

function discoveredAt(posting: PostingSummary) {
  if (!posting.first_seen_at) return Number.NEGATIVE_INFINITY;
  const value = Date.parse(posting.first_seen_at);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

export function flattenSavedSearchNotifications(
  groups: SavedSearchEvaluationGroup[],
  searches: SavedJobSearch[],
  limit: number,
): SavedSearchNotification[] {
  const searchById = new Map(
    searches.map((search) => [
      search.id,
      { id: search.id, name: search.name },
    ]),
  );
  const notificationByJobId = new Map<string, SavedSearchNotification>();

  for (const group of groups) {
    if (group.status !== "ready") continue;
    const search = searchById.get(group.searchId);
    if (!search) continue;

    for (const job of group.items) {
      const existing = notificationByJobId.get(job.id);
      if (existing) {
        if (!existing.searches.some((item) => item.id === search.id)) {
          existing.searches.push(search);
        }
        continue;
      }
      notificationByJobId.set(job.id, {
        job,
        searches: [search],
      });
    }
  }

  const boundedLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 0;
  return [...notificationByJobId.values()]
    .sort((left, right) => discoveredAt(right.job) - discoveredAt(left.job))
    .slice(0, boundedLimit);
}
