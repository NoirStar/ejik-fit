const LOCAL_SITE_URL = "http://localhost:3000";

export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error("NEXT_PUBLIC_SITE_URL must use http or https.");
    }
    return url.toString().replace(/\/$/, "");
  }

  if (process.env.VERCEL_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in Vercel production.");
  }

  return LOCAL_SITE_URL;
}
