import type { SiteConfig } from '../../../../lib/site';

export const site: SiteConfig = {
  name: '蒼紙舎株式会社',
  tagline: 'かたちで、意図を残す',
  base: '/sites/corporate/b-20260918-0500/',
  theme: 'aogami-corporate',
  industry: 'art',
  nav: [
    { label: '制作実績・制作例', href: '/projects/' },
    { label: '蒼紙舎について', href: '/about/' },
    { label: '視覚設計の仕事', href: '/service/' },
    { label: 'お知らせ', href: '/news/' },
    { label: '制作のご相談', href: '/contact/' },
  ],
  footerNav: [
    {
      heading: '蒼紙舎の仕事',
      items: [
        { label: '制作実績・制作例', href: '/projects/' },
        { label: '蒼紙舎について', href: '/about/' },
        { label: '視覚設計の仕事', href: '/service/' },
        { label: 'お知らせ', href: '/news/' },
        { label: '制作のご相談', href: '/contact/' },
      ],
    },
    {
      heading: 'さらに知る',
      items: [
        { label: '制作の背景', href: '/inspirations/' },
        { label: '採用について', href: '/recruit/' },
        { label: 'ご相談の前に', href: '/faq/' },
        { label: '会社案内', href: '/download/' },
      ],
    },
    { heading: '会社情報', items: [{ label: '会社概要', href: '/company/' }] },
  ],
  organization: { legalName: '蒼紙舎株式会社', address: '東京都台東区谷中', founded: '2011' },
  primaryCta: { label: '制作相談を申し込む', href: '/contact/' },
  legalNav: [{ label: '個人情報の取り扱い', href: '/privacy/' }],
  motion: {
    reveal: 'fade-up',
    durationMs: 1000,
    staggerMs: 0,
    header: 'hide',
    pageTransition: true,
  },
};

export default site;
