/**
 * PostCSS config for the Net Vision web app.
 *
 * Tailwind v4 is configured via `@tailwindcss/postcss`. We intentionally
 * use the dedicated PostCSS plugin (not the legacy `tailwindcss` plugin)
 * because v4 ships a different compilation pipeline.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;