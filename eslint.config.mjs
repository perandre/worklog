import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      "worklog-next/**",
      "tmp/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Many integrations wrap untyped third-party REST APIs (Google, Slack,
      // Jira, HubSpot, …). `any` at those boundaries is pragmatic; surface it
      // as a warning to burn down incrementally rather than blocking CI.
      "@typescript-eslint/no-explicit-any": "warn",
      // The OAuth "connect" links intentionally use <a> to hit server API
      // routes (e.g. /api/auth/slack) that 302-redirect to the provider.
      // <Link> is for page navigation and would break this flow.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]

export default eslintConfig
