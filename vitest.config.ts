import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "tests/integration/**"],
          environment: "node",
        },
      },
      {
        // 실제 PostgreSQL을 쓴다. 먼저 docker compose up -d db
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          fileParallelism: false,
          environment: "node",
        },
      },
    ],
  },
});
