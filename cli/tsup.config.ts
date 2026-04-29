import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { tsconfig: "tsconfig.build.json" },
  sourcemap: true,
  clean: true,
  tsconfig: "tsconfig.build.json",
  banner: { js: "#!/usr/bin/env node" },
});
