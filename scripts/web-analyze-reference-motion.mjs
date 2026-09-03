#!/usr/bin/env node
/**
 * 参照サイトのモーション（アニメーション）を実測する。
 *
 * lp-designer の `lp-analyze-external-site.mjs`（Awwwards 1ページ解析）を土台に、
 * website 向けに拡張したもの。LP 版との違いは 4 点:
 *
 *   1. 複数ページを解析し、**ページ間でモーションが揃っているか**を見る。
 *      website の演出品質は「トップだけ派手で下層は無演出」という形で崩れる。
 *   2. **スクロールリビールを実測する。** muuuuu 掲載サイトの主役の演出であり、
 *      静止した getAnimations() だけでは検出できない（トリガー前は存在しないため）。
 *      スクロール前後で DOM の class / opacity / transform を差分比較して拾う。
 *   3. **ページ遷移演出**（ローディング画面 / barba / swup / View Transitions）を検出する。
 *      1ページの LP には存在しなかった、website 固有のモーション層。
 *   4. **prefers-reduced-motion を尊重しているか**を、実際に2回描画して比較検証する。
 *
 * 出力:
 *   {run_dir}/motion/{page-slug}.json   … ページごとの実測
 *   {run_dir}/motion/summary.json       … ページ横断のサマリ（ディレクターが読む正本）
 *   {run_dir}/motion/{page-slug}-{top,scrolled}.jpg … 参考キャプチャ
 *
 * 使い方:
 *   node scripts/web-analyze-reference-motion.mjs --url=https://example.co.jp/ \
 *        --out=docs/quality/runs/corporate-20260903-1400 [--pages=/,/about/,/service/]
 *   node scripts/web-analyze-reference-motion.mjs --url=... --out=... --follow-nav=3
 *     └ グローバルナビから下層ページを自動で3件たどる
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;

const URL_ARG = arg('url');
const OUT_DIR = arg('out');
const PAGES_ARG = arg('pages');
const FOLLOW_NAV = Number(arg('follow-nav', '2'));
const VIEWPORT = { width: 1440, height: 900 };

if (!URL_ARG || !OUT_DIR) {
  console.error('usage: web-analyze-reference-motion.mjs --url=<url> --out=<run_dir> [--pages=/,/about/] [--follow-nav=2]');
  process.exit(2);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const slugify = (u) => {
  const p = new URL(u).pathname.replace(/^\/|\/$/g, '');
  return p ? p.replace(/[^\w-]+/g, '-') : 'top';
};

/** ページ内で実行する計測本体。ブラウザ側の関数なので Node の変数を参照しない。 */
async function measure(page) {
  // --- 1. スクロール前のスナップショット（リビール検出の基準） ---
  const before = await page.evaluate(() => {
    const out = new Map();
    let i = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (i++ > 3000) break;                      // 巨大ページの暴走を防ぐ
      const cs = getComputedStyle(el);
      // 画面外にある要素だけを候補にする。リビールは「入ってきたら動く」演出なので、
      // 最初から見えている要素の状態を記録しても意味がない。
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 1.2) continue;
      out.set(el, null);
      el.dataset.__motionProbe = String(i);
      el.dataset.__motionBefore = JSON.stringify({
        cls: el.className && typeof el.className === 'string' ? el.className : '',
        op: cs.opacity,
        tf: cs.transform,
        vis: cs.visibility,
        clip: cs.clipPath,
        filter: cs.filter,
      });
    }
    return { probed: out.size };
  });

  // --- 2. ゆっくりスクロールしてトリガーを踏む ---
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.6;
    const total = document.body.scrollHeight;
    for (let y = 0; y < total; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 320));
    }
  });
  await page.waitForTimeout(1200);

  // --- 3. スクロール後の差分＋各種検出 ---
  const data = await page.evaluate(() => {
    // 3-1. スクロールリビールの実測
    const reveals = [];
    for (const el of document.querySelectorAll('[data-__motion-probe], [data-__motionProbe]')) {
      const raw = el.dataset.__motionBefore;
      if (!raw) continue;
      const b = JSON.parse(raw);
      const cs = getComputedStyle(el);
      const changed = [];
      if (b.op !== cs.opacity) changed.push('opacity');
      if (b.tf !== cs.transform) changed.push('transform');
      if (b.vis !== cs.visibility) changed.push('visibility');
      if (b.clip !== cs.clipPath) changed.push('clip-path');
      if (b.filter !== cs.filter) changed.push('filter');
      const nowCls = typeof el.className === 'string' ? el.className : '';
      const addedCls = nowCls.split(/\s+/).filter((c) => c && !b.cls.split(/\s+/).includes(c));
      if (!changed.length && !addedCls.length) continue;
      reveals.push({
        tag: el.tagName.toLowerCase(),
        baseClass: b.cls.slice(0, 120),
        addedClass: addedCls.slice(0, 4),
        changedProps: changed,
        from: { opacity: b.op, transform: b.tf },
        to: { opacity: cs.opacity, transform: cs.transform },
        transition: cs.transitionProperty === 'none' ? null : {
          property: cs.transitionProperty,
          duration: cs.transitionDuration,
          delay: cs.transitionDelay,
          timing: cs.transitionTimingFunction,
        },
        textSnippet: (el.textContent || '').trim().slice(0, 40),
      });
    }

    // 3-2. Web Animations API（CSS animation / WAAPI 由来）
    const animations = document.getAnimations().map((a) => {
      const eff = a.effect;
      const t = eff?.getComputedTiming ? eff.getComputedTiming() : {};
      const props = new Set();
      for (const kf of (eff?.getKeyframes ? eff.getKeyframes() : [])) {
        for (const k of Object.keys(kf)) {
          if (!['offset', 'composite', 'easing'].includes(k)) props.add(k);
        }
      }
      const target = eff?.target;
      return {
        playState: a.playState,
        type: a.constructor.name,
        target: target ? {
          tag: target.tagName,
          className: typeof target.className === 'string' ? target.className.slice(0, 100) : '',
        } : null,
        timing: { duration: t.duration, delay: t.delay, iterations: t.iterations, easing: t.easing },
        cssProps: [...props],
      };
    });

    // 3-3. ライブラリ検出
    const has = (sel) => !!document.querySelector(sel);
    const libs = {
      gsap: typeof window.gsap !== 'undefined' ? (window.gsap.version || 'present') : null,
      ScrollTrigger: typeof window.ScrollTrigger !== 'undefined' ? 'present' : null,
      lenis: typeof window.Lenis !== 'undefined' || has('[class*="lenis"]') ? 'present' : null,
      locomotiveScroll: typeof window.LocomotiveScroll !== 'undefined' || has('[data-scroll-container]') ? 'present' : null,
      aos: typeof window.AOS !== 'undefined' || has('[data-aos]') ? 'present' : null,
      swiper: typeof window.Swiper !== 'undefined' || has('.swiper') ? 'present' : null,
      lottie: has('lottie-player, [data-lottie], [src*="lottie"]') ? 'present' : null,
      threejs: typeof window.THREE !== 'undefined' ? 'present' : null,
      animejs: typeof window.anime !== 'undefined' ? 'present' : null,
      // --- website 固有: ページ遷移系 ---
      barba: typeof window.barba !== 'undefined' ? 'present' : null,
      swup: typeof window.Swup !== 'undefined' ? 'present' : null,
      viewTransitions: (() => {
        // API の存在だけでは判定にならない（Chrome では常に存在する）。
        // 実際に使われている痕跡（view-transition-name / @view-transition）で見る。
        if (has('[style*="view-transition-name"]')) return 'in-use';
        try {
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule.cssText && /view-transition/i.test(rule.cssText)) return 'in-use';
              }
            } catch { /* CORS */ }
          }
        } catch { /* noop */ }
        return null;
      })(),
      astroTransitions: has('[data-astro-transition-scope]') ? 'present' : null,
    };

    // 3-4. ページ遷移・ローディング演出の痕跡
    const loaderSel = '[class*="loading"], [class*="loader"], [id*="loading"], [id*="loader"], [class*="splash"], [class*="opening"]';
    const loaders = [...document.querySelectorAll(loaderSel)].slice(0, 5).map((el) => ({
      tag: el.tagName.toLowerCase(),
      className: (typeof el.className === 'string' ? el.className : '').slice(0, 100),
      displayNow: getComputedStyle(el).display,
      opacityNow: getComputedStyle(el).opacity,
    }));

    // 3-5. CSS ルール統計
    let keyframes = 0, transitionRules = 0, animationRules = 0;
    const keyframeNames = new Set();
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.type === CSSRule.KEYFRAMES_RULE) { keyframes++; keyframeNames.add(rule.name); }
            if (rule.style?.transition) transitionRules++;
            if (rule.style?.animationName && rule.style.animationName !== 'none') animationRules++;
          }
        } catch { /* CORS */ }
      }
    } catch { /* noop */ }

    // 3-6. ページ規模
    const meta = {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim().slice(0, 100) || null,
      totalHeight: document.body.scrollHeight,
      viewportsTall: Math.round((document.body.scrollHeight / window.innerHeight) * 10) / 10,
      sectionCount: document.querySelectorAll('section, [class*="section"]').length,
      imgCount: document.images.length,
      videoCount: document.querySelectorAll('video').length,
      canvasCount: document.querySelectorAll('canvas').length,
    };

    return {
      reveals, animations, libs, loaders, meta,
      css: { keyframes, transitionRules, animationRules, keyframeNames: [...keyframeNames].slice(0, 20) },
    };
  });

  // --- 4. ヘッダーのスクロール挙動（website 固有） ---
  const header = await page.evaluate(async () => {
    // 単純な querySelector だと、ドロワー内の高さ0のヘッダ要素を掴むことがある
    // （実測: aito.co.jp で .l-drawer__header を拾って全項目が 0 になった）。
    // 実際に画面上部に居て高さを持つものだけを候補にする。
    const candidates = [...document.querySelectorAll('header, [role="banner"], [class*="header"], [class*="Header"]')];
    const h = candidates.find((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.height > 30 && r.width > window.innerWidth * 0.5
        && cs.display !== 'none' && cs.visibility !== 'hidden' && r.top < window.innerHeight * 0.5;
    });
    if (!h) return null;
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
    const a = h.getBoundingClientRect();
    const csA = getComputedStyle(h);
    const snapA = { height: Math.round(a.height), top: Math.round(a.top), bg: csA.backgroundColor, cls: (typeof h.className === 'string' ? h.className : '') };
    window.scrollTo(0, window.innerHeight * 2);
    await new Promise((r) => setTimeout(r, 700));
    const b = h.getBoundingClientRect();
    const csB = getComputedStyle(h);
    const snapB = { height: Math.round(b.height), top: Math.round(b.top), bg: csB.backgroundColor, cls: (typeof h.className === 'string' ? h.className : '') };
    return {
      position: csB.position,
      atTop: snapA, scrolled: snapB,
      shrinks: snapA.height !== snapB.height,
      hides: snapB.top < -10,
      changesBackground: snapA.bg !== snapB.bg,
      togglesClass: snapA.cls !== snapB.cls,
    };
  });

  return { ...data, header, probedBefore: before.probed };
}

