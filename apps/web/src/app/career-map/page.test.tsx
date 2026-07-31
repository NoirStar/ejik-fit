import { expect, it } from "vitest";

import { metadata } from "./page";

it("publishes career-map as the canonical route", () => {
  expect(metadata.alternates).toEqual({ canonical: "/career-map" });
  expect(metadata.title).toBe("커리어 방향 비교");
});
