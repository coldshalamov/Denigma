import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@denigma/core": resolve(here, "../core/src/index.ts"),
      "@denigma/server": resolve(here, "../server/src/index.ts"),
    },
  },
});
