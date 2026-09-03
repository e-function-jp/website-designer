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

  const data = await page.evaluate((BLANK_MIN) => {
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

    return {
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

await browser.close();
server.close();

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
