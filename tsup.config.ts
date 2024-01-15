import type { Options } from "tsup";

const env = process.env.NODE_ENV;

export const tsup: Options = {
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: true,
  format: ["cjs", "esm"],
  minify: false,
  bundle: true,
  skipNodeModulesBundle: true,
  entryPoints: ["src/bplist/index.ts", "src/NSKeyedUnarchiver/index.ts"],
  watch: false,
  target: "node20",
  treeshake: true,
};
