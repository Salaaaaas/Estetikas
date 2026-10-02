// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://estetikascr.com',
  publicDir: 'public',

  build: {
    assets: '_astro',
  },

  vite: {
    build: {
      assetsInlineLimit: 0,
    },

    plugins: [tailwindcss()],
  },

  integrations: [react()],
});