import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
  test: {
    // Only pick up `.test.ts(x)` files in src — keeps node_modules out.
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: true,
    // Pure-function tests don't need the heavy Next runtime.
    pool: "threads",
    testTimeout: 10_000,
  },
});
