import { defineConfig } from "vitest/config";

// Pure logic only (store core, calculator view models): no React Native runtime needed.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
