import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages serves this repository from https://fknejdcwnfi.github.io/website/,
 * so production builds default to a `/website/` base path.
 *
 * Override it when the site moves to a custom domain or another host:
 *
 *   VITE_BASE=/ npm run build
 */
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/website/' : '/'),
  plugins: [react()],
  build: {
    target: 'es2022',
    // Keep image URLs as files: they are preloaded and decoded individually.
    assetsInlineLimit: 0,
  },
}))