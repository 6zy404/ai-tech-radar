import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "node",
    // `scripts/**` is included for the launcher helpers, which must be plain
    // `.mjs`: they run before any TypeScript tooling exists in the process.
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"]
  }
});
