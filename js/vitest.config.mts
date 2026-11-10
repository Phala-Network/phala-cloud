import { readFileSync } from "node:fs";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as {
  version: string;
};

export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    // Load environment variables from .env.test or other specified env file
    env: {
      // Try to load from environment file
      ...(() => {
        try {
          const dotenv = require("dotenv");
          // Check if a custom env file path is specified
          const envPath = process.env.DOTENV_CONFIG_PATH || ".env.test";
          const fullPath = resolve(__dirname, envPath);
          const result = dotenv.config({ path: fullPath });
          return result.parsed || {};
        } catch (error) {
          // If env file doesn't exist or dotenv fails, just return empty object
          return {};
        }
      })(),
    },
    // Default exclude pattern (integration tests run only when explicitly specified)
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Enable globals for mocking
    globals: true,
  },
});
