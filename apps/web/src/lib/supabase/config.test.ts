import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabasePublicConfig } from "./config";

describe("Supabase public config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the checked-in low-privilege public config when deployment env is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(getSupabasePublicConfig()).toEqual({
      url: "https://lsqwfrvwuxievitogucc.supabase.co",
      publishableKey: "sb_publishable_yvx5gTp5avhU4Yfpj2RITg_hib1CdUR",
    });
  });

  it("prefers a complete environment override", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co/");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_environment_override",
    );

    expect(getSupabasePublicConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_environment_override",
    });
  });

  it("fails closed instead of mixing a partial environment override with defaults", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(getSupabasePublicConfig()).toBeNull();
  });
});
