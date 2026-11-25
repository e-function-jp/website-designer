import type { SiteConfig } from '../../../../lib/site';

const nav: SiteConfig['nav'] = [
  { label: '企業情報', href: '/company/', children: [
    { label: '代表メッセージ', href: '/company/message/' },
    { label: '私たちの使命', href: '/company/mission/' },
    { label: '会社概要・組織', href: '/company/outline/' },
  ] },
  { label: '事業紹介', href: '/business/' },
  { label: 'プレスルーム', href: '/press/', children: [
    { label: 'ニュース', href: '/press/news/' },
    { label: 'プレスキット', href: '/press/presskit/' },
    { label: '公開データ', href: '/press/opendata/' },
  ] },
  { label: 'お問い合わせ', href: '/contact/' },
  { label: '採用情報', href: import.meta.env.PUBLIC_JUNRO_CAREERS_URL },
];

export const site: SiteConfig = {
  name: '巡路知能株式会社',
  tagline: 'まちの設備を、止めない。',
  base: '/sites/corporate/b-20261124-1613/',
  theme: 'junro-ivory-b',
  industry: 'technology',
  nav,
  footerNav: [
    { heading: 'サイト', items: nav.map(({ label, href }) => ({ label, href })) },
    { heading: '外部媒体', items: [
      { label: '巡路ジャーナル', href: import.meta.env.PUBLIC_JUNRO_JOURNAL_URL },
      { label: '巡路 採用広報', href: import.meta.env.PUBLIC_JUNRO_RECRUIT_NOTE_URL },
      { label: '巡路 Tech Blog', href: import.meta.env.PUBLIC_JUNRO_TECH_BLOG_URL },
    ] },
  ],
  organization: { legalName: '巡路知能株式会社', address: '福岡県福岡市', founded: '2018' },
  legalNav: [
    { label: 'プライバシーポリシー', href: import.meta.env.PUBLIC_JUNRO_PRIVACY_URL },
    { label: '情報セキュリティポリシー', href: import.meta.env.PUBLIC_JUNRO_INFO_SECURITY_URL },
    { label: 'セキュリティについて', href: import.meta.env.PUBLIC_JUNRO_SECURITY_URL },
    { label: '利用者情報の外部送信について', href: import.meta.env.PUBLIC_JUNRO_EXTERNAL_TRANSMISSION_URL },
    { label: '電子公告', href: import.meta.env.PUBLIC_JUNRO_NOTICE_URL },
  ],
  motion: { reveal: 'fade', durationMs: 2600, staggerMs: 0, header: 'hide', pageTransition: true },
  shell: { header: 'custom', footer: 'custom', breadcrumbs: 'hidden' },
};
