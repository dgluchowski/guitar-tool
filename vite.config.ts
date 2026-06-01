import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works under any path (e.g. GitHub Pages
  // project sites at /<repo>/) without hard-coding the repository name.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg', 'apple-touch-icon-180.png'],
      manifest: {
        name: 'Guitar Tool',
        short_name: 'GuitarTool',
        description:
          'Chords, scales, voicings, progressions, a tuner and a note-trainer for any tuning — 100% in your browser.',
        theme_color: '#1c1917',
        background_color: '#1c1917',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Cache the built app shell + assets for full offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
