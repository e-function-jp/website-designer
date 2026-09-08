import type { SiteConfig } from '../../../../lib/site';

/**
 * ベースラインのコーポレートサイト定義。
 *
 * これは「学習前の基準点」であり、意匠を競う対象ではない。
 * 参照学習ラン（a案/b案）はこのサイトを上回ることを目標にする。
 * lp-designer でいう `base-20260328-0000` に相当する。
 */
export const site: SiteConfig = {
  name: 'ミナモト精機',
  tagline: '精密加工で、ものづくりの前提を変える',
  base: '/sites/corporate/base-20260903-1400/',
  theme: 'corporate-minamoto',
  nav: [
    { label: '会社について', href: '/about/' },
    { label: '事業・技術', href: '/service/' },
    { label: 'ニュース', href: '/news/' },
    { label: 'お問い合わせ', href: '/contact/' },
  ],
  footerNav: [
    {
      heading: '会社について',
      items: [
        { label: '代表挨拶・沿革', href: '/about/' },
        { label: 'プライバシーポリシー', href: '/privacy/' },
      ],
    },
    {
      heading: '事業・技術',
      items: [
        { label: '事業内容', href: '/service/' },
        { label: '設備一覧', href: '/service/#facility' },
      ],
    },
    {
      heading: 'お知らせ・窓口',
      items: [
        { label: 'ニュース一覧', href: '/news/' },
        { label: 'お問い合わせ', href: '/contact/' },
      ],
    },
  ],
  organization: {
    legalName: '株式会社ミナモト精機',
    address: '〒939-8214 富山県富山市黒崎 3-12-8',
    tel: '076-000-0000',
    email: 'info@example.com',
    founded: '1974-04',
  },
  primaryCta: { label: 'お問い合わせ', href: '/contact/' },
  // モーション方針はサイト全体で1箇所に持つ。ページごとに決めない。
  // 参照サイト解析（scripts/web-analyze-reference-motion.mjs）の
  // direction_hints をそのまま写せる語彙にしてある。
  motion: {
    reveal: 'fade-up',
    durationMs: 700,
    staggerMs: 90,
    header: 'solid',
    pageTransition: false,
  },
  // 参照業種: ミナモト精機は精密加工のメーカー（暮らし・インフラ・工業・メーカー）。
  // 学習前の基準点として、tasks/20260909-industry-rotation-and-top-cards.md で指定。
  industry: 'company',
  legalNav: [{ label: 'プライバシーポリシー', href: '/privacy/' }],
};

export default site;