async function analyzePage(browser, url, outDir, { reducedMotion = false } = {}) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT, userAgent: UA, locale: 'ja-JP',
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const slug = slugify(url);
  let error = null;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    error = e.message.split('\n')[0];
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
    catch (e2) { await ctx.close(); return { url, slug, error: e2.message.split('\n')[0] }; }
  }
  await page.waitForTimeout(2500);

  let shots = {};
  if (!reducedMotion) {
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      const top = join(outDir, `${slug}-top.jpg`);
      await page.screenshot({ path: top, quality: 72, type: 'jpeg' });
      shots.top = top;
    } catch { /* noop */ }
  }

  const result = await measure(page);

  if (!reducedMotion) {
    try {
      const full = join(outDir, `${slug}-full.jpg`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: full, fullPage: true, quality: 65, type: 'jpeg' });
      shots.full = full;
    } catch { /* noop */ }
  }

  // ナビリンク（下層ページ追跡用）
  const navLinks = await page.evaluate(() => {
    const navs = [...document.querySelectorAll('nav')];
    const best = navs.sort((a, b) => b.querySelectorAll('a').length - a.querySelectorAll('a').length)[0];
    if (!best) return [];
    return [...best.querySelectorAll('a')]
      .map((a) => ({ href: a.href, label: (a.textContent || '').trim().slice(0, 30) }))
      .filter((l) => l.href && !l.href.startsWith('mailto:') && !l.href.startsWith('tel:'));
  });

  await ctx.close();
  return { url, slug, error, shots, navLinks, ...result };
}

