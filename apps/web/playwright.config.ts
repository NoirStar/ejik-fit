import { defineConfig } from "@playwright/test";

process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1", "localhost"]
  .filter(Boolean)
  .join(",");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  testIgnore: "performance-budget.e2e.ts",
  workers: 1,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3102",
    browserName: "chromium",
  },
  webServer: [
    {
      command: "node e2e/fixtures/test-api.mjs",
      url: "http://127.0.0.1:8011/api/postings",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command:
        "API_BASE_URL=http://127.0.0.1:8011 npm run dev -- --hostname 127.0.0.1 --port 3102",
      url: "http://127.0.0.1:3102/privacy",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
