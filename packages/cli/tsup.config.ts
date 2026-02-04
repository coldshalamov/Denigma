import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["cjs"],
  target: "es2022",
  sourcemap: true,
  dts: false,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});

