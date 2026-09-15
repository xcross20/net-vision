import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Repo-root vitest config — runs all apps/web tests with the alias that
// apps/web's own tsconfig.json declares ("@" → apps/web).
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const appsWebRoot = path.join(repoRoot, 'apps', 'web');

export default defineConfig({
  resolve: {
    alias: {
      '@': appsWebRoot,
    },
  },
  test: {
    passWithNoTests: true,
    environment: 'node',
    // Component tests that need DOM APIs opt into happy-dom per-file
    // via `// @vitest-environment happy-dom`.
    include: ['apps/web/**/*.{test,spec}.{ts,tsx}'],
  },
  esbuild: {
    jsx: 'automatic',
  },
});