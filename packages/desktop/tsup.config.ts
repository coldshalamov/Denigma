import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  target: "node22",
  platform: "node",
  external: ["electron"],
  sourcemap: true,
  clean: true,
});
