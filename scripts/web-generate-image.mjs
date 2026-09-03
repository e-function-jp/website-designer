#!/usr/bin/env node
/**
 * 画像を生成して public/ 配下へ保存し、再利用のためのDBに登録する。
 *
 * 背景:
 *   従来は Unsplash の photo ID をモデルが推測で書いており、alt と実写真が
 *   別物（「夜の水面」と書いて洋服ラック、他社ブランドのチューブ）という
 *   事故が起きていた。生成に切り替えることで被写体を意図通りにできる。
 *
 * 生成は課金される（xAI Grok Imagine）。同じ用途の画像を作り直さないよう、
 * カテゴリ + タグで docs/quality/image-db.json に登録し、
 * 生成前に既存を検索して再利用する。
 *
 * 使い方:
 *   node scripts/web-generate-image.mjs \
 *     --category corporate --tags "工場,製造,現場写真" \
 *     --prompt "..." --out public/sites/corporate/_shared/20260903-1400/hero.jpg
 *
 *   # 既存を探すだけ（生成しない）
 *   node scripts/web-generate-image.mjs --category corporate --tags "工場,製造" --lookup-only
 *
 * オプション:
 *   --quality        grok-imagine-image-quality を使う（高精細・低速）
 *   --aspect         landscape(既定) / portrait / square
 *   --force          DBに一致があっても生成する
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DB_PATH = join(ROOT, 'docs', 'quality', 'image-db.json');
const HERMES = `${process.env.HOME}/.hermes/hermes-agent`;

const args = process.argv.slice(2);
const get = (k, d = null) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const has = (k) => args.includes(`--${k}`);

const category = get('category');
const tagsRaw = get('tags', '');
const prompt = get('prompt');
const out = get('out');
const aspect = get('aspect', 'landscape');
const lookupOnly = has('lookup-only');
const force = has('force');
const quality = has('quality');

if (!category || !tagsRaw) {
  console.error('usage: --category <cat> --tags "a,b,c" [--prompt "..." --out <path>] [--lookup-only] [--quality] [--force]');
  process.exit(2);
}

const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

/** DB読み込み。無ければ空で作る */
function loadDb() {
  if (!existsSync(DB_PATH)) return { version: 1, images: [] };
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveDb(db) {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db.updated_at = new Date().toISOString();
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + '\n', 'utf8');
}

/**
 * 構図・時間帯・寄り引きを表すだけで、**被写体を特定しない**タグ。
 * 再利用判定の分母から外す。これらが一致しても「同じ絵でよい」根拠にならない。
 */
const NON_SUBJECT_TAGS = new Set([
  '横位置', '縦位置', '正方', 'ワイド', 'パノラマ',
  '昼間', '朝', '夕方', '夜', '曇り', '晴れ',
  '接写', 'マクロ', '寄り', '引き', '俯瞰', 'アップ',
  '室内', '屋内', '屋外', '外観', '内観',
  '実写', '写真', '商品写真', '人物',
]);

/**
 * 同カテゴリでタグの重なりが大きい画像を探す。
 *
 * 単純な「タグの過半数一致」だと**別の被写体まで再利用してしまう**。
 * 実測（corporate-20260903-1448）:
 *   「工場,製造,粉末,プロテイン」の工場ライン写真が
 *   「粉末,プロテイン,接写,容器」の製品接写として再利用され、
 *   「直営店舗,旭川,外観,昼間」の店舗外観が
 *   「旭川本社,ビル,外観,昼間」の本社ビルとして再利用された。
 *   どちらも 2/4 = 0.5 でしきい値に乗っていた。
 *   これは lp-designer が生成に切り替えて潰したはずの
 *   「alt と実写真が別物」の再発である。
 *
 * そこで判定を2段にする:
 *   1. **被写体タグ（先頭の非構図タグ）が一致すること** を必須にする
 *   2. そのうえで、構図タグを除いた重なりが 6 割以上あること
 */
function findReusable(db, category, tags) {
  const subjectOf = (list) => list.find((t) => !NON_SUBJECT_TAGS.has(t)) ?? list[0];
  const meaningful = (list) => list.filter((t) => !NON_SUBJECT_TAGS.has(t));

  const wantSubject = subjectOf(tags);
  const wantTags = meaningful(tags);
  if (!wantTags.length) return null;

  const cands = db.images
    .filter((im) => im.category === category && existsSync(join(ROOT, im.path)))
    .filter((im) => subjectOf(im.tags) === wantSubject)
    .map((im) => {
      const overlap = wantTags.filter((t) => im.tags.includes(t)).length;
      return { im, overlap, score: overlap / wantTags.length };
    })
    .filter((c) => c.overlap > 0)
    .sort((a, b) => b.score - a.score || b.overlap - a.overlap);

  return cands.length && cands[0].score >= 0.6 ? cands[0] : null;
}

const db = loadDb();
const hit = findReusable(db, category, tags);

if (hit && !force) {
  const res = { reused: true, path: hit.im.path, matchedTags: hit.im.tags, score: Number(hit.score.toFixed(2)) };
  if (out && !lookupOnly) {
    mkdirSync(dirname(join(ROOT, out)), { recursive: true });
    copyFileSync(join(ROOT, hit.im.path), join(ROOT, out));
    res.copiedTo = out;
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

if (lookupOnly) {
  console.log(JSON.stringify({ reused: false, reason: 'no match' }, null, 2));
  process.exit(0);
}

if (!prompt || !out) {
  console.error('生成には --prompt と --out が必要です');
  process.exit(2);
}

// --- 生成（hermes の xai image_gen プラグインを venv 経由で呼ぶ） ---
const py = `
import sys, os, json
sys.path.insert(0, os.getcwd())
import importlib
mod = importlib.import_module("plugins.image_gen.xai")
p = mod.XAIImageGenProvider()
if not p.is_available():
    print(json.dumps({"success": False, "error": "xai image gen not available"})); sys.exit(1)
r = p.generate(${JSON.stringify(prompt)}, aspect_ratio=${JSON.stringify(aspect)}${quality ? ', model="grok-imagine-image-quality"' : ''})
print(json.dumps({k: v for k, v in r.items() if k not in ("image", "image_base64")}))
`;

let genRes;
try {
  const stdout = execFileSync(`${HERMES}/venv/bin/python3`, ['-c', py], {
    cwd: HERMES, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  genRes = JSON.parse(stdout.trim().split('\n').pop());
} catch (e) {
  console.error('生成呼び出しに失敗:', e.message.split('\n')[0]);
  process.exit(1);
}

if (!genRes.success || !genRes.public_url) {
  console.error('生成失敗:', JSON.stringify(genRes));
  process.exit(1);
}

// CDN URL で返るのでローカルへ保存する（外部依存を残さない）
const outAbs = join(ROOT, out);
mkdirSync(dirname(outAbs), { recursive: true });
execFileSync('curl', ['-sL', genRes.public_url, '-o', outAbs]);

db.images.push({
  path: relative(ROOT, outAbs),
  category,
  tags,
  prompt,
  aspect,
  model: genRes.model ?? 'grok-imagine-image',
  provider: 'xai',
  source_url: genRes.public_url,
  created_at: new Date().toISOString(),
});
saveDb(db);

console.log(JSON.stringify({
  reused: false, generated: true, path: relative(ROOT, outAbs),
  model: genRes.model, tags, db: relative(ROOT, DB_PATH),
}, null, 2));
