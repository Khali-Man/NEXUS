import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    env: {
      OSRM_BASE_URL: "",
      DATABASE_URL:
        process.env.NEXUS_TEST_DATABASE_URL ||
        "postgresql://nexus:nexus-local-only@127.0.0.1:55432/nexus_test",
    },
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
