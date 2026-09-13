import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Resolve alias from this config file's own location so tests work
// whether vitest is invoked from the repo root or from apps/web.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
  test: {
    passWithNoTests: true,
    environment: 'node',
    // Component tests that need DOM APIs opt into happy-dom per-file
    // via `// @vitest-environment happy-dom`.
  },
  esbuild: {
    jsx: 'automatic',
  },
});
