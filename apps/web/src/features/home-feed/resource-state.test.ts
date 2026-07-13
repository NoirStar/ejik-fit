import { describe, expect, it, vi } from "vitest";

import { settledResource } from "./resource-state";

describe("settledResource", () => {
  it("returns a safe public error without exposing the rejected URL", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await settledResource(
      Promise.reject(
        new Error("API request failed: http://internal-api:8000/api/postings (503)"),
      ),
      "공고 데이터를 불러오지 못했습니다.",
    );

    expect(result).toEqual({
      status: "error",
      message: "공고 데이터를 불러오지 못했습니다.",
    });
    expect(JSON.stringify(result)).not.toContain("internal-api");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
