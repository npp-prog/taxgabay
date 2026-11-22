import { defineConfig, devices } from "@playwright/test";

/**
 * Admin flows against a build whose Supabase URL is a fake host. The browser's calls to it
 * are answered by an in-test PostgREST mock (e2e/admin/mock-supabase.ts).
 */
const PORT = 3101;
const env = {
  NEXT_DIST_DIR: ".next-admin",
  NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
};

export default defineConfig({
  testDir: "./e2e/admin",
  fullyParallel: true,
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", ...devices["Desktop Chrome"] },
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env,
  },
});
