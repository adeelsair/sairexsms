import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/admin/**/*.{js,jsx,ts,tsx}", "components/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/bg-white/]",
          message: "Use bg-surface or bg-background tokens instead of bg-white.",
        },
        {
          selector: "Literal[value=/text-gray-/]",
          message: "Use text-muted or text-foreground tokens instead of text-gray-*.",
        },
        {
          selector: "Literal[value=/border-gray-/]",
          message: "Use border-border token instead of border-gray-*.",
        },
        {
          selector: "Literal[value=/bg-blue-/]",
          message: "Use bg-primary for actions instead of bg-blue-*.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
