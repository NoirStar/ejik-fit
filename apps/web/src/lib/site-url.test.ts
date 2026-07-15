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

  it("uses Vercel's production domain when the explicit URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ejik-fit-web.vercel.app");

    expect(siteUrl()).toBe("https://ejik-fit-web.vercel.app");
  });

  it("falls back to the deployment domain for older Vercel projects", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "ejik-fit-preview.vercel.app");

    expect(siteUrl()).toBe("https://ejik-fit-preview.vercel.app");
  });
});
