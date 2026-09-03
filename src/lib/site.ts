/**
 * サイト定義の型。
 *
 * LP は 1 ページで完結するので「ページの Props」だけで足りたが、website は
 * グローバルナビ・フッターサイトマップ・パンくず・組織情報がサイト全体で
 * 一貫している必要がある。その一貫性を人力の写経に頼ると必ずズレるため、
 * サンプルサイトごとに `_site.ts` を 1 つ置き、全ページがそれを import する。
 *
 * `web-quality-check.mjs` の Arch/IA ルールもこのファイルの存在を前提にする。
 */

export interface NavItem {
  label: string;
  href: string;
  /** メガメニュー/ドロップダウン用の子階層 */
  children?: NavItem[];
}

export interface SiteConfig {
  /** サイト名（<title> のサフィックス・Organization schema の name） */
  name: string;
  /** サイトのキャッチ。トップの description 既定値に使う */
  tagline?: string;
  /** ルートパス。例: '/sites/corporate/a-20260903-1400/' */
  base: string;
  /** DaisyUI の data-theme 名。サンプルごとに必ず独自テーマを当てる */
  theme: string;
  /** グローバルナビ。全ページで同一のものを描画する */
  nav: NavItem[];
  /** フッターのサイトマップ。nav より広く、下層まで露出させる */
  footerNav?: { heading: string; items: NavItem[] }[];
  /** 会社情報（Organization / LocalBusiness schema と会社概要ページに使う） */
  organization?: {
    legalName?: string;
    address?: string;
    tel?: string;
    email?: string;
    founded?: string;
    url?: string;
  };
  /** 主要CTA（お問い合わせ・資料請求など）。ヘッダー右とフッターに出す */
  primaryCta?: { label: string; href: string };
  /** 法務系リンク（プライバシーポリシー等）。フッター最下段に出す */
  legalNav?: NavItem[];
  /**
   * サイト全体のモーション方針。
   *
   * website のモーションは「ページ間で揃っていること」が品質そのものなので、
   * ページごとに決めさせず、サイト定義で 1 箇所に持つ。
   * `scripts/web-analyze-reference-motion.mjs` の `direction_hints` を
   * そのまま写せる語彙にしてある。
   */
  motion?: {
    /** 既定のリビール種別。ディレクションの dominant_reveal を写す */
    reveal?: 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'zoom' | 'blur' | 'clip-up';
    /** 既定の duration(ms)。実測の median を写す */
    durationMs?: number;
    /** 並べた要素をずらす間隔(ms)。0 で無効 */
    staggerMs?: number;
    /**
     * スクロール時のヘッダー挙動。
     * 'none' 固定のまま / 'solid' 背景を付ける / 'shrink' 縮む / 'hide' 隠れる
     */
    header?: 'none' | 'solid' | 'shrink' | 'hide';
    /** ページ遷移に View Transitions を使うか */
    pageTransition?: boolean;
  };
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

/** base を前置して絶対パスにする。`_site.ts` の href は base 相対で書く。 */
export function url(site: SiteConfig, href: string): string {
  if (/^(https?:|tel:|mailto:|#)/.test(href)) return href;
  const b = site.base.replace(/\/$/, '');
  const h = href.replace(/^\//, '');
  return h ? `${b}/${h}` : `${b}/`;
}

/** パンくずから BreadcrumbList の JSON-LD を作る。 */
export function breadcrumbJsonLd(site: SiteConfig, crumbs: Breadcrumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: url(site, c.href) } : {}),
    })),
  };
}
