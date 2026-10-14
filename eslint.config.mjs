import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  {
    // Flat config does not read .gitignore, so the side directories a deploy
    // or verification build leaves (.next-old, .next-new, .next-prod, ...) and
    // build:public's stash are listed here too.
    ignores: [
      ".next/**",
      ".next-*/**",
      ".public-build-stash/**",
      "out/**",
      "node_modules/**",
      "next-env.d.ts",
      "visual-qa-screenshots/**",
      "config/**",
      ".claude/**"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true
        }
      ]
    }
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
];

export default eslintConfig;
