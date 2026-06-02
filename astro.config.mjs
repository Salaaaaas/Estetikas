// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  publicDir: 'public',
  build: {
    assets: '_astro',
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});
