import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      injectRegister: 'script-defer',
      registerType: 'prompt',
      manifest: {
        id: './',
        name: 'Multas CR Guindalera',
        short_name: 'Multas CRG',
        description: 'Multas y hucha del equipo sénior femenino del CR Guindalera.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#111d3b',
        background_color: '#f7f6f4',
        icons: [
          {
            src: 'iconos/icono-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'iconos/icono-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'iconos/icono-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: ['**/*.{html,js,css,png,jpg,woff2,webmanifest}'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
