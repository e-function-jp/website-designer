import type { SiteConfig } from '../../../../lib/site';

/**
 * 軌道セールス設計株式会社 — 堅実路線コーポレートサイト。
 *
 * docs/quality/runs/corporate-20260916-0500/direction-a.html の
 * #site-config ブロックをそのまま写している。motion は
 * `_site.ts` の 1 箇所に集約し、ページ間で揃える。
 *
 * industry は SITE_RULES / ローテ判定が参照する従軸。BtoB 営業支援・
 * 営業組織コンサルティングなので 'ad'（制作・開発・企画・マーケティング・コンサル）を採用。
 */
export const site: SiteConfig = {
  name: '軌道セールス設計株式会社',
  tagline: '受注の型を、現場に残す',
  base: '/sites/corporate/a-20260916-0500/',
  theme: 'kido-corporate',
  nav: [
    { label: '私たちの支援方針', href: '/about/' },
    { label: '営業変革プログラム', href: '/service/' },
    { label: '会社概要', href: '/company/' },
    { label: '採用について', href: '/recruit/' },
    { label: 'お知らせ', href: '/news/' },
    { label: '支援実績', href: '/case/' },
  ],
  footerNav: [
    {
      heading: '営業変革の支援',
      items: [
        { label: '私たちの支援方針', href: '/about/' },
        { label: '営業変革プログラム', href: '/service/' },
        { label: '支援実績', href: '/case/' },
        { label: '無料で組織診断を申し込む', href: '/contact/' },
      ],
    },
    {
      heading: '企業情報',
      items: [
        { label: '会社概要', href: '/company/' },
        { label: '採用について', href: '/recruit/' },
        { label: 'お知らせ', href: '/news/' },
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
    durationMs: 600,
    staggerMs: 0,
    header: 'none',
    pageTransition: true,
  },
};

export default site;
