import { describe, expect, it } from "vitest";

import { MOCK_SOCIAL_ITEMS } from "./mock-community";
import { MOCK_POST_DETAILS } from "./mock-post-details";

describe("mock post details", () => {
  it("provides a complete detail fixture for every social feed item", () => {
    expect(Object.keys(MOCK_POST_DETAILS).sort()).toEqual(
      MOCK_SOCIAL_ITEMS.map((item) => item.id).sort(),
    );

    for (const item of MOCK_SOCIAL_ITEMS) {
      const detail = MOCK_POST_DETAILS[item.id];
      expect(detail.paragraphs.length).toBeGreaterThanOrEqual(2);
      expect(detail.paragraphs.every((paragraph) => paragraph.trim().length > 0)).toBe(
        true,
      );
      expect(detail.relatedPostIds).not.toContain(item.id);
      expect(
        detail.relatedPostIds.every((id) =>
          MOCK_SOCIAL_ITEMS.some((candidate) => candidate.id === id),
        ),
      ).toBe(true);
    }
  });

  it("uses unique related-guide ids", () => {
    for (const detail of Object.values(MOCK_POST_DETAILS)) {
      expect(new Set(detail.relatedPostIds).size).toBe(
        detail.relatedPostIds.length,
      );
    }
  });
});
