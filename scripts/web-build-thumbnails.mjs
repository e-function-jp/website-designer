#!/usr/bin/env node
/**
 * 全サンプルサイトのカード用サムネイルを生成する。
 *
 * /sites/{type}/ の「代表サンプル」カード、および /sites/{type}/{model}-{stamp}/
 * の個別カードに `/thumbs/{type}/{model}-{stamp}.jpg` を使う。
 *
 * 設計の要点（lp-designer の lp-build-thumbnails.mjs の知見をそのまま引き継ぎ）:
 *   - dist を静的サーブしてヘッドレス Chromium で撮る。FVのみ（fullPage: false）。
 *     カードではページ全体の縦長画像より FV のほうが判別しやすいため。
 *   - 出力は public/thumbs/{type}/{model}-{stamp}.jpg。
 *   - --sync-dist で dist/thumbs/ にも配る。これが無いと、生成しても
 *     本番に載るのが次のビルド以降になる。
 *   - npm run build の postbuild で毎回走らせる。手順書のステップに
 *     しただけだと飛ばされ、壊れたカードの画像が出荷される事故が
 *     lp-designer で2度起きた (42件 + 2件)。未生成が無ければ
 *     Chromium を起動せず即終了するので常時実行しても安い。
 *   - --check で不足検査（不足なら exit 1）。--force で撮り直し。
 *
 * 撮影時の注意:
 *   サンプルサイトには View Transitions / ScrollReveal が入っている。
 *   ScrollReveal は初期状態で内側要素の opacity: 0 なので、撮影前に
 *   スクロールしないと空白のサムネイルになる。
 *   FV だけ撮るなら、いったん最下部までスクロールしてから先頭へ戻す。
 *   web-render-check.mjs の方法（実ホイールで刻む）を踏襲する。
 *
 * 使い方:
 *   node scripts/web-build-thumbnails.mjs              # 未生成のものだけ
 *   node scripts/web-build-thumbnails.mjs --sync-dist  # 生成分を dist/ にも配る
 *   node scripts/web-build-thumbnails.mjs --check      # 生成せず不足を検査 (exit 1)
 *   node scripts/web-build-thumbnails.mjs --force      # 全部撮り直し
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DIST = join(ROOT, 'dist');
const OUT_ROOT = join(ROOT, 'public', 'thumbs');
const DIST_THUMBS = join(DIST, 'thumbs');
const SITES_DIR = join(ROOT, 'src', 'pages', 'sites');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const CHECK = args.includes('--check');
// 撮った直後に dist/ にも配る。build 済みの成果物をそのままデプロイに回せる
// ようにするため (これが無いと生成しても本番に載るのが次のビルド以降になる)
const SYNC_DIST = args.includes('--sync-dist');

// カードのアスペクト比 (16:10)。Retina を考慮して 2x で撮る
const W = 1280;
const H = 800;

if (!existsSync(DIST)) {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(2);
}

/** src/pages/sites/{type}/{model}-{stamp}/index.astro の存在を dist からも逆引きして列挙する */
function collectRoutes() {
  const out = [];
  if (!existsSync(SITES_DIR)) return out;
  for (const type of readdirSync(SITES_DIR)) {
    const typeDir = join(SITES_DIR, type);
    if (!statSync(typeDir).isDirectory()) continue;
    for (const sample of readdirSync(typeDir)) {
      const d = join(typeDir, sample);
      if (!statSync(d).isDirectory()) continue;
      // 単発ページではなく _site.ts を持つサイト束だけを対象にする
      if (!existsSync(join(d, '_site.ts'))) continue;
      // ルート (/sites/{type}/{model}-{stamp}/) の index.html があれば dist 側も存在
      if (!existsSync(join(DIST, 'sites', type, sample, 'index.html'))) continue;
      out.push({
        type,
        slug: sample,
        route: `/sites/${type}/${sample}/`,
        outfile: join(OUT_ROOT, type, `${sample}.jpg`),
      });
    }
  }
  return out;
}

const routes = collectRoutes();
const pending = FORCE ? routes : routes.filter((r) => !existsSync(r.outfile));

if (CHECK) {
  // 生成はせず不足だけを報告する。出荷前ゲート用
  const missing = routes.filter((r) => !existsSync(r.outfile));
  if (missing.length) {
    console.error(`サムネイル未生成 ${missing.length}件:`);
    for (const m of missing) console.error(`  - public/thumbs/${m.type}/${m.slug}.jpg (${m.route})`);
    console.error('`node scripts/web-build-thumbnails.mjs --sync-dist` で生成してください。');
    process.exit(1);
  }
  console.log(`サムネイル OK: ${routes.length}件すべて存在します。`);
  process.exit(0);
}

/** public/thumbs の内容を dist/thumbs へ配る (astro build は public/ をビルド時にコピー済みのため) */
function syncToDist(list) {
  if (!SYNC_DIST) return 0;
  let n = 0;
  for (const { type, slug, outfile } of list) {
    if (!existsSync(outfile)) continue;
    const dest = join(DIST_THUMBS, type, `${slug}.jpg`);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(outfile, dest);
    n++;
  }
  return n;
}

if (pending.length === 0) {
  // Chromium を起動しないで抜ける。毎ビルド走らせても実質ゼロコストにするため
  console.log(JSON.stringify({ total: routes.length, made: 0, skipped: routes.length, failed: 0, out: 'public/thumbs/' }));
  process.exit(0);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  // playwright が入っていない環境でビルド自体を壊さない
  console.error('playwright が見つからないためサムネイル生成をスキップしました (未生成 ' + pending.length + '件)。');
  process.exit(0);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let file = join(DIST, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch();
let made = 0, failed = 0;
const madeList = [];

try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const entry of pending) {
    const { route, outfile } = entry;
    mkdirSync(dirname(outfile), { recursive: true });
    try {
      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
      // ScrollReveal は初期状態で内側要素の opacity: 0。
      // 撮影前に最下部までスクロール → 先頭へ戻し、リビールを発火させた状態にする。
      // window.scrollTo は Lenis 等の仮想スクロールで効かない系があるため、
      // web-render-check.mjs と同じく実ホイール (page.mouse.wheel) で刻む。
      const viewportH = H;
      await page.mouse.wheel(0, 0); // 念のため初期化
      let y = 0;
      // 60 段刻みで最大 60*viewportH*0.6 まで (長尺ページ対策)
      for (let i = 0; i < 60; i++) {
        await page.mouse.wheel(0, viewportH * 0.6);
        await page.waitForTimeout(160);
        y += viewportH * 0.6;
        // 余分に回しても意味が無いので、ある程度上まで来たら抜ける
        const total = await page.evaluate(() => document.body.scrollHeight);
        if (y >= total) break;
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: outfile, type: 'jpeg', quality: 78 });
      made++;
      madeList.push(entry);
    } catch (e) {
      console.error(`FAIL ${route}: ${e.message.split('\n')[0]}`);
      failed++;
    }
  }
} finally {
  await browser.close();
  server.close();
}

// FORCE 時は既存分も撮り直しているので dist へは撮れた全件を配る
const synced = syncToDist(SYNC_DIST ? (FORCE ? routes : madeList) : []);

console.log(JSON.stringify({
  total: routes.length, made, skipped: routes.length - pending.length, failed,
  synced_to_dist: SYNC_DIST ? synced : null, out: 'public/thumbs/',
}, null, 2));

// 撮れなかったものがあっても build 自体は落とさない (壊れたカードは --check で止める)
if (failed) console.error(`サムネイル生成に ${failed}件失敗しました。npm run check 前に確認してください。`);