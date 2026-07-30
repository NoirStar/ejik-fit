import { describe, expect, it } from "vitest";

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists the canonical career-map route without the legacy route", () => {
    const urls = sitemap().map(({ url }) => url);

    expect(urls.some((url) => url.endsWith("/career-map"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/skill-map"))).toBe(false);
  });
});