/** リビールを人が読める語彙に丸める。ディレクションで指示できる粒度にするのが目的。 */
function classifyReveals(reveals) {
  const kinds = { fade: 0, 'fade-up': 0, 'fade-side': 0, zoom: 0, 'clip-wipe': 0, blur: 0, 'lazy-blur-up': 0, other: 0 };
  const durations = [];
  const easings = new Set();
  for (const r of reveals) {
    const to = r.to.transform || '';
    const from = r.from.transform || '';
    const moved = from !== to && from !== 'none';
    const m = from.match(/matrix\(([^)]+)\)/) || from.match(/matrix3d\(([^)]+)\)/);
    let dx = 0, dy = 0, scale = 1;
    if (m) {
      const n = m[1].split(',').map(Number);
      if (n.length === 6) { dx = n[4]; dy = n[5]; scale = n[0]; }
      else if (n.length === 16) { dx = n[12]; dy = n[13]; scale = n[0]; }
    }
    // 判定順が結果を決める。移動を伴うものを先に見ないと、
    // 画像の遅延読み込み blur-up（filter が変わるだけ）に引きずられて
    // 全部 'blur' に分類されてしまう（実測: aito.co.jp で 33件が誤分類）。
    const isImg = r.tag === 'img' || r.tag === 'picture';
    const blurUp = isImg && r.changedProps.length === 1 && r.changedProps[0] === 'filter';
    if (blurUp) kinds['lazy-blur-up']++;                                     // 演出ではない
    else if (moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4) kinds['fade-up']++;
    else if (moved && Math.abs(dx) > 4) kinds['fade-side']++;
    else if (moved && Math.abs(scale - 1) > 0.02) kinds.zoom++;
    else if (r.changedProps.includes('clip-path')) kinds['clip-wipe']++;
    else if (r.changedProps.includes('filter')) kinds.blur++;
    else if (r.changedProps.includes('opacity')) kinds.fade++;
    else kinds.other++;

    if (r.transition?.duration) {
      for (const d of r.transition.duration.split(',')) {
        const v = parseFloat(d);
        if (v > 0) durations.push(Math.round(v * 1000));
      }
    }
    // transition-timing-function のカンマは cubic-bezier(0.165, 0.84, ...) の内側にも
    // 出るので、単純な split(',') では 'cubic-bezier(0.165' に千切れる。
    if (r.transition?.timing) {
      const first = r.transition.timing.match(/^\s*(cubic-bezier\([^)]*\)|steps\([^)]*\)|[a-z-]+)/i);
      if (first) easings.add(first[1].trim());
    }
  }
  durations.sort((a, b) => a - b);
  return {
    total: reveals.length,
    kinds,
    // lazy-blur-up は遅延読み込みの副作用であって意図した演出ではないため、
    // 「支配的な演出」の候補からは外す。
    dominantKind: Object.entries(kinds)
      .filter(([k]) => k !== 'lazy-blur-up')
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    designedRevealCount: reveals.length - kinds['lazy-blur-up'],
    durationMs: durations.length
      ? { min: durations[0], median: durations[Math.floor(durations.length / 2)], max: durations.at(-1) }
      : null,
    easings: [...easings].slice(0, 5),
  };
}

