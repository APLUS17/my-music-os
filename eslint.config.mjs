import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored copy of the minimal editor app (see src/lyriq/VENDORED.md). It is typechecked and
    // tested, but it was written against different lint rules, so we don't lint it here.
    "src/lyriq/**",
  ]),
]);

export default eslintConfig;
