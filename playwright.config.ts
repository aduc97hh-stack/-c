import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url))
  throw new Error("E2E requires dedicated local Supabase on port 54321.");
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  use: {
    actionTimeout: 15000,
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 390, height: 844 },
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: {
      executablePath: existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined,
    },
  },
  webServer: {
    command: "npm start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
