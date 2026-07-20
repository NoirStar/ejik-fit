import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

const ROUTES = [
  "",
  "/market",
  "/skill-map",
  "/career",
  "/career/calendar",
  "/jobs",
  "/skills/graph",
  "/data-policy",
  "/methodology",
  "/privacy",
  "/corrections",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ROUTES.map((route) => ({ url: `${base}${route}` }));
}
