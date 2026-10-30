#!/usr/bin/env node
/**
 * 描画検証 — 静的解析では原理的に見えない欠陥を、実際に描画して捕まえる。
 *
 * なぜ必要か
 * ----------
 * corporate-20260903-1448 の実装は `web-quality-check.mjs` で 100/100・指摘ゼロ
 * だったが、実際にはトップページの4割が空白だった。原因は ScrollReveal の
 * `clip-up` が自分自身をクリップして交差判定を殺し、`is-visible` が永遠に
 * 付かないデッドロック。中の `loading="lazy"` 画像も読み込まれなかった。
 *
 * HTML を読むだけでは「出るはずの要素が出ていない」は判定できない。
 * ここはブラウザで開いてスクロールし、最終状態を見るしかない。
 *
 * 検査項目
 * --------
 *   render-low-contrast     背景に対して文字のコントラストが足りない（消えている）
 *   render-hidden-content   スクロールし切っても不可視のままの要素
 *   render-image-broken     読み込まれなかった img
 *   render-blank-region     可視要素が何も無い縦方向の空白帯
 *   render-console-error    JS エラー
 *   render-overflow-x       横スクロールの発生
 *
 * 使い方:
 *   npm run build && node scripts/web-render-check.mjs
 *   node scripts/web-render-check.mjs --route /sites/corporate/a-20260903-1448/
 *   node scripts/web-render-check.mjs --json
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'docs', 'quality');

const args = process.argv.slice(2);
const argOf = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const AS_JSON = args.includes('--json');
const ONLY_ROUTE = argOf('route');

// 空白帯とみなす高さ。1画面弱の空白は「余白の効かせ方」の範囲を超える。
const BLANK_MIN_PX = 700;
const VIEWPORT = { width: 1280, height: 900 };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
};

function collectRoutes(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    // handmaid は別フローの単体 HTML（scripts/handmaid-export.mjs）。website の描画検証の対象外
    if (p === join(DIST, 'handmaid')) continue;
    if (statSync(p).isDirectory()) collectRoutes(p, out);
    else if (name === 'index.html') out.push('/' + relative(DIST, p).replace(/index\.html$/, ''));
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(2);
}

const server = createServer((req, res) => {
  let p = join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream');
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// /components は部品を並べたカタログ。1枚の面としての構成を見るルール
// （空白帯・不可視要素）は当てはまらない。クロスフェードのレイヤーが
// 1枚だけ見えているのも、Diff のリサイザが透明なのも正しい実装である。
// 部品自体の欠陥は web-check-component-catalog.mjs で見る。
const CATALOG_ROUTES = new Set(['/components/']);
const routes = (ONLY_ROUTE ? [ONLY_ROUTE] : collectRoutes(DIST))
  .filter((r) => ONLY_ROUTE || !CATALOG_ROUTES.has(r))
  .sort();
const browser = await chromium.launch();
// 例外や強制終了でブラウザが残ると、ランを重ねるたびに Chromium が積み上がって
// OOM でタスクごと落ちる（実測 2026-09-09: 20 プロセス残留してメモリ枯渇）。
// 異常終了経路でも必ず閉じる。
const shutdown = async () => { try { await browser.close(); } catch {} try { server.close(); } catch {} };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(sig, async () => { await shutdown(); process.exit(130); });
}
process.once('uncaughtException', async (e) => { console.error(e); await shutdown(); process.exit(1); });

const results = [];

for (const route of routes) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 160)));
  page.on('requestfailed', (r) => failedRequests.push(r.url().replace(base, '').slice(0, 100)));
  page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().replace(base, '').slice(0, 100)}`); });

  try {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    results.push({ route, findings: [{ id: 'render-load-failed', severity: 'high', detail: 'ページを開けなかった' }] });
    await ctx.close();
    continue;
  }

  // 実ホイールでスクロールし、遅延読み込みとリビールを最後まで踏む
  const total = await page.evaluate(() => document.body.scrollHeight);
  const steps = Math.min(60, Math.ceil(total / (VIEWPORT.height * 0.6)));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, VIEWPORT.height * 0.6);
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(1200);

  const data = await page.evaluate(async (BLANK_MIN) => {
    // --- 1. 不可視のまま残った要素 ---
    const hidden = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.height < 40 || r.width < 40) continue;
      const invisible =
        Number(cs.opacity) < 0.05 ||
        /inset\(\s*(100%|9\d(\.\d+)?%)/.test(cs.clipPath) ||
        cs.clipPath === 'inset(100%)';
      if (!invisible) continue;
      // 意図的に隠しているUI（メニュー/ツールチップ/モーダル）は除外
      const cls = typeof el.className === 'string' ? el.className : '';
      if (/dropdown-content|modal|tooltip|sr-only|drawer-side|hidden/.test(cls)) continue;
      // DaisyUI の collapse / accordion / toggle / tab は、素の radio・checkbox を
      // opacity 0 の当たり判定として重ねて label 側で見せる作りになっている。
      // これは正しい実装なので不可視要素として数えない。
      // （text 入力が不可視なら本当の欠陥なので、そちらは残す）
      if (el.tagName === 'INPUT' && /^(radio|checkbox)$/i.test(el.getAttribute('type') || '')) continue;
      hidden.push({
        tag: el.tagName.toLowerCase(),
        cls: cls.slice(0, 60),
        h: Math.round(r.height),
        opacity: cs.opacity,
        clipPath: cs.clipPath.slice(0, 30),
        text: (el.textContent || '').trim().slice(0, 40),
      });
    }

    // --- 1.5 コントラスト不足（＝文字が見えていない） ---
    //
    // 実測: b案のファーストビューは、右カラムに text-base-100（ほぼ白）を当てた
    // まま背景も base-100 だったため、キャッチコピーと CTA が
    // コントラスト比 1.00 で完全に消えていた。DOM には h1 が存在するので
    // 静的チェックの a11y-h1 は通り、独立judge に
    // 「FVに事業内容が無い」と指摘されて初めて発覚した。
    //
    // 色は oklch などで返る。canvas の fillStyle は CSS Color 4 を
    // 正規化して返してくれない（実測: 'oklch(...)' がそのまま返る）ため、
    // **実際に 1px 塗って読み取る**。これなら表色系に依存しない。
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 1;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    const toRgb = (css) => {
      try {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return a < 240 ? null : [r, g, b];   // 半透明は判定しない
      } catch { return null; }
    };
    const lum = (rgb) => {
      const c = rgb.map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };

    const lowContrast = [];
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim()).join(' ').trim();
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const size = parseFloat(cs.fontSize) || 16;
      if (size < 8) continue;

      // 写真の上に載る文字は判定できない（写真の明度は場所によって違う）。
      // CSS の background-image だけでなく、**背後に敷かれた <img>** も見る。
      // ヒーローは img を absolute で敷く実装が多く、これを見落とすと
      // 「写真上の白抜き文字」を一律に誤検知する（実測で発生）。
      const behindMedia = (() => {
        // 実際の重なり順で背後を見る。ヘッダーのように「別セクションの写真の上へ
        // 載る」形は、祖先をたどるだけでは絶対に拾えない
        // （実測 2026-09-21: 写真上の白いナビ5件を「同色で不可視」と誤検知した）。
        const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
        if (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight) {
          const stack = document.elementsFromPoint(cx, cy);
          for (const node of stack) {
            if (node === el || el.contains(node)) continue;
            if (/^(img|video|canvas|picture|svg)$/i.test(node.tagName)) return true;
            const ncs = getComputedStyle(node);
            if (ncs.backgroundImage && ncs.backgroundImage !== 'none') return true;
          }
        }
        let a = el;
        for (let i = 0; a && i < 5; a = a.parentElement, i++) {
          for (const m of a.querySelectorAll(':scope > img, :scope > video, :scope > canvas, :scope > picture > img')) {
            const mcs = getComputedStyle(m);
            if (mcs.position !== 'absolute' && mcs.position !== 'fixed') continue;
            const mr = m.getBoundingClientRect();
            if (mr.left <= r.left + 2 && mr.right >= r.right - 2 &&
                mr.top <= r.top + 2 && mr.bottom >= r.bottom - 2) return true;
          }
        }
        return false;
      })();
      if (behindMedia) continue;

      // 背景を祖先方向にたどる。背景画像・グラデーションがあれば判定不能として飛ばす
      let bgCss = null, node = el, hasImage = false;
      while (node && node !== document.documentElement) {
        const ncs = getComputedStyle(node);
        if (ncs.backgroundImage && ncs.backgroundImage !== 'none') { hasImage = true; break; }
        const c = toRgb(ncs.backgroundColor);
        if (c) { bgCss = c; break; }
        node = node.parentElement;
      }
      if (hasImage || !bgCss) continue;
      const fg = toRgb(cs.color);
      if (!fg) continue;

      const cr = ratio(fg, bgCss);
      const isLarge = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = isLarge ? 3 : 4.5;
      if (cr >= need) continue;
      lowContrast.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40),
        text: own.slice(0, 30),
        ratio: Math.round(cr * 100) / 100,
        need,
        size: Math.round(size),
      });
    }

    // --- 2. 読み込まれなかった画像 ---
    const brokenImages = [...document.images]
      .filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => ({
        src: (i.getAttribute('src') || '').split('/').pop() || '(src なし)',
        loading: i.loading,
        rendered: Math.round(i.getBoundingClientRect().height),
      }));

    // --- 3. 空白帯 ---
    // 可視のテキスト/画像/背景つきブロックが占める縦方向の区間を集め、
    // 隙間が大きいところを空白帯として報告する。
    const spans = [];
    const walk = (el) => {
      for (const child of el.children) {
        const cs = getComputedStyle(child);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
        const r = child.getBoundingClientRect();
        if (r.height <= 0) continue;
        const isMedia = /^(img|video|canvas|svg|iframe)$/i.test(child.tagName);
        const ownText = [...child.childNodes]
          .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').length > 0;
        if (isMedia || ownText) {
          spans.push([r.top + window.scrollY, r.bottom + window.scrollY]);
        } else {
          walk(child);
        }
      }
    };
    window.scrollTo(0, 0);
    walk(document.body);
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1] + 8) last[1] = Math.max(last[1], s[1]);
      else merged.push([...s]);
    }
    const blanks = [];
    for (let i = 1; i < merged.length; i++) {
      const gap = merged[i][0] - merged[i - 1][1];
      if (gap >= BLANK_MIN) blanks.push({ from: Math.round(merged[i - 1][1]), to: Math.round(merged[i][0]), gap: Math.round(gap) });
    }

    // --- 4. テキストどうしの重なり ---
    // 絶対配置やマイナスマージン、視差の実装ミスで、別々の文章が同じ場所に
    // 描かれることがある。実測 2026-09-21: 視差を入れたヒーローで
    // 「仕事を知る」と主見出し・本文が重なり、どれも読めなくなった。
    // 静的解析では絶対に出ない（HTML としては正しい）。
    //
    // **スクロール位置を変えて測る。** 視差は動いて初めて重なるので、
    // 先頭で1回測るだけでは取り逃がす（実測 2026-09-21: 停止状態では重なり0、
    // スクロール中にヒーローが破綻していた）。
    const measureOverlaps = () => {
      const boxes = [];
      for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,a,span')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
        if (cs.position === 'fixed' || cs.position === 'sticky') continue; // ヘッダー等は重なって当然
        // 透過ヘッダーがヒーロー写真の上に載る形は定番の表現で、欠陥ではない
        if (el.closest('header, nav, [role="banner"], footer')) continue;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
        if (own.length < 4) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        if (r.bottom < 0 || r.top > window.innerHeight) continue; // 画面外は見えていない
        boxes.push({ el, r, text: own.slice(0, 24) });
      }
      const hits = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (w <= 2 || h <= 2) continue;
          const area = w * h;
          const smaller = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
          if (area > smaller * 0.35) hits.push({ a: a.text, b: b.text, ratio: Math.round((area / smaller) * 100) });
        }
      }
      return hits;
    };
    const overlapSeen = new Map();
    const docH = document.body.scrollHeight;
    for (const frac of [0, 0.15, 0.3, 0.5]) {
      window.scrollTo(0, Math.round(docH * frac));
      await new Promise((r) => setTimeout(r, 260));
      for (const o of measureOverlaps()) overlapSeen.set(`${o.a}|${o.b}`, o);
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
    const overlaps = [...overlapSeen.values()];

    // --- 4.5 別の層に覆われて読めない文字 ---
    // 「重なっている」だけでは足りない。絵として壊れているのに、文字どうしの
    // 矩形が重ならない形（画像レイヤーが文字の上に乗る）がある。
    // 実測 2026-09-21: 視差のヒーローで写真レイヤーが主見出しの上に乗り、
    // 見出しと本文が画面から消えた。文字の矩形は重なっていないので
    // render-text-overlap では出ない。**重なり順で判定する。**
    const coveredBy = (el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return null; // 画面外
      const pts = [
        [r.left + r.width * 0.2, r.top + r.height / 2],
        [r.left + r.width * 0.5, r.top + r.height / 2],
        [r.left + r.width * 0.8, r.top + r.height / 2],
      ];
      let hits = 0, who = '';
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
        const top = document.elementsFromPoint(Math.round(x), Math.round(y))[0];
        if (!top || top === el || el.contains(top) || top.contains(el)) continue;
        const tcs = getComputedStyle(top);
        const isMedia = /^(img|video|canvas|picture|svg)$/i.test(top.tagName);
        const bg = tcs.backgroundColor || '';
        const m = bg.match(/rgba?\(([^)]+)\)/);
        const alpha = m ? (m[1].split(',')[3] !== undefined ? parseFloat(m[1].split(',')[3]) : 1) : 0;
        const opaque = isMedia || alpha > 0.5 || (tcs.backgroundImage && tcs.backgroundImage !== 'none');
        if (opaque) { hits++; who = `${top.tagName}${top.className ? '.' + String(top.className).split(' ')[0] : ''}`; }
      }
      return hits >= 2 ? who : null;
    };
    const covered = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,li')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
      if (el.closest('header, nav, footer, [role="banner"]')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (own.length < 4) continue;
      const by = coveredBy(el);
      if (by) covered.push({ text: own.slice(0, 26), by });
    }

    // --- 4.6 ファーストビューに主見出しが出ているか ---
    // 1画面目に h1 が見えないサイトは、何の会社か分からないまま始まる。
    const h1 = document.querySelector('h1');
    let heroH1 = 'なし';
    if (h1) {
      const r = h1.getBoundingClientRect();
      const inFirstView = r.top < window.innerHeight * 1.1 && r.bottom > 0;
      const hidden = coveredBy(h1);
      heroH1 = !inFirstView ? '1画面目に無い' : hidden ? `覆われている(${hidden})` : 'ok';
    }

    // --- 4.7 巨大な文字の自動折り返し ---
    // 大きな文字が成り行きで折り返されると、数値と単位が割れたり
    // 1〜2文字だけが次行に落ちたりして品位が落ちる。
    // 実測 2026-09-21: 「240件超」「平均1.8倍」が巨大サイズのまま2行に割れた。
    // <br> で改行位置を指定しているものは意図的なので除く。
    const bigWrap = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,span,strong,dd,dt,div')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const fs = parseFloat(cs.fontSize) || 0;
      if (fs < 40) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (own.length < 2) continue;
      if (el.querySelector('br')) continue;              // 改行位置を指定している
      if (/pre|pre-wrap|pre-line/.test(cs.whiteSpace)) continue;
      const range = document.createRange(); range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
      if (rects.length < 2) continue;
      // 行数は高さで数える（同じ行で複数矩形になることがある）
      const tops = [...new Set(rects.map((r) => Math.round(r.top)))];
      if (tops.length < 2) continue;
      const maxW = Math.max(...rects.map((r) => r.width));
      const lastW = rects[rects.length - 1].width;
      bigWrap.push({ text: own.slice(0, 20), fs: Math.round(fs), lines: tops.length, orphan: lastW < maxW * 0.25 });
    }

    // --- 4.8 クリップされて切れている文字 ---
    // overflow:hidden の枠から文字がはみ出していると、
    // 途中で切れた見出しが別の面に写り込んだように見える。
    // 実測 2026-09-21: 「共に成長するチームへ」がヒーロー背景の上端で切れて残った。
    const clipped = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,li')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (own.length < 4) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 4) continue;
      let node = el.parentElement;
      for (let i = 0; node && i < 6; node = node.parentElement, i++) {
        const ncs = getComputedStyle(node);
        if (!/hidden|clip/.test(ncs.overflow) && !/hidden|clip/.test(ncs.overflowY)) continue;
        const nr = node.getBoundingClientRect();
        const visibleH = Math.min(r.bottom, nr.bottom) - Math.max(r.top, nr.top);
        if (visibleH > 0 && visibleH < r.height * 0.8) {
          clipped.push({ text: own.slice(0, 24), 見えている割合: Math.round((visibleH / r.height) * 100) });
        }
        break;
      }
    }

    // --- 4.9 カードの縦位置のばらつき ---
    // 横並びのカードで、中の要素の開始位置が揃っていないと雑に見える。
    const cardMisalign = [];
    for (const box of document.querySelectorAll('div,ul,ol,section')) {
      const cs = getComputedStyle(box);
      if (!/grid|flex/.test(cs.display)) continue;
      if (/column/.test(cs.flexDirection)) continue;
      const kids = [...box.children].filter((k) => {
        const kr = k.getBoundingClientRect();
        return kr.width > 120 && kr.height > 60;
      });
      if (kids.length < 2) continue;
      // 同じ行のカードだけを比べる
      const row = kids.filter((k) => Math.abs(k.getBoundingClientRect().top - kids[0].getBoundingClientRect().top) < 12);
      if (row.length < 2) continue;
      // 「カード」と呼べるのは同程度の幅で並んでいるものだけ。
      // ラベル列 + 本文列のような非対称の2カラムは、開始位置が違って当然
      // （実測 2026-09-21: 左に WORKFLOW、右に本文、という節を誤検出した）。
      const ws = row.map((k) => k.getBoundingClientRect().width);
      if (Math.max(...ws) > Math.min(...ws) * 1.3) continue;
      const firstTextTop = row.map((k) => {
        const t = k.querySelector('h1,h2,h3,h4,p,span,dt');
        if (!t) return null;
        return t.getBoundingClientRect().top - k.getBoundingClientRect().top;
      }).filter((v) => v !== null);
      if (firstTextTop.length < 2) continue;
      const spread = Math.max(...firstTextTop) - Math.min(...firstTextTop);
      if (spread > 24) cardMisalign.push({ 枚数: row.length, ずれ: Math.round(spread) });
    }

    // --- 5. 小さすぎる見出し ---
    // 見出しが本文と同じ大きさだと、階層が消えて平板になる。
    // 実測 2026-09-21: セクション見出しが 16px（本文と同寸）で出力された。
    const bodyFs = parseFloat(getComputedStyle(document.body).fontSize) || 16;
    const smallHeadings = [];
    for (const el of document.querySelectorAll('h1,h2')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || !el.textContent.trim()) continue;
      const fs = parseFloat(cs.fontSize);
      if (fs <= bodyFs * 1.15) smallHeadings.push({ tag: el.tagName, fs: Math.round(fs), text: el.textContent.trim().slice(0, 22) });
    }

    return {
      bigWrap: bigWrap.slice(0, 6),
      bigWrapCount: bigWrap.length,
      clipped: clipped.slice(0, 6),
      clippedCount: clipped.length,
      cardMisalign: cardMisalign.slice(0, 4),
      cardMisalignCount: cardMisalign.length,
      covered: covered.slice(0, 6),
      coveredCount: covered.length,
      heroH1,
      overlaps: overlaps.slice(0, 6),
      overlapCount: overlaps.length,
      smallHeadings: smallHeadings.slice(0, 6),
      smallHeadingCount: smallHeadings.length,
      bodyFs: Math.round(bodyFs),
      lowContrast: lowContrast.sort((a, b) => a.ratio - b.ratio).slice(0, 8),
      lowContrastCount: lowContrast.length,
      invisibleText: lowContrast.filter((c) => c.ratio < 1.3).length,
      hidden: hidden.slice(0, 8),
      hiddenCount: hidden.length,
      brokenImages,
      imageCount: document.images.length,
      blanks,
      pageHeight: document.body.scrollHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2
        ? { scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth } : null,
    };
  }, BLANK_MIN_PX);

  const findings = [];
  if (data.bigWrapCount) {
    findings.push({
      id: 'render-big-text-wrapped', severity: 'medium',
      detail: `大きな文字が成り行きで折り返されています ${data.bigWrapCount} 件: ` +
        data.bigWrap.map((b) => `「${b.text}」${b.fs}px/${b.lines}行${b.orphan ? '（末行が1〜2文字）' : ''}`).join(' / '),
    });
  }
  if (data.clippedCount) {
    findings.push({
      id: 'render-text-clipped', severity: 'high',
      detail: `枠からはみ出して切れている文字が ${data.clippedCount} 件: ` +
        data.clipped.map((c) => `「${c.text}」(${c['見えている割合']}%だけ見えている)`).join(' / '),
    });
  }
  if (data.cardMisalignCount) {
    findings.push({
      id: 'render-card-misaligned', severity: 'medium',
      detail: `横並びのカードで中身の開始位置が揃っていません ${data.cardMisalignCount} 箇所: ` +
        data.cardMisalign.map((c) => `${c['枚数']}枚でずれ ${c['ずれ']}px`).join(' / '),
    });
  }
  if (data.coveredCount) {
    findings.push({
      id: 'render-text-covered', severity: 'high',
      detail: `別の層に覆われて読めない文字が ${data.coveredCount} 件: ` +
        data.covered.map((c) => `「${c.text}」← ${c.by}`).join(' / '),
    });
  }
  if (data.heroH1 !== 'ok' && data.heroH1 !== 'なし') {
    findings.push({ id: 'render-hero-h1-hidden', severity: 'high', detail: `ファーストビューの主見出し: ${data.heroH1}` });
  }
  if (data.overlapCount) {
    findings.push({
      id: 'render-text-overlap', severity: 'high',
      detail: `文章どうしが重なっています ${data.overlapCount} 箇所: ` +
        data.overlaps.map((o) => `「${o.a}」と「${o.b}」(${o.ratio}%)`).join(' / '),
    });
  }
  if (data.smallHeadingCount) {
    findings.push({
      id: 'render-heading-too-small', severity: 'medium',
      detail: `見出しが本文(${data.bodyFs}px)とほぼ同寸です ${data.smallHeadingCount} 件: ` +
        data.smallHeadings.map((h) => `${h.tag} ${h.fs}px「${h.text}」`).join(' / '),
    });
  }
  if (data.lowContrastCount) {
    // 比 1.3 未満は「同色＝完全に消えている」。読みにくいのではなく存在しないのと同じ。
    findings.push({
      id: 'render-low-contrast',
      severity: data.invisibleText ? 'high' : 'medium',
      detail: `コントラスト不足 ${data.lowContrastCount} 件` +
        (data.invisibleText ? `（うち ${data.invisibleText} 件は同色で完全に不可視）` : '') + ': ' +
        data.lowContrast.map((c) => `${c.tag}"${c.text}"(比${c.ratio}, 要${c.need})`).slice(0, 4).join(' / '),
    });
  }
  if (data.hiddenCount) {
    findings.push({
      id: 'render-hidden-content', severity: 'high',
      detail: `スクロール後も不可視の要素が ${data.hiddenCount} 件: ` +
        data.hidden.map((h) => `${h.tag}.${h.cls.split(/\s+/)[0]}(h${h.h}, op${h.opacity}${h.clipPath !== 'none' ? `, clip ${h.clipPath}` : ''})`).slice(0, 4).join(' / '),
    });
  }
  if (data.brokenImages.length) {
    findings.push({
      id: 'render-image-broken', severity: 'high',
      detail: `読み込まれなかった画像 ${data.brokenImages.length}/${data.imageCount} 件: ` +
        data.brokenImages.map((i) => `${i.src}(${i.loading})`).slice(0, 5).join(', '),
    });
  }
  for (const b of data.blanks) {
    findings.push({
      id: 'render-blank-region', severity: 'medium',
      detail: `${b.from}px〜${b.to}px に ${b.gap}px の空白帯（可視要素なし）`,
    });
  }
  if (data.overflowX) {
    findings.push({
      id: 'render-overflow-x', severity: 'medium',
      detail: `横スクロールが発生（内容 ${data.overflowX.scrollWidth}px > ビューポート ${data.overflowX.viewport}px）`,
    });
  }
  if (consoleErrors.length) {
    findings.push({ id: 'render-console-error', severity: 'medium', detail: [...new Set(consoleErrors)].slice(0, 3).join(' / ') });
  }
  if (failedRequests.length) {
    findings.push({ id: 'render-request-failed', severity: 'high', detail: [...new Set(failedRequests)].slice(0, 5).join(', ') });
  }

  results.push({ route, pageHeight: data.pageHeight, imageCount: data.imageCount, findings });
  await ctx.close();
}

await shutdown();

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'render-check.json'),
  JSON.stringify({ checked_at: new Date().toISOString(), viewport: VIEWPORT, results }, null, 2));

if (AS_JSON) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const highs = results.flatMap((r) => r.findings.filter((f) => f.severity === 'high'));
  console.log(`\n描画検証: ${results.length} ページ`);
  for (const r of results) {
    if (!r.findings.length) { console.log(`  ✓ ${r.route}`); continue; }
    console.log(`  ✗ ${r.route}`);
    for (const f of r.findings) {
      console.log(`      ${f.severity === 'high' ? '🔴' : '🟡'} ${f.id}: ${f.detail}`);
    }
  }
  console.log(`\nレポート: docs/quality/render-check.json`);
  if (highs.length) {
    console.error(`\nNG: high の指摘が ${highs.length} 件あります。`);
    process.exit(1);
  }
}
