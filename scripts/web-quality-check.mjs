#!/usr/bin/env node
/**
 * website 品質チェッカー — 自己改善ループの計測エンジン
 *
 * lp-designer の lp-quality-check.mjs を土台にしているが、**ルールの主語が違う**。
 * LP は「1ページのコンバージョン」を測っていた。website は 1 ページを見ても
 * 品質が決まらない。グローバルナビが全ページで揃っているか、下層に
 * パンくずがあるか、title が重複していないか、リンクが切れていないか——
 * つまり**サイト単位の情報設計**を測る必要がある。
 *
 * そのため本チェッカーは 2 種類のルールを持つ:
 *   - PAGE_RULES … 1ページで判定できるもの (SEO/A11y/Perf/Base)
 *   - SITE_RULES … サイト全ページを横断して判定するもの (IA/Consistency/Arch)
 * SITE_RULES の指摘はそのサイトのトップページに計上する。
 *
 * 使い方:
 *   npm run build && node scripts/web-quality-check.mjs
 *   node scripts/web-quality-check.mjs --strict   # スコアが前回より低下したら exit 1
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const SRC_PAGES = join(ROOT, 'src', 'pages');
const OUT_DIR = join(ROOT, 'docs', 'quality');
const HISTORY = join(OUT_DIR, 'history.json');
const SITE_TYPES_JSON = join(ROOT, 'docs', 'site-types.json');
const STRICT = process.argv.includes('--strict');

const PENALTY = { high: 10, medium: 5, low: 2 };

// arch-component-reuse のしきい値（LP から引き継ぎ。website は 1 ページあたりの
// 分量が LP より小さいので下限を 2 に緩め、代わりにサイト全体の合計で見る）
const MIN_COMPONENTS_PER_PAGE = 2;
const MIN_COMPONENTS_PER_SITE = 6;
// content-thin-page: 本文テキストがこれ未満の下層ページはダミー扱い
const MIN_BODY_CHARS = 400;
// ia-too-few-pages: website として成立する最小ページ数
const MIN_SITE_PAGES = 4;
// アニメーション系コンポーネント。motion-* / arch-animation-missing が参照する。
const ANIM_COMPONENT_RE = /(ScrollReveal|RevealOnScroll|Marquee|GsapScrollSection|AnimatedCounter|PageTransition|ParallaxMedia)/;
// motion-consistency-drift: 演出のあるページと無いページが混在したら指摘する下限
const MOTION_RICH_THRESHOLD = 3;

const siteTypes = existsSync(SITE_TYPES_JSON)
  ? JSON.parse(readFileSync(SITE_TYPES_JSON, 'utf8'))
  : { site_types: [] };
const SITE_TYPE_BY_ID = Object.fromEntries(siteTypes.site_types.map((t) => [t.id, t]));

// ---- 汎用ヘルパー（lp-designer から移植。鉄則1〜4に対応） -------------------

/** base(プレフィックスなし)トークンから数値を返す。'sm:h-16' は無視。 */
function findBaseToken(classStr, re) {
  if (!classStr) return null;
  for (const tok of classStr.split(/\s+/)) {
    if (re.test(tok)) {
      const m = tok.match(/-(\d+)$/);
      return m ? Number(m[1]) : null;
    }
  }
  return null;
}

/** base の非数値トークンの存在チェック。'md:hidden' は無視。 */
function hasBaseToken(classStr, re) {
  if (!classStr) return false;
  return classStr.split(/\s+/).some((tok) => re.test(tok));
}

/** <a>/<button> を走査してタグ・属性・テキストに分解する。 */
function extractInteractive(html) {
  const out = [];
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    out.push({
      tag: m[1].toLowerCase(),
      attrs: m[2],
      text: m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      href: m[2].match(/\bhref="([^"]*)"/)?.[1] ?? '',
    });
  }
  return out;
}

/** <nav ...>...</nav> をラベル付きで抜き出す。 */
function extractNavs(html) {
  const out = [];
  for (const m of html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi)) {
    out.push({
      attrs: m[1],
      label: m[1].match(/\baria-label="([^"]*)"/)?.[1] ?? '',
      inner: m[2],
      links: [...m[2].matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)].map((a) => a[1]),
    });
  }
  return out;
}