const main = async () => {
  // --out は repo 相対でも絶対パスでも受ける
  const outDir = join(isAbsolute(OUT_DIR) ? OUT_DIR : join(ROOT, OUT_DIR), 'motion');
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const results = [];

  console.log(`==> analyze ${URL_ARG}`);
  const top = await analyzePage(browser, URL_ARG, outDir);
  results.push(top);

  // 解析対象ページの決定
  let targets = [];
  if (PAGES_ARG) {
    targets = PAGES_ARG.split(',').map((p) => new URL(p.trim(), URL_ARG).toString()).filter((u) => u !== top.url);
  } else if (FOLLOW_NAV > 0 && top.navLinks?.length) {
    const origin = new URL(URL_ARG).origin;
    const seen = new Set([new URL(URL_ARG).pathname.replace(/\/$/, '')]);
    for (const l of top.navLinks) {
      if (targets.length >= FOLLOW_NAV) break;
      let u;
      try { u = new URL(l.href); } catch { continue; }
      if (u.origin !== origin) continue;
      const key = u.pathname.replace(/\/$/, '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      targets.push(u.toString());
    }
  }

  for (const t of targets) {
    console.log(`==> analyze ${t}`);
    results.push(await analyzePage(browser, t, outDir));
  }

  // prefers-reduced-motion 尊重の検証（トップのみ）
  console.log('==> analyze (prefers-reduced-motion: reduce)');
  const reduced = await analyzePage(browser, URL_ARG, outDir, { reducedMotion: true });
  await browser.close();

  // --- ページごとの保存 ---
  const pageSummaries = [];
  for (const r of results) {
    if (r.error && !r.reveals) {
      pageSummaries.push({ url: r.url, slug: r.slug, error: r.error });
      writeFileSync(join(outDir, `${r.slug}.json`), JSON.stringify(r, null, 2));
      continue;
    }
    const reveal = classifyReveals(r.reveals ?? []);
    const detail = {
      ...r,
      // 生の reveals は数百件になるので、保存は先頭30件に絞る
      reveals: (r.reveals ?? []).slice(0, 30),
      revealSummary: reveal,
    };
    writeFileSync(join(outDir, `${r.slug}.json`), JSON.stringify(detail, null, 2));
    pageSummaries.push({
      url: r.url, slug: r.slug,
      title: r.meta?.title,
      viewportsTall: r.meta?.viewportsTall,
      revealCount: reveal.total,
      dominantKind: reveal.dominantKind,
      durationMs: reveal.durationMs,
      easings: reveal.easings,
      runningAnimations: (r.animations ?? []).filter((a) => a.playState === 'running').length,
      keyframes: r.css?.keyframes ?? 0,
      header: r.header,
      libs: Object.fromEntries(Object.entries(r.libs ?? {}).filter(([, v]) => v)),
    });
  }

  // --- ページ横断サマリ（ディレクターが読む正本） ---
  const ok = pageSummaries.filter((p) => !p.error);
  const revealCounts = ok.map((p) => p.revealCount);
  const spread = revealCounts.length > 1
    ? Math.max(...revealCounts) - Math.min(...revealCounts) : 0;

  const reducedReveal = classifyReveals(reduced.reveals ?? []);
  const normalReveal = classifyReveals(results[0].reveals ?? []);

  const summary = {
    reference_url: URL_ARG,
    analyzed_at: new Date().toISOString(),
    pages: pageSummaries,
    cross_page: {
      // トップだけ演出過多で下層が無演出、という website 特有の崩れ方を数値で出す
      reveal_count_by_page: Object.fromEntries(ok.map((p) => [p.slug, p.revealCount])),
      reveal_count_spread: spread,
      motion_consistent: spread <= Math.max(8, Math.min(...(revealCounts.length ? revealCounts : [0])) * 1.5),
      libs_union: [...new Set(ok.flatMap((p) => Object.keys(p.libs ?? {})))],
      header_behavior: ok[0]?.header ?? null,
    },
    reduced_motion: {
      reveal_count_normal: normalReveal.total,
      reveal_count_reduced: reducedReveal.total,
      // 減っていれば prefers-reduced-motion を見ている可能性が高い
      respected: reducedReveal.total < normalReveal.total * 0.6,
    },
    page_transition: {
      libs: Object.fromEntries(Object.entries(results[0].libs ?? {})
        .filter(([k, v]) => v && ['barba', 'swup', 'viewTransitions', 'astroTransitions'].includes(k))),
      loader_candidates: results[0].loaders ?? [],
    },
    // ディレクションにそのまま転記できる語彙
    direction_hints: {
      dominant_reveal: normalReveal.dominantKind,
      duration_ms: normalReveal.durationMs,
      easings: normalReveal.easings,
      reveal_kinds: normalReveal.kinds,
      page_length_viewports: ok.map((p) => p.viewportsTall),
    },
  };

  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\nモーション解析完了 → ${join(OUT_DIR, 'motion')}/`);
  for (const p of pageSummaries) {
    if (p.error) { console.log(`  ${p.slug.padEnd(16)} ERROR: ${p.error}`); continue; }
    console.log(`  ${p.slug.padEnd(16)} reveal ${String(p.revealCount).padStart(3)}件 (${p.dominantKind}) / ${p.viewportsTall}画面分 / keyframes ${p.keyframes}`);
  }
  console.log(`  ページ間のリビール数の開き: ${spread}（一貫性: ${summary.cross_page.motion_consistent ? 'OK' : '要注意 — トップだけ演出過多の可能性'}）`);
  console.log(`  reduced-motion 尊重: ${summary.reduced_motion.respected ? 'あり' : 'なし/不明'} (${normalReveal.total} → ${reducedReveal.total})`);
  console.log(`  検出ライブラリ: ${summary.cross_page.libs_union.join(', ') || '(なし=自前実装)'}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
