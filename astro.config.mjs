// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://estetikascr.com',
  publicDir: 'public',
  // URLs sin barra final, igual que Vercel (vercel.json: trailingSlash false)
  // y el sitemap: /tratamientos, no /tratamientos/. 'file' genera
  // tratamientos.html y las canónicas salen sin barra.
  trailingSlash: 'never',

  build: {
    assets: '_astro',
    format: 'file',
  },

  vite: {
    build: {
      assetsInlineLimit: 0,
    },

    plugins: [tailwindcss()],
  },

  integrations: [react()],
});