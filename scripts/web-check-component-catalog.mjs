#!/usr/bin/env node
/**
 * /components カタログの取りこぼし検査。
 *
 * カタログページは src/components/ をビルド時に自動収集するため、
 * 新しいコンポーネントを切り出しても手作業は要らない。
 * ただし「自動なので大丈夫」を口約束にせず、ビルド結果を突き合わせて確認する。
 *
 * 検査内容:
 *   1. src/components/ の全 .astro が dist/components/index.html に載っているか
 *   2. Props のサンプル値を生成できず簡易表示になっているものが無いか
 *
 * 使い方:
 *   node scripts/web-check-component-catalog.mjs          # 未掲載があれば exit 1
 *   node scripts/web-check-component-catalog.mjs --warn   # 報告のみ (exit 0)
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src', 'components');
const PAGE = join(ROOT, 'dist', 'components', 'index.html');
const WARN_ONLY = process.argv.includes('--warn');

if (!existsSync(PAGE)) {
  console.error('dist/components/index.html がありません。先に npm run build を実行してください。');
  process.exit(2);
}

/** src/components/ 配下の .astro を再帰列挙して "category/Name" にする */
function collect(dir, category = null, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collect(full, category ?? name, out);
    } else if (name.endsWith('.astro')) {
      out.push({ category, name: name.replace(/\.astro$/, '') });
    }
  }
  return out;
}

const components = collect(SRC).sort(
  (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
);
const html = readFileSync(PAGE, 'utf8');

const missing = components.filter((c) => !html.includes(`id="c-${c.name}"`));
// 「プレビューは省略」が出ているものは Props を解決できていない
const degraded = components.filter((c) => {
  const at = html.indexOf(`id="c-${c.name}"`);
  if (at === -1) return false;
  // そのコンポーネントのカード内（次のカードまで）に省略表示があるか
  const next = html.indexOf('id="c-', at + 1);
  const card = html.slice(at, next === -1 ? undefined : next);
  return card.includes('プレビューは省略');
});

console.log(`コンポーネント: ${components.length} 件 / カタログ掲載: ${components.length - missing.length} 件`);

if (degraded.length > 0) {
  console.log(`\n簡易表示 (Props のサンプル値を生成できない) ${degraded.length} 件:`);
  for (const c of degraded) console.log(`  - ${c.category}/${c.name}`);
  console.log('  → src/lib/component-preview.ts の型解決を拡張すると解消する');
}

if (missing.length > 0) {
  console.error(`\nカタログに載っていない ${missing.length} 件:`);
  for (const c of missing) console.error(`  - ${c.category}/${c.name}`);
  console.error('\n/components は自動収集なので、通常ここは 0 件になる。');
  console.error('件数が合わない場合はビルドが古いか、コンポーネントの描画が失敗している。');
  if (!WARN_ONLY) process.exit(1);
}

if (missing.length === 0 && degraded.length === 0) {
  console.log('OK: 全件がカタログに載っていて、簡易表示もない');
}
