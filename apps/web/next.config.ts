import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
