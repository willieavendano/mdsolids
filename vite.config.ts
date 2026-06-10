import { defineConfig } from "vite";

// On GitHub Pages the site is served from /<repo>/. Locally we want "/".
// Set BASE_PATH in CI (the deploy workflow sets it to "/mdsolids/").
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  build: {
    outDir: "dist",
    target: "es2021",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
