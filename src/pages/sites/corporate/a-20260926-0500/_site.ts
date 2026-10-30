import type { SiteConfig } from '../../../../lib/site';

export const site: SiteConfig = {
  name: '白澄メディウェル株式会社',
  tagline: '医学と余白で、肌を整える',
  base: '/sites/corporate/a-20260926-0500/',
  theme: 'shirosumi-calm',
  industry: 'beauty-wellness',
  nav: [
    { label: 'クリニックの考え方', href: '/about/', children: [{ label: '理念と空間', href: '/about/' }, { label: '会社概要', href: '/company/' }, { label: '採用情報', href: '/recruit/' }] },
    { label: 'メディカル美容', href: '/service/#medical', children: [{ label: '皮膚再生プログラム', href: '/service/#skin-regen' }, { label: '肌質改善ブースター', href: '/service/#skin-booster' }, { label: '微細針再生', href: '/service/#microneedle' }, { label: 'レーザー肌再生', href: '/service/#laser' }, { label: '注入・再生連携', href: '/service/#inject' }] },
    { label: '予防ウェルネス', href: '/service/#wellness', children: [{ label: 'ホルモン調整', href: '/service/#hormone' }, { label: '点滴療法', href: '/service/#drip' }, { label: '検査・栄養設計', href: '/service/#diagnostics' }, { label: 'ストレスケア', href: '/service/#stress' }] },
    { label: '目的別コース', href: '/service/#courses', children: [{ label: '肌と体調の統合コース', href: '/service/#course-integrate' }, { label: '働く女性の定期フォロー', href: '/service/#course-follow' }] },
    { label: 'お知らせ', href: '/news/' },
  ],
  footerNav: [
    { heading: '知る', items: [{ label: 'クリニックの考え方', href: '/about/' }, { label: '会社概要', href: '/company/' }, { label: '採用情報', href: '/recruit/' }, { label: 'お知らせ', href: '/news/' }] },
    { heading: '受ける', items: [{ label: 'メディカル美容', href: '/service/#medical' }, { label: '予防ウェルネス', href: '/service/#wellness' }, { label: '目的別コース', href: '/service/#courses' }, { label: '施術一覧', href: '/service/#treatments' }] },
    { heading: '相談する', items: [{ label: 'カウンセリング予約', href: '/contact/' }] },
  ],
  organization: { legalName: '白澄メディウェル株式会社', address: '東京都港区', founded: '2014' },
  primaryCta: { label: 'カウンセリング予約', href: '/contact/' },
  legalNav: [{ label: '個人情報の取り扱い', href: '/privacy/' }],
  motion: { reveal: 'clip-up', durationMs: 300, staggerMs: 80, header: 'hide', pageTransition: false },
};

export default site;
