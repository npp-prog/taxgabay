import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["admin/**"],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      // Stand-in for the Claude API, so the assistant can be tested without a key or network.
      command: "node e2e/mock-anthropic.mjs",
      url: "http://localhost:3199",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm build && pnpm start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      // Local mode: no Supabase env, so e2e never touches a real backend.
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        ANTHROPIC_API_KEY: "test-key",
        ANTHROPIC_BASE_URL: "http://localhost:3199",
        // Nothing is CPA-verified yet; let the assistant use unverified content in tests.
        ASSISTANT_ALLOW_UNVERIFIED: "1",
      },
    },
  ],
});
