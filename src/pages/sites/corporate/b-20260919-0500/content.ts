export const images = {
  home: '/sites/corporate/_shared/20260919-0500/img-a-01.jpg',
  wood: '/sites/corporate/_shared/20260919-0500/img-a-02.jpg',
  plaster: '/sites/corporate/_shared/20260919-0500/img-a-03.jpg',
  renovation: '/sites/corporate/_shared/20260919-0500/img-a-04.jpg',
  exterior: '/sites/corporate/_shared/20260919-0500/img-a-05.jpg',
  craft: '/sites/corporate/_shared/20260919-0500/img-a-06.jpg',
  meeting: '/sites/corporate/_shared/20260919-0500/img-a-07.jpg',
} as const;

export const photos = [
  { image: images.home, alt: '食卓に届く自然光の設計イメージ', label: '食卓に届く光', href: '/works/wood-and-plaster/#light' },
  { image: images.plaster, alt: '左官壁の陰影の設計イメージ', label: '左官の陰影', href: '/works/wood-and-plaster/#plaster' },
  { image: images.wood, alt: '木製建具の設計イメージ', label: '木の手触り', href: '/works/wood-and-plaster/#wood' },
  { image: images.renovation, alt: '全面リノベーションの設計イメージ', label: '今ある住まいを生かす', href: '/works/wood-and-plaster/#renewal' },
] as const;

export const figures = [
  ['累計施工', '480棟'],
  ['リノベ完工率', '92%'],
  ['モデルハウス来場', '年1,200組'],
] as const;
