import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/WGameDevTools/', // Base path para GitHub Pages
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'pwa-icon.svg'],
          manifest: {
            name: 'Wellinton Game Dev Tools',
            short_name: 'WGameTools',
            description: 'Suite de ferramentas para desenvolvimento de jogos: Pixel Art, Sprites, Video Tools.',
            theme_color: '#0f172a',
            background_color: '#0f172a',
            display: 'standalone',
            start_url: '/WGameDevTools/',
            scope: '/WGameDevTools/',
            orientation: 'portrait',
            icons: [
              {
                src: 'pwa-icon.svg',
                sizes: '192x192 512x512',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
