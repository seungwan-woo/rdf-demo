import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const base = process.env.BASE_PATH ?? (process.env.GITHUB_PAGES === 'true' ? '/rdf-demo/' : '/');

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'app.html'),
      },
    },
  },
});
