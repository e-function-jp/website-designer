import type { SiteConfig } from '../../../../lib/site';

/**
 * 軌道セールス設計株式会社 — 冒険路線 b 案コーポレートサイト。
 *
 * docs/quality/runs/corporate-20260916-0500/direction-b.html の
 * #site-config ブロックをそのまま写している。motion は
 * `_site.ts` の 1 箇所に集約し、ページ間で揃える。
 *
 * direction-b の theme 指定 "business" は DaisyUI 内蔵テーマ名に該当するため
 * （scripts/web-quality-check.mjs の consist-default-theme が内蔵名を一律
 * ブロック）、カスタム名 `kido-corporate-b` に置換し、
 * src/styles/themes/kido-corporate-b.css に配色（濃紺 #26394B / 金 #E7B86D）を
 * 定義している。
 *
 * industry は SITE_RULES / ローテ判定が参照する従軸。BtoB 営業支援・
 * 営業組織コンサルティングなので 'ad'（制作・開発・企画・マーケティング・コンサル）を採用。
 */
export const site: SiteConfig = {
  name: '軌道セールス設計株式会社',
  tagline: '受注の型を、現場に残す',
  base: '/sites/corporate/b-20260916-0500/',
  theme: 'kido-corporate-b',
  nav: [
    { label: '営業変革プログラム', href: '/service/' },
    { label: '私たちの営業設計', href: '/about/' },
    { label: '会社概要', href: '/company/' },
    { label: 'お知らせ', href: '/news/' },
  ],
  footerNav: [
    {
      heading: '支援について',
      items: [
        { label: '営業変革プログラム', href: '/service/' },
        { label: '私たちの営業設計', href: '/about/' },
      ],
    },
    {
      heading: '企業情報',
      items: [
        { label: '会社概要', href: '/company/' },
        { label: 'お知らせ', href: '/news/' },
      ],
    },
    {
      heading: 'ご相談',
      items: [
        { label: '無料で組織診断を申し込む', href: '/contact/' },
      ],
    },
  ],
  organization: {
    legalName: '軌道セールス設計株式会社',
    address: '東京都港区',
    founded: '2016',
  },
  primaryCta: {
    label: '無料で組織診断を申し込む',
    href: '/contact/',
  },
  legalNav: [
    { label: '個人情報の取り扱い', href: '/privacy/' },
  ],
  industry: 'ad',
  motion: {
    reveal: 'fade-up',
    durationMs: 700,
    staggerMs: 0,
    header: 'none',
    pageTransition: true,
  },
};

export default site;