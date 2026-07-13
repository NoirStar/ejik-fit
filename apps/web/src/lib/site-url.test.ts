import { afterEach, describe, expect, it, vi } from "vitest";

import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses localhost outside Vercel production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("normalizes the configured production URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ejikfit.example/");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(siteUrl()).toBe("https://ejikfit.example");
  });

  it("does not use localhost when the production URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
