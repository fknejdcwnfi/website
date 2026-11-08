import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { site } from './src/features/profile/content/site.ts'
import { escapeHtml, renderStaticSite } from './src/features/profile/content/staticMarkup.ts'
import { protectStaticHtml } from './scripts/build/securityPolicy.ts'

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
        .replaceAll('__SITE_TITLE__', escapeHtml(`${site.name} · 个人网站`))
        .replaceAll('__SITE_DESCRIPTION__', escapeHtml(`${site.intro}｜${site.name} 的个人网站，记录作品、动漫兴趣、游戏内容与新的想法。`))
        .replaceAll('__SITE_HANDLE__', escapeHtml(site.handle)),
    },
  }, {
    name: 'static-security-policy',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: protectStaticHtml },
  }],
  build: {
    target: 'es2020',
    // Keep image URLs as files: they are preloaded and decoded individually.
    assetsInlineLimit: 0,
  },
}))
