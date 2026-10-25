import { defineConfig, devices } from "@playwright/test";

// Runs against a seeded database (`npm run db:seed`) and a production build (`npm run build`).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure", launchOptions: { executablePath } },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm start", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath } }, grep: /@mobile/ },
  ],
});
