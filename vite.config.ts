import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { site } from './src/features/profile/content/site.ts'
import { escapeHtml, renderStaticSite } from './src/features/profile/content/staticMarkup.ts'

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
  plugins: [react(), {
    name: 'personal-site-static-content',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace('<!--site-fallback-->', renderStaticSite(site, '%BASE_URL%'))
        .replaceAll('__SITE_TITLE__', escapeHtml(`${site.name} · 個人網站`))
        .replaceAll('__SITE_DESCRIPTION__', escapeHtml(`${site.intro}｜${site.name} 的個人網站，收藏程式作品、像素動態實驗與新的想法。`))
        .replaceAll('__SITE_HANDLE__', escapeHtml(site.handle)),
    },
  }],
  build: {
    target: 'es2022',
    // Keep image URLs as files: they are preloaded and decoded individually.
    assetsInlineLimit: 0,
  },
}))
