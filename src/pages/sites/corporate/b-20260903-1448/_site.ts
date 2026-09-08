import type { SiteConfig } from '../../../../lib/site';

/**
 * 北嶺ニュートリション株式会社 — 冒険路線コーポレートサイト。
 *
 * docs/quality/runs/corporate-20260903-1448/direction-b.html の
 * #site-config ブロックをほぼそのまま写している。motion は
 * `_site.ts` の 1 箇所に集約し、ページ間で揃える。
 *
 * 冒険路線の踏み込み:
 *   - 独自テーマ corporate-hokuline-bold を採用（深い藍 + 苔色 + 雪白 + 凍土）
 *   - ヘッダー挙動を 'solid' にし、ヒーロー透過 → スクロール後 #0E2A47 帯
 *   - 全ページ均等モーション（fade-up 700ms / stagger 90ms）
 */
export const site: SiteConfig = {
  name: '北嶺ニュートリション株式会社',
  tagline: '動く体に、確かな補給を',
  base: '/sites/corporate/b-20260903-1448/',
  theme: 'corporate-hokuline-bold',
  nav: [
    { label: '会社について', href: '/about/' },
    { label: '製品ライン', href: '/service/' },
    { label: 'お知らせ', href: '/news/' },
    { label: '採用情報', href: '/recruit/' },
    { label: 'お問い合わせ', href: '/contact/' },
  ],
  footerNav: [
    {
      heading: '北嶺について',
      items: [
        { label: 'ブランド理念', href: '/about/#philosophy' },
        { label: '代表メッセージ', href: '/about/#message' },
        { label: '沿革', href: '/about/#history' },
        { label: '会社概要', href: '/company/' },
      ],
    },
    {
      heading: '製品ライン',
      items: [
        { label: 'トレーニング向けプロテイン', href: '/service/#protein' },
        { label: 'リカバリー食品', href: '/service/#recovery' },
        { label: '機能性スナック', href: '/service/#snack' },
        { label: '直営店舗と EC', href: '/service/#store' },
      ],
    },
    {
      heading: 'お知らせ・窓口',
      items: [
        { label: 'お知らせ一覧', href: '/news/' },
        { label: '採用情報', href: '/recruit/' },
        { label: 'お問い合わせ', href: '/contact/' },
        { label: 'プライバシーポリシー', href: '/privacy/' },
      ],
    },
  ],
  organization: {
    legalName: '北嶺ニュートリション株式会社',
    address: '〒070-0030 北海道旭川市宮下通 9-2-14',
    tel: '0166-00-0000',
    email: 'info@example.com',
    founded: '2015-04',
    url: 'https://example.com',
  },
  primaryCta: { label: '製品ラインを見る', href: '/service/' },
  legalNav: [{ label: 'プライバシーポリシー', href: '/privacy/' }],
  // 参照業種: 北嶺ニュートリションはスポーツ栄養食のメーカー。
  // tasks/20260909-industry-rotation-and-top-cards.md で 'company' 指定。
  industry: 'company',
  motion: {
    reveal: 'fade-up',
    durationMs: 700,
    staggerMs: 90,
    header: 'solid',
    pageTransition: false,
  },
};

export default site;
