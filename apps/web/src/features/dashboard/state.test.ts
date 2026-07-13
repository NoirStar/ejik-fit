import { describe, expect, it } from "vitest";

import { dashboardStatus, settledResource } from "./state";

describe("dashboard resource state", () => {
  it("reports partial when one resource succeeds and another fails", () => {
    const ready = settledResource(Promise.resolve({ items: [1], total: 1 }));
    const failed = settledResource(Promise.reject(new Error("offline")));

    return Promise.all([ready, failed]).then((resources) => {
      expect(dashboardStatus(resources)).toBe("partial");
      expect(resources[1]).toMatchObject({ status: "error", retryable: true });
    });
  });

  it("reports empty when successful resources contain no items", async () => {
    const empty = await settledResource(Promise.resolve({ items: [], total: 0 }));

    expect(empty).toEqual({ status: "empty", reason: "no-data" });
    expect(dashboardStatus([empty])).toBe("empty");
  });
});
