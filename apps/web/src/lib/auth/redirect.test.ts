import { describe, expect, it } from "vitest";

import { safeAuthNextPath } from "./redirect";

describe("safeAuthNextPath", () => {
  it("keeps an internal path with its query and hash", () => {
    expect(safeAuthNextPath("/career/saved?stage=applied#current")).toBe(
      "/career/saved?stage=applied#current",
    );
  });

  it.each([
    undefined,
    "",
    "career",
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "/%5cevil.example/steal",
    "/\nlocation",
  ])("falls back for unsafe redirect input %s", (value) => {
    expect(safeAuthNextPath(value)).toBe("/career");
  });
});
