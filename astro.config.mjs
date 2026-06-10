// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://estetikas.vercel.app',
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
