import type { SiteConfig } from '../../../../lib/site';

/**
 * あおば矯正歯科クリニック — 冒険路線 b 案コーポレートサイト。
 *
 * docs/quality/runs/corporate-20260915-1151/direction-b.html の
 * #site-config ブロックをそのまま写している。motion は
 * `_site.ts` の 1 箇所に集約し、ページ間で揃える。
 *
 * direction-b の theme 指定 "business" は DaisyUI 内蔵テーマ名に該当するため
 * （scripts/web-quality-check.mjs の consist-default-theme が内蔵名を一律
 * ブロック）、カスタム名 `aoba-corporate-b` に置換し、
 * src/styles/themes/aoba-corporate-b.css に配色（青 #365F78 / 砂 #D9C7A3）
 * を定義している。
 *
 * industry は SITE_RULES / ローテ判定が参照する従軸。あおば矯正歯科クリニック
 * は矯正歯科医院なので 'hospital'（医療・病院）を採用。
 */
export const site: SiteConfig = {
  name: 'あおば矯正歯科クリニック',
  tagline: '噛み合わせから整える矯正',
  base: '/sites/corporate/b-20260915-1151/',
  theme: 'aoba-corporate-b',
  nav: [
    { label: '当院について', href: '/about/' },
    { label: '矯正治療について', href: '/service/' },
    { label: 'お知らせ', href: '/news/' },
    { label: '初診相談・来院案内', href: '/contact/' },
  ],
  footerNav: [
    {
      heading: '医院を知る',
      items: [
        { label: 'トップページ', href: '/' },
        { label: '当院について', href: '/about/' },
        { label: '医院概要', href: '/about/#overview' },
        { label: 'お知らせ', href: '/news/' },
      ],
    },
    {
      heading: '矯正を知る',
      items: [
        { label: '子どもの矯正', href: '/service/#children' },
        { label: '大人の矯正', href: '/service/#adults' },
        { label: '相談から治療まで', href: '/service/#flow' },
      ],
    },
    {
      heading: '相談する',
      items: [
        { label: '初診相談・来院案内', href: '/contact/' },
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
    href: '/contact/#consultation',
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
