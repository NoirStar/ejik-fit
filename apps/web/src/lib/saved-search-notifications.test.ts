import { describe, expect, it } from "vitest";

import type { SavedJobSearch } from "./saved-job-searches";
import {
  flattenSavedSearchNotifications,
  type SavedSearchEvaluationGroup,
} from "./saved-search-notifications";
import type { PostingSummary } from "./types";

function posting(id: string, firstSeenAt: string): PostingSummary {
  return {
    id,
    title: `${id} title`,
    company_name: `${id} company`,
    career_type: null,
    employment_type: null,
    career_min: null,
    career_max: null,
    location: null,
    status: "open",
    source_url: `https://example.com/${id}`,
    first_seen_at: firstSeenAt,
    last_verified_at: "2026-07-20T04:00:00.000Z",
  };
}

function savedSearch(
  id: string,
  name: string,
  enabled = true,
): SavedJobSearch {
  return {
    id,
    userId: "user-1",
    name,
    query: name,
    category: "",
    careerType: "",
    filterKey: `${name.toLowerCase()}||`,
    enabled,
    lastCheckedAt: "2026-07-20T00:00:00.000Z",
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
  };
}

describe("saved search notification aggregation", () => {
  it("deduplicates jobs while retaining every matching saved search", () => {
    const sharedJob = posting(
      "shared-job",
      "2026-07-20T02:00:00.000Z",
    );
    const groups: SavedSearchEvaluationGroup[] = [
      {
        searchId: "search-1",
        status: "ready",
        total: 2,
        items: [
          sharedJob,
          posting("newest-job", "2026-07-20T03:00:00.000Z"),
        ],
      },
      {
        searchId: "failed-search",
        status: "error",
        total: null,
        items: [],
      },
      {
        searchId: "search-2",
        status: "ready",
        total: 1,
        items: [{ ...sharedJob }],
      },
    ];
    const searches = [
      savedSearch("search-1", "Python 백엔드"),
      savedSearch("search-2", "경력 백엔드"),
      savedSearch("failed-search", "실패한 검색"),
    ];

    const notifications = flattenSavedSearchNotifications(
      groups,
      searches,
      5,
    );

    expect(notifications.map((item) => item.job.id)).toEqual([
      "newest-job",
      "shared-job",
    ]);
    expect(notifications[1]?.searches).toEqual([
      { id: "search-1", name: "Python 백엔드" },
      { id: "search-2", name: "경력 백엔드" },
    ]);
    expect(
      flattenSavedSearchNotifications(groups, searches, 1),
    ).toHaveLength(1);
  });
});
