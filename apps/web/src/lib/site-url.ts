const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(value: string, source: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${source} must use http or https.`);
  }
  return url.toString().replace(/\/$/, "");
}

export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return normalizeSiteUrl(configured, "NEXT_PUBLIC_SITE_URL");
  }

  if (process.env.VERCEL_ENV === "production") {
    const vercelDomain =
      process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
      process.env.VERCEL_URL?.trim();
    if (vercelDomain) {
      const vercelUrl = /^https?:\/\//i.test(vercelDomain)
        ? vercelDomain
        : `https://${vercelDomain}`;
      return normalizeSiteUrl(vercelUrl, "Vercel site URL");
    }

    throw new Error(
      "NEXT_PUBLIC_SITE_URL or a Vercel system site URL is required in production.",
    );
  }

  return LOCAL_SITE_URL;
}
