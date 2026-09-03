#!/usr/bin/env node
/**
 * 生成サイトのページをヘッドレスChromiumでフルページ撮影する。
 *
 * design-score を「モデルの自己申告」から「参照キャプチャとの視覚比較」に
 * 変えるために必要。撮影した画像を参照LPのフルキャプチャと並べて
 * 独立モデルに採点させる (scripts/web-design-score.sh)。
 *
 * 使い方:
 *   node scripts/web-shoot-sample.mjs <route> <outfile> [--width 1280]
 *   node scripts/web-shoot-sample.mjs /samples/food/codex-20260802-0846/ /tmp/a.jpg
 *
 * dist/ の静的ファイルをその場でサーブして撮る (astro preview 不要)。
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');

const args = process.argv.slice(2);
const route = args[0];
const outfile = args[1];
const width = Number(args[args.indexOf('--width') + 1]) || 1280;

if (!route || !outfile) {
  console.error('usage: web-shoot-sample.mjs <route> <outfile> [--width N]');
  process.exit(2);
}
if (!existsSync(DIST)) {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(2);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = join(DIST, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
  // スクロール駆動アニメーション(RevealOnScroll等)を発火させてから撮る。
  // 撮らないと reveal 前の透明状態が写り、実際より貧弱に見える。
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: outfile, fullPage: true, type: 'jpeg', quality: 82 });
  console.log(JSON.stringify({ route, outfile, width }));
} finally {
  await browser.close();
  server.close();
}
