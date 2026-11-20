import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `VITE_BASE_PATH` lets the app be hosted under a sub-path (e.g. GitHub Pages: "/chainbeat/").
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  test: {
    // Testing Library needs React's development build (`React.act`). A machine that exports NODE_ENV=production
    // globally would otherwise make every component test fail with "React.act is not a function".
    env: { NODE_ENV: 'test' },
    // The first test of a file pays for importing a whole page and its charts; on a busy machine that exceeds 5 s.
    testTimeout: 20_000,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/i18n/locales/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
