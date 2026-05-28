import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "worklog-next/**"],
  },
})
