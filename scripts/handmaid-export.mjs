#!/usr/bin/env node
/**
 * handmaid/ を本番配信用に dist/handmaid/ へ書き出す。
 *
 * handmaid は Astro のビルドとは別フローで作った単体 HTML なので、
 * `npm run build` には混ぜない（混ぜると web-quality-check が website の
 * ルールで採点し、スコア履歴も動く）。デプロイ時に release-deploy.sh が
 * 品質ゲートの後で呼ぶ。
 *
 * やること:
 *   - handmaid/<id>/ を dist/handmaid/<id>/ へコピー（*.md は仕様・レビューなので載せない）
 *   - 一覧ページ dist/handmaid/index.html を scripts/handmaid-index.mjs で生成
 *   - src/lib/seo.ts の NOINDEX が true の間は <meta name="robots"> を差し込む
 *     （Astro のページと同じ方針。読めなければ安全側の noindex）
 *
 * 使い方:
 *   node scripts/handmaid-export.mjs [dist_dir]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { listSamples, renderIndexHTML } from './handmaid-index.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SRC = join(ROOT, 'handmaid');
const DIST = process.argv[2] ?? join(ROOT, 'dist');
const OUT = join(DIST, 'handmaid');

if (!existsSync(DIST)) {
  console.error(`dist が無い: ${DIST}（先に npm run build）`);
  process.exit(2);
}
if (!existsSync(SRC)) {
  console.log('handmaid/ が無いので何もしない');
  process.exit(0);
}

const ROBOTS = 'noindex, nofollow, noarchive';
const noindex = (() => {
  try {
    const m = readFileSync(join(ROOT, 'src/lib/seo.ts'), 'utf8').match(/export const NOINDEX\s*=\s*(true|false)/);
    return m ? m[1] === 'true' : true;
  } catch {
    return true;
  }
})();

/** <head> 直後に robots を差し込む。既に robots があれば触らない。 */
function withRobots(html) {
  if (!noindex || /<meta\s+name=["']robots["']/i.test(html)) return html;
  const tag = `<meta name="robots" content="${ROBOTS}" />`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => `${h}\n${tag}`) : `${tag}\n${html}`;
}

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    if (name.startsWith('.') || extname(name).toLowerCase() === '.md') continue;
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) { copyDir(s, d); continue; }
    if (extname(name).toLowerCase() === '.html') writeFileSync(d, withRobots(readFileSync(s, 'utf8')));
    else copyFileSync(s, d);
  }
}

// 前回の書き出しが残っていると、handmaid 側で消したサンプルが本番に残る
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const samples = listSamples(SRC).filter((s) => s.hasIndex);
for (const s of samples) copyDir(join(SRC, s.id), join(OUT, s.id));

writeFileSync(
  join(OUT, 'index.html'),
  renderIndexHTML(samples, { mode: 'publish', robots: noindex ? ROBOTS : null }),
);

console.log(`handmaid: ${samples.length} 件を ${OUT} へ書き出し（noindex: ${noindex}）`);
for (const s of samples) console.log(`  /handmaid/${s.id}/  ${s.title ?? ''}`);
