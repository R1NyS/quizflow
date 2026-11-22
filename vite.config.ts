import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  build: {
    cssMinify: false,
  },
  plugins: [
    react(),
    ...(mode === 'pwa'
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
            manifest: {
              name: 'QuizFlow — Карточки и тренажёр памяти',
              short_name: 'QuizFlow',
              description:
                'Бесплатное офлайн-приложение для изучения терминов, карточек и тестов',
              theme_color: '#4f46e5',
              background_color: '#0f172a',
              display: 'standalone',
              orientation: 'portrait-primary',
              lang: 'ru',
              start_url: '/',
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
                {
                  src: 'pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            },
          }),
        ]
      : []),
  ],
}));