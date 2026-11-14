import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works from any folder on a static host.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
