#!/usr/bin/env node
/**
 * handmaid/ 配下を静的サーブするプレビューサーバ。
 *
 * website-designer 本体 (Astro) や vision-bench (report) とは独立した手元検証用。
 * ブラウザで WebGL や Lenis の挙動を確認するためのもの。ビルド不要・依存ライブラリ
 * なし (Node の http 標準だけ)。
 *
 * 使い方:
 *   node scripts/handmaid-preview.mjs                # 任意の空きポートで起動
 *   node scripts/handmaid-preview.mjs --port 8767    # ポート固定 (空いていれば)
 *   node scripts/handmaid-preview.mjs --root handmaid # 別ディレクトリをサーブ
 *
 * 起動すると、登録済みの handmaid サンプル (ディレクトリ末尾が英数字の id) を
 * 一覧で出力し、`http://127.0.0.1:<port>/` をブラウザで開けば良い。
 * サンプル個別には `http://127.0.0.1:<port>/<sample-id>/` でアクセスできる。
 *
 * index ページは手書きせず、起動時に on-the-fly でディレクトリ列挙ページを返す。
 * 各サンプルの `<sample-id>/index.html` が見つかったら自動リンクする。
 * 一覧の HTML は scripts/handmaid-index.mjs にあり、本番書き出しと共有している。
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, relative, sep, dirname } from 'node:path';
import { listSamples, renderIndexHTML } from './handmaid-index.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const HANDMAID_DIR = join(ROOT, 'handmaid');

const args = process.argv.slice(2);
const argIndex = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const HOST = argIndex('host') ?? '127.0.0.1';
const PORT = Number(argIndex('port') ?? 0) || 0;
const SERVE_ROOT = argIndex('root') ?? HANDMAID_DIR;

if (!existsSync(SERVE_ROOT) || !statSync(SERVE_ROOT).isDirectory()) {
  console.error(`ERROR: サーブ対象が見つかりません: ${SERVE_ROOT}`);
  process.exit(2);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
};

/** パス暴発防止。SERVE_ROOT の外に抜けないか必ず検査する。 */
function resolveSafe(reqPath) {
  let decoded;
  try { decoded = decodeURIComponent(reqPath); } catch { return null; }
  const cleaned = decoded.split('?')[0].replace(/^\/+/, '');
  const target = join(SERVE_ROOT, cleaned);
  const rel = relative(SERVE_ROOT, target);
  if (rel.startsWith('..') || rel === '..' + sep) return null;
  return target;
}

function serveFile(filePath, res) {
  if (!existsSync(filePath)) { res.statusCode = 404; res.end('not found'); return; }
  const st = statSync(filePath);
  if (st.isDirectory()) {
    const idx = join(filePath, 'index.html');
    if (existsSync(idx)) { serveFile(idx, res); return; }
    // ディレクトリ自体へのリクエスト → index を on-the-fly で生成
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(renderIndexHTML(listSamples(SERVE_ROOT)));
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream');
  res.end(readFileSync(filePath));
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('method not allowed');
    return;
  }
  const filePath = resolveSafe(req.url || '/');
  if (!filePath) {
    res.statusCode = 400;
    res.end('bad path');
    return;
  }
  serveFile(filePath, res);
});

server.listen(PORT, HOST, () => {
  const addr = server.address();
  const url = `http://${addr.address}:${addr.port}`;
  console.log(`handmaid preview running`);
  console.log(`  serve root: ${SERVE_ROOT}`);
  console.log(`  index:      ${url}/`);
  const samples = listSamples(SERVE_ROOT);
  if (samples.length > 0) {
    console.log(`  samples:`);
    for (const s of samples) {
      const tag = s.hasIndex ? '✓' : '✗';
      console.log(`    ${tag} ${url}/${s.path}`);
    }
  }
  console.log(`  Ctrl+C で停止`);
});

// SIGINT (Ctrl+C) で明示的に閉じる。Astro preview と同じ挙動。
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n${sig} 受信 — server を閉じます`);
    server.close(() => process.exit(0));
    // 2 秒経っても閉じない場合は強制終了
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

