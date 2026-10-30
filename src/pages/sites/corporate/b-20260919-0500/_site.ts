import type { SiteConfig } from '../../../../lib/site';

export const site: SiteConfig = {
  name: '株木堂建築株式会社',
  tagline: '時を重ねる住まいを、静かに。',
  base: '/sites/corporate/b-20260919-0500/',
  theme: 'kabukido-sumi',
  industry: 'building',
  nav: [
    { label: '家づくりの考え方', href: '/about/' },
    { label: '注文住宅・リノベーション', href: '/service/' },
    { label: '住まいの写真', href: '/works/' },
    { label: '会社案内', href: '/company/' },
    { label: 'お知らせ', href: '/news/' },
  ],
  footerNav: [
    {
      heading: '家づくりを知る',
      items: [
        { label: '家づくりの考え方', href: '/about/' },
        { label: '注文住宅・リノベーション', href: '/service/' },
        { label: '住まいの写真', href: '/works/' },
        { label: '木と左官の住まい', href: '/works/wood-and-plaster/' },
        { label: 'モデルハウス', href: '/model-house/' },
        { label: '家づくりの流れ', href: '/flow/' },
      ],
    },
    {
      heading: '株木堂建築について',
      items: [
        { label: '会社案内', href: '/company/' },
        { label: '採用について', href: '/recruit/' },
        { label: 'お知らせ', href: '/news/' },
        { label: '家づくり相談の前に', href: '/news/first-consultation/' },
      ],
    },
    {
      heading: '相談する',
      items: [{ label: '家づくり相談を予約する', href: '/contact/' }],
    },
  ],
  organization: {
    legalName: '株木堂建築株式会社',
    address: '静岡県静岡市葵区',
    founded: '1998',
  },
  primaryCta: {
    label: '家づくり相談を予約する',
    href: '/contact/',
  },
  legalNav: [{ label: '個人情報の取り扱い', href: '/privacy/' }],
  motion: {
    reveal: 'fade-up',
    durationMs: 2000,
    staggerMs: 0,
    header: 'none',
    pageTransition: false,
  },
};

export default site;
