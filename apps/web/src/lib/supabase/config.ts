export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

// Supabase publishable keys identify a public client and do not bypass RLS.
// Keeping this default makes authentication survive a missing Vercel public env;
// a complete environment pair still overrides it for previews or migrations.
const DEFAULT_PUBLIC_CONFIG: SupabasePublicConfig = {
  url: "https://lsqwfrvwuxievitogucc.supabase.co",
  publishableKey: "sb_publishable_yvx5gTp5avhU4Yfpj2RITg_hib1CdUR",
};

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const environmentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const environmentKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const hasEnvironmentUrl = Boolean(environmentUrl);
  const hasEnvironmentKey = Boolean(environmentKey);

  if (hasEnvironmentUrl !== hasEnvironmentKey) return null;

  const url = environmentUrl || DEFAULT_PUBLIC_CONFIG.url;
  const publishableKey = environmentKey || DEFAULT_PUBLIC_CONFIG.publishableKey;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return null;
    }
  } catch {
    return null;
  }

  return { url: url.replace(/\/$/, ""), publishableKey };
}
