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
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, relative, sep, dirname } from 'node:path';

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

/** SERVE_ROOT 配下のディレクトリを「サンプル」として列挙 (直下のみ・英数字 id) */
function listSamples() {
  const out = [];
  for (const name of readdirSync(SERVE_ROOT)) {
    if (name.startsWith('.')) continue;
    const p = join(SERVE_ROOT, name);
    if (!statSync(p).isDirectory()) continue;
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name)) continue;
    out.push({
      id: name,
      path: `/${name}/`,
      hasIndex: existsSync(join(p, 'index.html')),
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

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
    res.end(renderIndexHTML());
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream');
  res.end(readFileSync(filePath));
}

function renderIndexHTML() {
  const samples = listSamples();
  const cards = samples.length === 0
    ? `<p class="empty">handmaid/ にサンプルが見つかりません。サブディレクトリを 1 つ作ってください（例: <code>handmaid/001-my-sample/index.html</code>）。</p>`
    : `<ul class="grid">${samples.map((s) => `
        <li class="card${s.hasIndex ? '' : ' card--missing'}">
          <a href="${s.path}">
            ${s.hasIndex ? `<span class="border-glow" aria-hidden="true">
              <span class="border-glow-blob"></span>
              <span class="border-glow-blob"></span>
            </span>` : ''}
            <span class="card__body">
              <span class="card__id">${escapeHtml(s.id)}</span>
              <span class="card__status">${s.hasIndex ? 'index.html あり' : 'index.html なし（クリックで開けない）'}</span>
            </span>
          </a>
        </li>`).join('')}
      </ul>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>handmaid — preview</title>
<style>
  :root { color-scheme: dark light; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", "Noto Sans JP", sans-serif; margin: 0; background: #0c0d10; color: #e7e9ee; }
  main { max-width: 60rem; margin: 0 auto; padding: 4rem 1.5rem 6rem; }
  h1 { font-size: 1.75rem; letter-spacing: -0.02em; margin: 0 0 .25rem; }
  .sub { color: #9aa3b2; font-size: .95rem; margin: 0 0 2rem; }
  .grid { list-style: none; padding: 0; margin: 1.25rem 0 0; display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }
  .card a { position: relative; display: flex; flex-direction: column; gap: 0; padding: 1rem 1.1rem; border: 1px solid #1f232c; border-radius: .75rem; background: #11141a; text-decoration: none; color: inherit; transition: border-color .15s, transform .15s; }
  .card a:hover { border-color: #4d8dff; transform: translateY(-1px); }
  .card--missing a { opacity: .55; cursor: not-allowed; pointer-events: none; }
  .card__body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: .35rem; }
  .card__id { font-weight: 600; font-size: 1.05rem; }
  .card__status { font-size: .8rem; color: #8a93a3; }
  .empty { color: #b9becf; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #161922; padding: .1em .35em; border-radius: .25rem; }

  /* ── Rotating border glow (getlayers.ai 風) ─────────────────────────
     1.5px のリングを mask-composite:exclude で切り抜き、その上を
     radial-gradient のブロブ 2 個が 180° 位相で周回する。
     --lift を hover で 0→1 にして opacity を持ち上げる。
  */
  .border-glow {
    --lift: 0;
    --accent: #4d8dff;
    position: absolute;
    inset: 0;
    padding: 1.5px;
    border-radius: inherit;
    pointer-events: none;
    opacity: var(--lift);
    transition: opacity 700ms cubic-bezier(0.2, 0, 0, 1);
    overflow: hidden;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0) border-box;
    -webkit-mask-composite: xor;
            mask-composite: exclude;
    will-change: opacity;
  }
  .card a:hover .border-glow { --lift: 1; }
  .border-glow-blob {
    position: absolute;
    top: 0;
    left: 0;
    width: 468px;
    height: 468px;
    margin: 0;
    border-radius: 50%;
    background: radial-gradient(circle,
      var(--accent) 0%,
      var(--accent) 5%,
      rgba(232, 234, 239, 0.7) 16%,
      rgba(232, 234, 239, 0.22) 34%,
      transparent 58%);
    will-change: transform;
    transform: translate(-50%, -50%) translate(0px, 0px);
  }
  @media (prefers-reduced-motion: reduce) {
    .border-glow { display: none; }
  }
</style>
</head>
<body>
<main>
  <h1>handmaid preview</h1>
  <p class="sub">${samples.length} 件のサンプルが見つかりました。クリックで開けます。</p>
  ${cards}
</main>
<script>
/* Rotating border-glow driver
 * ─────────────────────────────────────────────────────────────────
 * 元実装: getlayers.ai の ProjectCard / BorderGlow (Next.js + react-spring)
 * vanilla 移植: rAF + ResizeObserver + IntersectionObserver。
 *   - 角丸長方形の外周を 4.2s で一周する 2 個のブロブを 180° 位相で配置
 *   - prefers-reduced-motion:reduce / 非可視状態ではアニメ停止
 *   - ResizeObserver でカードサイズ / border-radius に追従
 */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /**
   * 角丸長方形 (W x H, 角丸 R) の外周を時計回りに 1 周する。
   * progress ∈ [0, 1) を渡すと (x, y) を返す。左上 (R, 0) 起点。
   */
  function perimeterWalk(progress, W, H, R) {
    var w = W - 2 * R;
    var h = H - 2 * R;
    var arc = (Math.PI / 2) * R;
    var perimeter = 2 * w + 2 * h + 4 * arc;
    if (perimeter <= 0) return { x: 0, y: 0 };
    var s = ((progress % 1) * perimeter + perimeter) % perimeter;

    if (s < w) return { x: R + s, y: 0 };                          // top edge (L→R)
    s -= w;
    if (s < arc) {                                                 // top-right corner
      var a = -Math.PI / 2 + (Math.PI / 2) * (s / arc);
      return { x: W - R + R * Math.cos(a), y: R + R * Math.sin(a) };
    }
    s -= arc;
    if (s < h) return { x: W, y: R + s };                          // right edge (T→B)
    s -= h;
    if (s < arc) {                                                 // bottom-right corner
      var b = (Math.PI / 2) * (s / arc);
      return { x: W - R + R * Math.cos(b), y: H - R + R * Math.sin(b) };
    }
    s -= arc;
    if (s < w) return { x: W - R - s, y: H };                      // bottom edge (R→L)
    s -= w;
    if (s < arc) {                                                 // bottom-left corner
      var c = Math.PI / 2 + (Math.PI / 2) * (s / arc);
      return { x: R + R * Math.cos(c), y: H - R + R * Math.sin(c) };
    }
    s -= arc;
    if (s < h) return { x: 0, y: H - R - s };                      // left edge (B→T)
    s -= h;
    var u = Math.PI + (Math.PI / 2) * (s / arc);                   // top-left corner
    return { x: R + R * Math.cos(u), y: R + R * Math.sin(u) };
  }

  function init(card) {
    var glow = card.querySelector('.border-glow');
    if (!glow) return;
    var blobs = glow.querySelectorAll('.border-glow-blob');
    if (blobs.length < 2) return;

    var W = 0, H = 0, R = 0;
    var active = false;
    var startTime = 0;
    var rafId = 0;
    var DURATION = 4200;

    function measure() {
      W = card.offsetWidth;
      H = card.offsetHeight;
      var cs = getComputedStyle(card);
      var r = parseFloat(cs.borderTopLeftRadius) || 0;
      R = Math.min(r, W / 2, H / 2);
    }
    measure();

    var ro = new ResizeObserver(measure);
    ro.observe(card);

    function tick(now) {
      if (!active) return;
      var t = ((now - startTime) % DURATION) / DURATION;
      var p1 = perimeterWalk(t, W, H, R);
      var p2 = perimeterWalk((t + 0.5) % 1, W, H, R);
      blobs[0].style.transform =
        'translate(-50%, -50%) translate(' + p1.x + 'px, ' + p1.y + 'px)';
      blobs[1].style.transform =
        'translate(-50%, -50%) translate(' + p2.x + 'px, ' + p2.y + 'px)';
      rafId = requestAnimationFrame(tick);
    }

    var io = new IntersectionObserver(function (entries) {
      var visible = entries[0].isIntersecting;
      if (visible && !active) {
        active = true;
        rafId = requestAnimationFrame(function (t) {
          startTime = t;
          tick(t);
        });
      } else if (!visible && active) {
        active = false;
        cancelAnimationFrame(rafId);
      }
    }, { rootMargin: '200px 0px' });
    io.observe(card);
  }

  document.querySelectorAll('.card a').forEach(function (a) {
    init(a);
  });
})();
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
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
  const samples = listSamples();
  if (samples.length > 0) {
    console.log(`  samples:`);
    for (const s of samples) {
      const tag = s.hasIndex ? '✓' : '✗';
      console.log(`    ${tag} ${url}${s.path}`);
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

