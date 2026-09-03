#!/usr/bin/env node
/**
 * ディレクションフェーズ(direction.html)の画像計画を読み、
 * web-generate-image.mjs を順番に呼んで実際に画像を用意する。
 *
 * 背景:
 *   画像調達をモデルの即興に任せていたため、生成が一度も使われなかったり
 *   (2026-08-18)、alt と実写真が別物になる事故が起きていた。ディレクションが
 *   決めたプロンプトをそのまま生成に渡すことで、実装段の裁量を無くす。
 *
 * 使い方:
 *   node scripts/web-generate-images-from-direction.mjs \
 *     --run-dir docs/quality/runs/corporate-20260903-1400 \
 *     --category corporate --stamp 20260903-1400 --variant a [--quality-og]
 *
 * 入力: <run_dir>/direction.html の #images (<figure data-placement data-tags>
 *       <figcaption data-prompt>) と #index-assets の og-image プロンプト
 * 出力: public/sites/{site_type}/_shared/{stamp}/img-NN.jpg (+ og-image.jpg)
 *       <run_dir>/image-manifest.json (placement -> 実ファイルパスの対応表。
 *       Fix段はこのマニフェストで「どの画像をどこに使うか」を確定させる)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const args = process.argv.slice(2);
const get = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const has = (k) => args.includes(`--${k}`);

const runDir = get('run-dir');
const category = get('category');
const stamp = get('stamp');
// 2026-08-25: ディレクション2案対応。--variant a|b を渡すと
// direction-{variant}.html を読み、image-manifest-{variant}.json に出力する。
// 画像そのものは同じ _shared/{stamp}/ に置き、ファイル名を img-{variant}-NN.jpg
// にして衝突を避ける。タグが重なる絵は image-db 側で自動再利用されるので、
// 2案でも本当に違う絵の分しか追加生成されない(課金は差分だけ増える)。
const variant = get('variant');
if (!runDir || !category || !stamp) {
  console.error('usage: --run-dir <dir> --category <cat> --stamp <stamp> [--variant a|b] [--quality-og]');
  process.exit(2);
}

const directionPath = join(runDir, variant ? `direction-${variant}.html` : 'direction.html');
if (!existsSync(directionPath)) {
  console.error(`ディレクションがありません: ${directionPath}`);
  process.exit(1);
}
const html = readFileSync(directionPath, 'utf8');

/** #id ... </section> の中身だけ切り出す(単純な非入れ子セクションのみ想定) */
function sectionBody(id) {
  const m = html.match(new RegExp(`<section id="${id}">([\\s\\S]*?)</section>`));
  return m ? m[1] : '';
}

/** <figure data-placement="..." data-tags="..."><figcaption data-prompt="..."> を列挙 */
function parseFigures(body) {
  const out = [];
  const figureRe = /<figure\b([^>]*)>([\s\S]*?)<\/figure>/g;
  let m;
  while ((m = figureRe.exec(body))) {
    const attrs = m[1];
    const inner = m[2];
    const placement = (attrs.match(/data-placement="([^"]*)"/) || [])[1] ?? '';
    const tags = (attrs.match(/data-tags="([^"]*)"/) || [])[1] ?? '';
    const prompt = (inner.match(/data-prompt="([^"]*)"/) || [])[1] ?? '';
    // website は縦位置の人物写真・正方形のロゴ枠など、LP より比率の要求が多い
    const aspect = (attrs.match(/data-aspect="([^"]*)"/) || [])[1] ?? 'landscape';
    if (prompt) out.push({ placement, tags, prompt, aspect });
  }
  return out;
}

const imagesBody = sectionBody('images');
const figures = parseFigures(imagesBody);

// og 画像は #images 内に data-placement="og-image" として書いてもよい
const indexAssetsBody = sectionBody('index-assets');
const ogMatch = indexAssetsBody.match(/data-role="og-image"\s+data-prompt="([^"]*)"/);
const ogPrompt = ogMatch ? ogMatch[1] : null;

if (figures.length === 0 && !ogPrompt) {
  console.error('direction.html から画像プロンプトを抽出できませんでした');
  process.exit(1);
}

const manifest = [];
let idx = 0;

function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function runOne({ placement, tags, prompt, outName, quality, aspect = 'landscape' }) {
  idx += 1;
  const outRel = `public/sites/${category}/_shared/${stamp}/${outName}`;
  const tagList = tags
    ? decodeEntities(tags)
    : `${category},画像${idx}`;
  const args = [
    'scripts/web-generate-image.mjs',
    '--category', category,
    '--tags', tagList,
    '--prompt', decodeEntities(prompt),
    '--out', outRel,
    '--aspect', aspect,
  ];
  if (quality) args.push('--quality');
  console.log(`==> [${idx}] ${placement || outName}`);
  let result;
  try {
    const stdout = execFileSync('node', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    result = JSON.parse(stdout.trim());
  } catch (e) {
    console.error(`   失敗: ${e.message.split('\n')[0]}`);
    manifest.push({ placement, tags: tagList, prompt, error: true });
    return;
  }
  const path = result.copiedTo ?? result.path;
  manifest.push({
    placement, tags: tagList, prompt, aspect,
    path, reused: !!result.reused,
  });
  console.log(`   -> ${path}${result.reused ? ' (再利用)' : ' (新規生成)'}`);
}

const prefix = variant ? `img-${variant}-` : 'img-';
const ogName = variant ? `og-image-${variant}.jpg` : 'og-image.jpg';

for (const fig of figures) {
  runOne({ ...fig, outName: `${prefix}${String(idx + 1).padStart(2, '0')}.jpg` });
}
if (ogPrompt) {
  runOne({ placement: 'og-image', tags: `${category},og-image`, prompt: ogPrompt, outName: ogName, quality: has('quality-og') });
}

const manifestPath = join(runDir, variant ? `image-manifest-${variant}.json` : 'image-manifest.json');
writeFileSync(manifestPath, JSON.stringify({ generated_at: new Date().toISOString(), images: manifest }, null, 2) + '\n', 'utf8');

const failed = manifest.filter((m) => m.error).length;
console.log(`\n完了: ${manifest.length}件中${failed}件失敗 -> ${manifestPath}`);
if (failed) process.exitCode = 1;
