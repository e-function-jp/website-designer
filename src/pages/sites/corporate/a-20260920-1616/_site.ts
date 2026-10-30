import type { SiteConfig } from '../../../../lib/site';

export const site: SiteConfig = {
  name: '株式会社ノクスレイ',
  tagline: '伝わる設計で、成果を積む。',
  base: '/sites/corporate/a-20260920-1616/',
  theme: 'noxray-corporate',
  nav: [
    { label: '私たちについて', href: '/about/' },
    { label: 'Web制作・改善運用', href: '/service/' },
    { label: '制作実績', href: '/works/' },
    { label: '資料・検討ガイド', href: '/download/' },
  ],
  footerNav: [
    {
      heading: '会社を知る',
      items: [{ label: '私たちについて', href: '/about/' }],
    },
    {
      heading: '依頼を検討する',
      items: [
        { label: 'Web制作・改善運用', href: '/service/' },
        { label: '制作実績', href: '/works/' },
        { label: '資料・検討ガイド', href: '/download/' },
        { label: '無料相談・見積もり', href: '/contact/' },
      ],
    },
  ],
  organization: {
    legalName: '株式会社ノクスレイ',
    address: '東京都渋谷区',
    founded: '2014',
  },
  primaryCta: { label: '無料相談・見積もり', href: '/contact/' },
  legalNav: [{ label: '個人情報の取り扱い', href: '/privacy/' }],
  motion: {
    reveal: 'zoom',
    durationMs: 2400,
    staggerMs: 0,
    header: 'shrink',
    pageTransition: false,
  },
  industry: 'ad',
};

export default site;