/** 本文のプレーンテキスト量（script/style を除く）。 */
function bodyText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return body
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** パスを正規化（末尾スラッシュ統一）。 */
const normPath = (p) => (p.endsWith('/') || /\.[a-z0-9]+$/i.test(p) ? p : p + '/');

// ---- ページ単位ルール -------------------------------------------------------

/** @type {{id:string, category:string, severity:'high'|'medium'|'low', desc:string, check:(page:any)=>string[]}[]} */
const PAGE_RULES = [
  // --- Base ---
  {
    id: 'base-viewport', category: 'Base', severity: 'high',
    desc: 'viewport meta が無い',
    check: (p) => (/<meta[^>]+name="viewport"/i.test(p.html) ? [] : ['<meta name="viewport"> が無い']),
  },
  {
    id: 'base-title', category: 'Base', severity: 'high',
    desc: '<title> が無い/空',
    check: (p) => {
      const t = p.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
      return t ? [] : ['<title> が無い、または空'];
    },
  },
  {
    id: 'base-broken-internal-link', category: 'Base', severity: 'high',
    desc: 'サイト内リンクの飛び先が存在しない',
    check: (p) => {
      // カタログは部品を並べた面。プレビューの href="#" は仕様であって欠陥ではない。
      if (p.isCatalog) return [];
      const bad = [];
      for (const el of extractInteractive(p.html)) {
        const href = el.href;
        if (!href || /^(https?:|tel:|mailto:|javascript:|data:)/i.test(href)) continue;
        if (href.startsWith('#')) {
          if (href !== '#' && !p.ids.has(href.slice(1))) bad.push(`アンカー ${href} の id が無い`);
          else if (href === '#') bad.push('href="#" のリンク（行き先なし）');
          continue;
        }
        if (!href.startsWith('/')) continue; // 相対パスは解決が曖昧なので対象外
        const target = normPath(href.split(/[?#]/)[0]);
        if (!p.allRoutes.has(target) && !p.allAssets.has(target)) bad.push(`リンク切れ: ${href}`);
      }
      return [...new Set(bad)].slice(0, 8);
    },
  },

  // --- Nav ---
  {
    id: 'nav-global-missing', category: 'Nav', severity: 'high',
    desc: 'グローバルナビが無い（リンク3件以上の <nav> が無い）',
    check: (p) => {
      if (!p.isSitePage) return [];
      const navs = extractNavs(p.html);
      return navs.some((n) => n.links.length >= 3) ? [] : ['リンク3件以上の <nav> が見つからない'];
    },
  },
  {
    id: 'nav-no-current', category: 'Nav', severity: 'medium',
    desc: '現在地表示（aria-current="page"）が無い',
    check: (p) => {
      if (!p.isSitePage) return [];
      return /aria-current="page"/i.test(p.html) ? [] : ['ナビに aria-current="page" が無く現在地が分からない'];
    },
  },

  // --- SEO ---
  {
    id: 'seo-meta-description', category: 'SEO', severity: 'medium',
    desc: 'meta description が無い/短すぎる',
    check: (p) => {
      const d = p.html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? '';
      if (!d.trim()) return ['meta description が無い'];
      if (d.trim().length < 40) return [`meta description が短い (${d.trim().length}文字)`];
      return [];
    },
  },
  {
    id: 'seo-title-shape', category: 'SEO', severity: 'low',
    desc: '<title> の長さが適正でない',
    check: (p) => {
      const t = p.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
      if (!t) return [];
      if (t.length > 60) return [`title が長い (${t.length}文字)。検索結果で切れる`];
      if (t.length < 10) return [`title が短い (${t.length}文字)`];
      return [];
    },
  },
  {
    id: 'seo-ogp', category: 'SEO', severity: 'medium',
    desc: 'OGP (og:title/og:image) が不足',
    check: (p) => {
      const miss = ['og:title', 'og:image', 'og:url'].filter(
        (k) => !new RegExp(`property="${k}"`, 'i').test(p.html),
      );
      return miss.length ? [`不足: ${miss.join(', ')}`] : [];
    },
  },
  {
    id: 'seo-canonical', category: 'SEO', severity: 'low',
    desc: 'canonical が無い',
    check: (p) => (/<link[^>]+rel="canonical"/i.test(p.html) ? [] : ['<link rel="canonical"> が無い']),
  },
  {
    id: 'seo-sitemap-robots', category: 'SEO', severity: 'medium',
    desc: 'sitemap.xml / robots.txt が生成されていない',
    check: (p) => {
      if (!p.isRoot) return [];
      const miss = [];
      if (!existsSync(join(DIST, 'sitemap-index.xml')) && !existsSync(join(DIST, 'sitemap.xml')))
        miss.push('sitemap.xml');
      if (!existsSync(join(DIST, 'robots.txt'))) miss.push('robots.txt');
      return miss.length ? [`不足: ${miss.join(', ')}（複数ページサイトでは必須）`] : [];
    },
  },

  // --- A11y ---
  {
    id: 'a11y-h1', category: 'A11y', severity: 'high',
    desc: 'h1 が無い/複数ある',
    check: (p) => {
      if (p.isCatalog) return [];
      const n = (p.html.match(/<h1\b/gi) ?? []).length;
      if (n === 0) return ['h1 が無い'];
      if (n > 1) return [`h1 が ${n} 個ある`];
      return [];
    },
  },
  {
    id: 'a11y-img-alt', category: 'A11y', severity: 'high',
    desc: 'alt の無い img',
    check: (p) => {
      const bad = [...p.html.matchAll(/<img\b([^>]*)>/gi)]
        .filter((m) => !/\balt=/i.test(m[1]))
        .map((m) => m[0].slice(0, 80));
      return bad.length ? [`alt 無し ${bad.length}件: ${bad[0]}`] : [];
    },
  },
  {
    id: 'a11y-skip-link', category: 'A11y', severity: 'medium',
    desc: 'スキップリンクが無い',
    check: (p) => {
      if (!p.isSitePage) return [];
      return /href="#(main|content)"/i.test(p.html) ? [] : ['本文へのスキップリンクが無い（グロナビをキーボードで毎回通過することになる）'];
    },
  },
  {
    id: 'a11y-nav-label', category: 'A11y', severity: 'low',
    desc: '複数の <nav> に aria-label が無い',
    check: (p) => {
      const navs = extractNavs(p.html);
      if (navs.length < 2) return [];
      const unlabeled = navs.filter((n) => !n.label).length;
      return unlabeled ? [`<nav> が ${navs.length} 個あるが ${unlabeled} 個に aria-label が無い`] : [];
    },
  },
  {
    id: 'a11y-heading-order', category: 'A11y', severity: 'low',
    desc: '見出しレベルが飛んでいる',
    check: (p) => {
      if (p.isCatalog) return [];
      const levels = [...p.html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
      const bad = [];
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) bad.push(`h${levels[i - 1]} → h${levels[i]}`);
      }
      return bad.length ? [`飛び: ${[...new Set(bad)].join(', ')}`] : [];
    },
  },
  {
    id: 'a11y-lang', category: 'A11y', severity: 'medium',
    desc: 'html lang が無い',
    check: (p) => (/<html[^>]+lang="/i.test(p.html) ? [] : ['<html lang="ja"> が無い']),
  },

  // --- Perf ---
  {
    id: 'perf-img-lazy', category: 'Perf', severity: 'medium',
    desc: 'ファーストビュー以降の img に loading="lazy" が無い',
    check: (p) => {
      const imgs = [...p.html.matchAll(/<img\b([^>]*)>/gi)];
      if (imgs.length <= 2) return [];
      const noLazy = imgs.slice(2).filter((m) => !/loading="lazy"/i.test(m[1]));
      return noLazy.length ? [`lazy 未指定 ${noLazy.length}件 / 全${imgs.length}件`] : [];
    },
  },
  {
    id: 'perf-img-dimensions', category: 'Perf', severity: 'low',
    desc: 'img に width/height が無い（CLS の原因）',
    check: (p) => {
      const bad = [...p.html.matchAll(/<img\b([^>]*)>/gi)]
        .filter((m) => !(/\bwidth=/i.test(m[1]) && /\bheight=/i.test(m[1])));
      return bad.length ? [`width/height 未指定 ${bad.length}件`] : [];
    },
  },

  // --- Motion ---
  {
    id: 'a11y-reduced-motion', category: 'A11y', severity: 'medium',
    desc: '自前アニメーションが prefers-reduced-motion に対応していない',
    check: (p) => {
      if (!p.srcCode) return [];
      // 共通コンポーネント側は自前で対応済みなので、ページが直接書いた <style> だけを見る
      const styles = [...p.srcCode.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
      if (!styles.length) return [];
      const css = styles.join('\n');
      const animates = /@keyframes|animation\s*:|transition\s*:|transition-property/.test(css);
      if (!animates) return [];
      return /prefers-reduced-motion/.test(css)
        ? []
        : ['ページ内 <style> でアニメーションを定義しているが @media (prefers-reduced-motion: reduce) の打ち消しが無い'];
    },
  },
  {
    id: 'arch-animation-missing', category: 'Arch', severity: 'medium',
    desc: 'ディレクションのアニメーション指示が実装されていない',
    check: (p) => {
      if (!p.isSitePage || !p.srcCode || !p.directionHtml) return [];
      // direction 側: data-role="animation" のうち "none" 以外を数える
      const directives = [...p.directionHtml.matchAll(/data-role="animation"[^>]*>([\s\S]*?)<\/(?:p|td|li)>/g)]
        .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
        .filter((t) => t && !/^none[。.\s]*$/i.test(t));
      if (!directives.length) return [];

      const imported = [...p.srcCode.matchAll(/^\s*import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm)]
        .filter(([, name, spec]) => ANIM_COMPONENT_RE.test(name) || ANIM_COMPONENT_RE.test(spec))
        .map(([, name]) => name);
      const handRolled = /<style[^>]*>[\s\S]*?(@keyframes|animation\s*:|transition\s*:)/.test(p.srcCode);

      if (!imported.length && !handRolled) {
        return [`direction に animation 指示が ${directives.length} 件あるが、アニメーションコンポーネントの import も自前 CSS も無い`];
      }
      // import しただけで使っていないもの（lp-designer で実際に起きた）
      const unused = imported.filter((name) => !new RegExp(`<${name}[\\s/>]`).test(p.srcCode));
      if (unused.length) {
        return [`import しているが一度も使われていないアニメーションコンポーネント: ${unused.join(', ')}（direction の指示は ${directives.length} 件）`];
      }
      return [];
    },
  },
  {
    // Astro の <style is:global> はページ境界を越えて全ビルドに漏れる。
    // 各サンプルサイトが自分のブランド色で .btn-primary 等を上書きすると、
    // 別サイトのCSSと衝突し、読み込み順で勝ったものが全ページに適用される。
    // website-designer は 1 ビルドに複数サイトを載せるため、LP 以上に起きやすい。
    id: 'arch-global-style-collision', category: 'Arch', severity: 'medium',
    desc: 'is:global で DaisyUI 共通クラスを上書きしている（他サイトと衝突する）',
    check: (p) => {
      if (!p.srcCode) return [];
      const m = p.srcCode.match(/<style[^>]*\bis:global\b[^>]*>([\s\S]*?)<\/style>/);
      if (!m) return [];
      const SHARED = ['btn-primary', 'btn-secondary', 'btn-accent', 'btn', 'card', 'input',
                      'select', 'textarea', 'collapse-title', 'navbar', 'footer'];
      const clean = m[1].replace(/\/\*[\s\S]*?\*\//g, '');
      const hits = new Set();
      for (const block of clean.split('}')) {
        const selPart = block.split('{')[0];
        if (!selPart || !selPart.includes('.')) continue;
        for (const sel of selPart.split(',')) {
          const inner = sel.trim().replace(/^:global\(\s*/, '').replace(/\s*\)$/, '').trim();
          for (const cls of SHARED) {
            if (new RegExp(`^\\.${cls}(?:[:\\s.[]|$)`).test(inner)) hits.add(cls);
          }
        }
      }
      return hits.size
        ? [`is:global で共通クラスを直接上書き: ${[...hits].map((c) => `.${c}`).join(', ')} — 他サイトのグローバルCSSと衝突し、読み込み順で意図しない見た目になります。サイト固有クラスでスコープするか Props で渡してください`]
        : [];
    },
  },

  // --- Content ---
  {
    id: 'content-thin-page', category: 'Content', severity: 'medium',
    desc: '本文が薄すぎる（ページの体をなしていない）',
    check: (p) => {
      if (!p.isSitePage) return [];
      const len = bodyText(p.html).length;
      return len < MIN_BODY_CHARS ? [`本文 ${len} 文字（下限 ${MIN_BODY_CHARS}）。ナビとフッターだけの空ページになっていないか`] : [];
    },
  },
];

// ---- サイト単位ルール（website 固有の中核） ---------------------------------

/** @type {{id:string, category:string, severity:'high'|'medium'|'low', desc:string, check:(site:any)=>string[]}[]} */
const SITE_RULES = [
  {
    id: 'ia-too-few-pages', category: 'IA', severity: 'high',
    desc: 'ページ数が少なすぎて website として成立していない',
    check: (s) =>
      s.pages.length < MIN_SITE_PAGES
        ? [`${s.pages.length} ページのみ（下限 ${MIN_SITE_PAGES}）。LP を1枚置いただけになっていないか`]
        : [],
  },
  {
    id: 'ia-required-page-missing', category: 'IA', severity: 'high',
    desc: 'サイト種別の必須ページが欠けている',
    check: (s) => {
      const t = SITE_TYPE_BY_ID[s.type];
      if (!t?.required_pages?.length) return [];
      const have = new Set(s.pages.map((p) => p.relPath));
      const miss = t.required_pages.filter((r) => !have.has(r));
      return miss.length ? [`${t.label} の必須ページ欠落: ${miss.join(', ')}`] : [];
    },
  },
  {
    id: 'ia-recommended-page-missing', category: 'IA', severity: 'low',
    desc: 'サイト種別の推奨ページが欠けている',
    check: (s) => {
      const t = SITE_TYPE_BY_ID[s.type];
      if (!t?.recommended_pages?.length) return [];
      const have = new Set(s.pages.map((p) => p.relPath));
      const miss = t.recommended_pages.filter((r) => !have.has(r));
      return miss.length ? [`推奨ページ欠落: ${miss.join(', ')}`] : [];
    },
  },
  {
    id: 'ia-breadcrumb-missing', category: 'IA', severity: 'high',
    desc: '下層ページにパンくずが無い',
    check: (s) => {
      const bad = s.pages
        .filter((p) => p.relPath !== '/')
        .filter((p) => !/aria-label="[^"]*パンくず/i.test(p.html) && !/BreadcrumbList/.test(p.html))
        .map((p) => p.relPath);
      return bad.length ? [`パンくず無し: ${bad.slice(0, 6).join(', ')}`] : [];
    },
  },
  {
    id: 'ia-orphan-page', category: 'IA', severity: 'medium',
    desc: 'どこからもリンクされていない孤立ページ',
    check: (s) => {
      const linked = new Set();
      for (const p of s.pages) {
        for (const el of extractInteractive(p.html)) {
          if (!el.href.startsWith('/')) continue;
          linked.add(normPath(el.href.split(/[?#]/)[0]));
        }
      }
      const orphans = s.pages
        .filter((p) => p.relPath !== '/' && !linked.has(p.path))
        .map((p) => p.relPath);
      return orphans.length ? [`孤立: ${orphans.join(', ')}（グロナビ・フッター・本文のどこからも辿れない）`] : [];
    },
  },

  {
    id: 'consist-nav-drift', category: 'Consistency', severity: 'high',
    desc: 'グローバルナビの内容がページ間でズレている',
    check: (s) => {
      const sig = new Map();
      for (const p of s.pages) {
        const nav = extractNavs(p.html).find((n) => n.links.length >= 3);
        if (!nav) continue;
        const key = nav.links.map((h) => h.split(/[?#]/)[0]).sort().join('|');
        if (!sig.has(key)) sig.set(key, []);
        sig.get(key).push(p.relPath);
      }
      if (sig.size <= 1) return [];
      const groups = [...sig.entries()].map(([, ps]) => `[${ps.join(', ')}]`);
      return [`ナビのリンク集合が ${sig.size} 種類に分かれている: ${groups.join(' / ')}`];
    },
  },
  {
    id: 'consist-duplicate-title', category: 'Consistency', severity: 'high',
    desc: '複数ページで <title> が重複',
    check: (s) => {
      const byTitle = new Map();
      for (const p of s.pages) {
        const t = p.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
        if (!t) continue;
        if (!byTitle.has(t)) byTitle.set(t, []);
        byTitle.get(t).push(p.relPath);
      }
      const dup = [...byTitle.entries()].filter(([, ps]) => ps.length > 1);
      return dup.map(([t, ps]) => `"${t}" が ${ps.length} ページで重複: ${ps.join(', ')}`);
    },
  },
  {
    id: 'consist-duplicate-description', category: 'Consistency', severity: 'medium',
    desc: '複数ページで meta description が重複',
    check: (s) => {
      const byDesc = new Map();
      for (const p of s.pages) {
        const d = p.html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1]?.trim() ?? '';
        if (!d) continue;
        if (!byDesc.has(d)) byDesc.set(d, []);
        byDesc.get(d).push(p.relPath);
      }
      return [...byDesc.entries()]
        .filter(([, ps]) => ps.length > 1)
        .map(([d, ps]) => `"${d.slice(0, 30)}…" が ${ps.length} ページで重複: ${ps.join(', ')}`);
    },
  },
  {
    id: 'consist-theme-drift', category: 'Consistency', severity: 'medium',
    desc: 'data-theme がページ間でズレている',
    check: (s) => {
      const themes = new Set(
        s.pages.map((p) => p.html.match(/<html[^>]+data-theme="([^"]*)"/i)?.[1] ?? '(none)'),
      );
      return themes.size > 1 ? [`data-theme が複数: ${[...themes].join(', ')}`] : [];
    },
  },
  {
    id: 'consist-footer-missing', category: 'Consistency', severity: 'medium',
    desc: '<footer> の無いページがある',
    check: (s) => {
      const bad = s.pages.filter((p) => !/<footer\b/i.test(p.html)).map((p) => p.relPath);
      return bad.length ? [`footer 無し: ${bad.join(', ')}`] : [];
    },
  },
  {
    id: 'consist-default-theme', category: 'Consistency', severity: 'medium',
    desc: 'DaisyUI 内蔵テーマのまま出荷しようとしている',
    check: (s) => {
      // 当初は light / dark / cupcake だけを弾いていたが、それでは足りなかった。
      // ベースラインが内蔵の `business`（ダークテーマ）のまま出荷され、
      // primary の濃紺が暗い下地に載ってコントラスト比 1.9 になっていた。
      // 内蔵テーマは全部弾き、サイトごとに独自テーマを起こさせる。
      const BUILTIN = new Set([
        'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave',
        'retro', 'cyberpunk', 'valentine', 'halloween', 'garden', 'forest', 'aqua',
        'lofi', 'pastel', 'fantasy', 'wireframe', 'black', 'luxury', 'dracula',
        'cmyk', 'autumn', 'business', 'acid', 'lemonade', 'night', 'coffee',
        'winter', 'dim', 'nord', 'sunset', 'caramellatte', 'abyss', 'silk',
      ]);
      const theme = s.pages[0]?.html.match(/<html[^>]+data-theme="([^"]*)"/i)?.[1] ?? '';
      if (!theme) return ['data-theme が未指定。サイトごとに独自テーマを定義すること'];
      return BUILTIN.has(theme)
        ? [`data-theme="${theme}" は DaisyUI 内蔵テーマ。サイトごとに独自テーマを起こすこと（内蔵テーマは自前の配色設計と噛み合わず、実測でコントラスト比 1.9 の事故が起きている）`]
        : [];
    },
  },

  {
    // 参照サイトの実測でも起きていた崩れ方（aito.co.jp: トップ83件 / 下層13件）。
    // トップだけ演出を盛って下層が無演出だと、同じサイトに見えなくなる。
    id: 'motion-consistency-drift', category: 'Consistency', severity: 'medium',
    desc: 'ページ間でモーションの有無が揃っていない',
    check: (s) => {
      const counts = [];
      for (const p of s.pages) {
        if (!p.srcCode) continue;
        const uses = [...p.srcCode.matchAll(/<(\w+)[\s/>]/g)]
          .map((m) => m[1])
          .filter((n) => ANIM_COMPONENT_RE.test(n));
        counts.push({ path: p.relPath, n: new Set(uses).size, total: uses.length });
      }
      if (counts.length < 2) return [];
      const rich = counts.filter((c) => c.total >= MOTION_RICH_THRESHOLD);
      const none = counts.filter((c) => c.total === 0);
      if (rich.length && none.length) {
        return [`演出のあるページ（${rich.map((c) => `${c.path}:${c.total}`).join(', ')}）と、演出ゼロのページ（${none.map((c) => c.path).join(', ')}）が混在している`];
      }
      return [];
    },
  },
  {
    id: 'arch-site-config-missing', category: 'Arch', severity: 'high',
    desc: '_site.ts / SiteLayout を使っていない',
    check: (s) => {
      const out = [];
      if (!s.hasSiteConfig) out.push(`_site.ts が無い（${s.srcDir}）。ナビ・フッターがページごとに手書きになる`);
      const noLayout = s.pages.filter((p) => p.srcCode && !/SiteLayout/.test(p.srcCode)).map((p) => p.relPath);
      if (noLayout.length) out.push(`SiteLayout 未使用: ${noLayout.join(', ')}`);
      return out;
    },
  },
  {
    id: 'arch-component-reuse', category: 'Arch', severity: 'medium',
    desc: 'src/components/ の再利用が少ない（ベタ書き）',
    check: (s) => {
      const out = [];
      let siteTotal = new Set();
      for (const p of s.pages) {
        if (!p.srcCode) continue;
        const comps = [...p.srcCode.matchAll(/^import\s+(\w+)\s+from\s+['"](?:[./]*)components\/[^'"]+['"]/gm)]
          .map((m) => m[1]);
        const all = [...p.srcCode.matchAll(/from\s+['"][^'"]*\/components\/([^'"]+)['"]/g)].map((m) => m[1]);
        for (const c of all) siteTotal.add(c);
        const n = Math.max(comps.length, all.length);
        if (n < MIN_COMPONENTS_PER_PAGE) out.push(`${p.relPath}: コンポーネント利用 ${n} 件（下限 ${MIN_COMPONENTS_PER_PAGE}）`);
      }
      if (siteTotal.size < MIN_COMPONENTS_PER_SITE) {
        out.push(`サイト全体で ${siteTotal.size} 種類（下限 ${MIN_COMPONENTS_PER_SITE}）。学習成果が src/components/ に還元されていない`);
      }
      return out;
    },
  },
];

// ---- 収集 -------------------------------------------------------------------

function collectFiles(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collectFiles(p, ext, out);
    else if (!ext || name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** Astro の redirects が吐くリダイレクトスタブか。 */
function isRedirectStub(html) {
  return /<meta\s+http-equiv=["']refresh["'][^>]*url=/i.test(html) && html.length < 1200;
}

/**
 * そのサンプルサイトを生んだランの direction を探す。
 * ルート /sites/{type}/{model}-{stamp}/... から
 * docs/quality/runs/{type}-{stamp}/direction-{model}.html（無ければ direction.html）を引く。
 *
 * ディレクションがアニメーション指示を出しているのに実装が無視した事故を検出するために必要
 * （lp-designer の実測: 12セクション中7つに指示があったが両モデルとも未実装だった）。
 */
function resolveDirection(path) {
  const m = path.match(/^\/sites\/([^/]+)\/(.+?)-(\d{8}-\d{4})\//);
  if (!m) return { directionHtml: null };
  const [, type, model, stamp] = m;
  const dir = join(ROOT, 'docs', 'quality', 'runs', `${type}-${stamp}`);
  for (const f of [`direction-${model}.html`, 'direction.html']) {
    const cand = join(dir, f);
    if (existsSync(cand)) return { directionHtml: readFileSync(cand, 'utf8') };
  }
  return { directionHtml: null };
}

/** dist のルートに対応する Astro ソースを探す。 */
function resolveSource(path) {
  const rel = path.replace(/^\//, '').replace(/\/$/, '');
  for (const cand of [join(SRC_PAGES, rel, 'index.astro'), join(SRC_PAGES, `${rel}.astro`)]) {
    if (existsSync(cand)) return { srcPath: relative(ROOT, cand), srcCode: readFileSync(cand, 'utf8') };
  }
  return { srcPath: null, srcCode: null };
}

if (!existsSync(DIST)) {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(2);
}

const htmlFiles = collectFiles(DIST, '.html').filter((f) => !isRedirectStub(readFileSync(f, 'utf8')));
const allRoutes = new Set(htmlFiles.map((f) => '/' + relative(DIST, f).replace(/index\.html$/, '')));
const allAssets = new Set(
  collectFiles(DIST, null).map((f) => '/' + relative(DIST, f)).filter((p) => !p.endsWith('.html')),
);

// サイトのルート: /sites/{type}/{model}-{stamp}/
const SITE_RE = /^\/sites\/([^/]+)\/([^/]+)\//;

const pages = htmlFiles.map((file) => {
  const path = '/' + relative(DIST, file).replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  const m = path.match(SITE_RE);
  return {
    file, path, html, allRoutes, allAssets,
    ids: new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1])),
    isRoot: path === '/',
    isCatalog: path === '/components/',
    // サイトサンプル配下のページか（カタログや索引ページに website ルールを当てない）
    isSitePage: Boolean(m),
    siteKey: m ? m[0] : null,
    siteType: m ? m[1] : null,
    relPath: m ? path.slice(m[0].length - 1) || '/' : path,
    ...resolveDirection(path),
    ...resolveSource(path),
  };
});

// サイト単位にグループ化
const sitesMap = new Map();
for (const p of pages) {
  if (!p.siteKey) continue;
  if (!sitesMap.has(p.siteKey)) {
    const srcDir = join('src', 'pages', p.siteKey.replace(/^\//, '').replace(/\/$/, ''));
    sitesMap.set(p.siteKey, {
      key: p.siteKey,
      type: p.siteType,
      srcDir,
      hasSiteConfig: existsSync(join(ROOT, srcDir, '_site.ts')),
      pages: [],
    });
  }
  sitesMap.get(p.siteKey).pages.push(p);
}
const sites = [...sitesMap.values()];

// ---- 採点 -------------------------------------------------------------------

const findingsByPath = new Map(pages.map((p) => [p.path, []]));

for (const page of pages) {
  for (const rule of PAGE_RULES) {
    for (const detail of rule.check(page)) findingsByPath.get(page.path).push({ ...rule, detail });
  }
}
for (const site of sites) {
  const home = site.pages.find((p) => p.relPath === '/') ?? site.pages[0];
  for (const rule of SITE_RULES) {
    for (const detail of rule.check(site)) findingsByPath.get(home.path).push({ ...rule, detail });
  }
}

const results = pages.map((p) => {
  const findings = findingsByPath.get(p.path);
  return {
    path: p.path,
    score: Math.max(0, 100 - findings.reduce((s, f) => s + PENALTY[f.severity], 0)),
    findings,
  };
});

const total = results.length
  ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
  : 100;

// ---- 履歴とレポート ---------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
const history = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : [];
const prev = history.at(-1);
history.push({
  date: new Date().toISOString(),
  total,
  sites: sites.length,
  pages: Object.fromEntries(results.map((r) => [r.path, r.score])),
  findingsCount: results.reduce((s, r) => s + r.findings.length, 0),
});
writeFileSync(HISTORY, JSON.stringify(history, null, 2));

const sevMark = { high: '🔴 high', medium: '🟡 medium', low: '🔵 low' };
const lines = [
  `# website 品質レポート`,
  ``,
  `- 計測日時: ${new Date().toLocaleString('ja-JP')}`,
  `- **総合スコア: ${total} / 100**${prev ? `（前回 ${prev.total}、${total - prev.total >= 0 ? '+' : ''}${total - prev.total}）` : ''}`,
  `- サイト数: ${sites.length} / ページ数: ${results.length}`,
  ``,
  `| ページ | スコア | 指摘数 |`,
  `|---|---|---|`,
  ...results.map((r) => `| ${r.path} | ${r.score} | ${r.findings.length} |`),
  ``,
];
for (const r of results) {
  lines.push(`## ${r.path} — ${r.score}点`, ``);
  if (!r.findings.length) { lines.push(`指摘なし 🎉`, ``); continue; }
  lines.push(`| 重要度 | ルール | 内容 |`, `|---|---|---|`);
  const order = { high: 0, medium: 1, low: 2 };
  for (const f of [...r.findings].sort((a, b) => order[a.severity] - order[b.severity])) {
    lines.push(`| ${sevMark[f.severity]} | ${f.id}: ${f.desc} | ${f.detail} |`);
  }
  lines.push(``);
}
writeFileSync(join(OUT_DIR, 'latest.md'), lines.join('\n'));

// ---- コンソール出力 ----------------------------------------------------------

console.log(`\nwebsite 品質チェック: 総合 ${total}/100${prev ? ` (前回 ${prev.total})` : ''}  サイト${sites.length}件 / ページ${results.length}件`);
for (const r of results) {
  const top = r.findings.filter((f) => f.severity === 'high');
  console.log(`  ${r.path.padEnd(46)} ${String(r.score).padStart(3)}点  指摘${r.findings.length}件${top.length ? ` (high: ${[...new Set(top.map((f) => f.id))].join(', ')})` : ''}`);
}
console.log(`\nレポート: docs/quality/latest.md`);

if (STRICT && prev && total < prev.total) {
  console.error(`\nNG: スコアが前回(${prev.total})より低下しました。`);
  process.exit(1);
}
