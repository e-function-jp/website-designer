import type { SiteConfig } from '../../../../lib/site';

/**
 * あおば矯正歯科クリニック — 堅実路線コーポレートサイト。
 *
 * docs/quality/runs/corporate-20260915-1151/direction-a.html の
 * #site-config ブロックをそのまま写している。motion は
 * `_site.ts` の 1 箇所に集約し、ページ間で揃える。
 *
 * industry は SITE_RULES / ローテ判定が参照する従軸。
 * あおば矯正歯科クリニックは歯科医院なので 'hospital'（医療・病院）を採用。
 */
export const site: SiteConfig = {
  name: 'あおば矯正歯科クリニック',
  tagline: '噛み合わせから整える矯正',
  base: '/sites/corporate/a-20260915-1151/',
  theme: 'aoba-corporate',
  nav: [
    { label: '当院について', href: '/about/' },
    { label: 'はじめての方へ', href: '/new-patients/' },
    { label: '矯正治療のご案内', href: '/service/' },
    { label: 'お知らせ', href: '/news/' },
  ],
  footerNav: [
    {
      heading: '医院を知る',
      items: [
        { label: 'トップページ', href: '/' },
        { label: '当院について', href: '/about/' },
        { label: '医院概要', href: '/about/#profile' },
        { label: 'お知らせ', href: '/news/' },
      ],
    },
    {
      heading: '矯正を相談する',
      items: [
        { label: 'はじめての方へ', href: '/new-patients/' },
        { label: '矯正治療のご案内', href: '/service/' },
        { label: '大人の矯正', href: '/service/#adult' },
        { label: '子どもの矯正', href: '/service/#child' },
        { label: '初診相談', href: '/contact/' },
      ],
    },
  ],
  organization: {
    legalName: 'あおば矯正歯科クリニック',
    address: '静岡県藤枝市',
    founded: '2011',
  },
  primaryCta: {
    label: '初診相談を予約する',
    href: '/contact/',
  },
  legalNav: [
    { label: '個人情報の取り扱い', href: '/privacy/' },
  ],
  industry: 'hospital',
  motion: {
    reveal: 'fade-up',
    durationMs: 900,
    staggerMs: 0,
    header: 'hide',
    pageTransition: false,
  },
};

export default site;