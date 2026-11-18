import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8787",
    ...devices["iPhone 13"],
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run db:local && npm run dev",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
