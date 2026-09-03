// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // canonical / og:url / sitemap 生成用の本番ドメイン。
  // website-designer では LP と違い「サイト全体で URL が閉じているか」を
  // 品質チェックが見るため、site の設定は必須扱い。
  site: 'https://website.e-function.site',
  // 多ページサイトを扱うので sitemap.xml は必須。seo-sitemap-robots が検査する。
  integrations: [sitemap()],
  server: {
    host: true,
    allowedHosts: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
