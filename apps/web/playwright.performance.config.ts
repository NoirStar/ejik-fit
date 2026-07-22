import { defineConfig } from "@playwright/test";

process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1", "localhost"]
  .filter(Boolean)
  .join(",");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "performance-budget.e2e.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3103",
    browserName: "chromium",
  },
  webServer: [
    {
      command: "node e2e/fixtures/test-api.mjs",
      url: "http://127.0.0.1:8011/api/postings",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "API_BASE_URL=http://127.0.0.1:8011 node e2e/fixtures/start-standalone.mjs",
      url: "http://127.0.0.1:3103/privacy",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
