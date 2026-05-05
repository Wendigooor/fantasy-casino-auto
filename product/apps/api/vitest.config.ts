import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "threads",
    env: {
      NODE_ENV: "test",
    },
  },
});
