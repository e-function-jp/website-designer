#!/usr/bin/env bash
# 実装（Fix段）を minimax-m3（hermes / opencode-go）の実セッションで行う。
#
# オーケストレータ自身が別モデルの成果物を書いてしまうと 2 案比較が成立しない
# （lp-designer で meta の session_id が同一になっていた実績がある）ため、
# 必ず実際のセッションを起動する。
#
# 使い方:
#   bash scripts/web-implement-minimax.sh <run_dir> <variant>
# 前提: <run_dir>/direction-{variant}.html
# 出力: src/pages/sites/{site_type}/{variant}-{stamp}/**
#       <run_dir>/meta/{variant}.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN_DIR="${1:?run_dir required}"
VARIANT="${2:?variant required (a|b)}"

MODEL="${WEB_DESIGNER_IMPL_MODEL:-minimax-m3}"
PROVIDER="${WEB_DESIGNER_IMPL_PROVIDER:-opencode-go}"

JOB="$RUN_DIR/job.json"
[[ -f "$JOB" ]] || { echo "job.json がありません: $JOB" >&2; exit 1; }
SITE_TYPE="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type'])")"
STAMP="$(python3 -c "import json;print(json.load(open('$JOB'))['stamp'])")"

DIRECTION="$RUN_DIR/direction-${VARIANT}.html"
[[ -f "$DIRECTION" ]] || { echo "ディレクションがありません: $DIRECTION" >&2; exit 1; }

MANIFEST="$RUN_DIR/image-manifest-${VARIANT}.json"
MANIFEST_LINE="画像は使わない（image-manifest なし）。写真枠は CSS のプレースホルダで作る。"
[[ -f "$MANIFEST" ]] && MANIFEST_LINE="画像: ${MANIFEST} の placement→path 対応表どおりに配置する。パスは書き換えない。"

OUT_DIR="src/pages/sites/${SITE_TYPE}/${VARIANT}-${STAMP}"
LOG="$RUN_DIR/implement-${VARIANT}.raw.log"
META_OUT="$RUN_DIR/meta/${VARIANT}.json"
mkdir -p "$RUN_DIR/meta"

PROMPT=$(cat <<EOF
あなたは website-designer リポジトリ (${ROOT}) で Astro の website を実装するエンジニア。
ファイル作成・ビルド・品質チェックまで自分で行ってよい。ただし
**main ブランチのまま作業し、git add / commit / push は一切しない**。

## 実装対象

- 出力ディレクトリ: ${OUT_DIR}/
- ディレクション: ${DIRECTION}
  → #site-config / #sitemap / #pages の指示を **そのまま実装する。考え直さない。**
  → 各 <section data-section> の data-role="copy" の日本語をそのまま使う
  → data-role="animation" の指示を必ず実装する（none なら何もしない）
- ${MANIFEST_LINE}

## 先に読むもの

\`.claude/skills/web-implementation-tips/SKILL.md\` を**必ず先に読む**こと。
実装前チェックリストと、過去ランで独立judgeに指摘された内容が蓄積されている。
同じ指摘を繰り返さないために存在する。

## 必ず守る手順

1. **最初に \`${OUT_DIR}/_site.ts\` を書く。** ディレクションの #site-config をそのまま写す。
   型は \`src/lib/site.ts\` の \`SiteConfig\`。ここを飛ばすとナビがページ間でズレる。
   **\`industry\` フィールドも必ず書く**（参照サイトの業種。\`scripts/site_categories.py\`
   の \`INDUSTRIES\` の id から選ぶ）。コーポレートの学習ローテは業種を従軸に
   採用したため（2026-09）、industry が無いと次に同業種を避ける判定ができない。
2. 各ページを \`${OUT_DIR}/{path}/index.astro\` として作る（トップは \`index.astro\`）。
   **全ページが \`src/layouts/SiteLayout.astro\` を使う。** ヘッダー・フッター・パンくず・
   JSON-LD・title は SiteLayout が自動で作るので、手書きしない。
3. SiteLayout に渡す props: \`site\` / \`title\` / \`description\`（40文字以上・ページ固有）/
   \`path\` / トップは \`isHome\` / 下層は \`breadcrumbs\`。
4. \`src/components/\` の既存コンポーネントを使う。**各ページ最低2件、サイト全体で6種類以上。**
   ベタ書きHTMLで済ませない。既存にない構造はコンポーネントとして
   \`src/components/sections/\` に切り出してから使う（これが本プロジェクトの目的）。
5. **独自テーマは \`src/styles/global.css\` に DaisyUI v5 の書式で追加する。**
   既定テーマ（light / dark / cupcake）のままにしない。書式は次のとおり:

   \`\`\`css
   @plugin "daisyui/theme" {
     name: "テーマ名";
     default: false;
     color-scheme: light;
     --color-base-100: oklch(98% 0.005 100);
     --color-base-200: oklch(95% 0.008 100);
     --color-base-300: oklch(90% 0.01 100);
     --color-base-content: oklch(22% 0.02 150);
     --color-primary: oklch(35% 0.06 160);
     --color-primary-content: oklch(98% 0.005 100);
     --color-secondary: oklch(60% 0.12 50);
     --color-secondary-content: oklch(98% 0.005 100);
     --color-accent: oklch(60% 0.12 50);
     --color-accent-content: oklch(98% 0.005 100);
     --color-neutral: oklch(25% 0.02 150);
     --color-neutral-content: oklch(98% 0.005 100);
     --radius-box: 0.5rem;
     --radius-field: 0.375rem;
   }
   \`\`\`

   ファイル冒頭の \`@plugin "daisyui" { themes: ... }\` の**列挙にも名前を追加する**
   （列挙しないテーマは静かに既定へフォールバックする）。
   ディレクションが指定した16進の配色を oklch に置き換えて入れる。
   \`_site.ts\` の \`theme\` にこの名前を書く。

6. モーションは \`src/components/ui/ScrollReveal.astro\` を使う。
   animation は fade / fade-up / fade-down / fade-left / fade-right / zoom / blur / clip-up。
   duration(ms) と stagger(ms) を指定できる。ヘッダー挙動とページ遷移は \`_site.ts\` の
   \`motion\` で指定する（SiteHeader / PageTransition が読む）。
7. \`npm run build\` を通す。
8. \`node scripts/web-quality-check.mjs\` を実行し、**high の指摘をゼロにする**。

## 禁止事項

- \`<style is:global>\` で \`.btn\` \`.card\` \`.input\` 等の DaisyUI 共通クラスを上書きすること
  （1ビルドに複数サイトが載るので他サイトを壊す。\`arch-global-style-collision\` が検出する）
- DaisyUI 既定テーマ（light / dark / cupcake）のまま出荷すること
- トップだけ作り込み、下層をナビとフッターだけの空ページにすること（本文400文字以上）
- 全ページで同じ title / description を使うこと
- \`href="#"\` を残すこと、存在しないパスへリンクすること
- 参照サイトの固有名詞・実在企業名を使うこと
- ページ内 \`<style>\` でアニメーションを書くなら \`@media (prefers-reduced-motion: reduce)\` の
  打ち消しを必ず付けること

## 完了条件

\`node scripts/web-quality-check.mjs\` で対象サイトのページに high の指摘が無いこと。
終わったら、作成したファイル一覧と最終スコアを報告すること。
EOF
)

echo "==> hermes (${MODEL}/${PROVIDER}) で実装中（時間がかかります）"
hermes -z "$PROMPT" -m "$MODEL" --provider "$PROVIDER" > "$LOG" 2>&1 || true

python3 - "$META_OUT" "$SITE_TYPE" "$VARIANT" "$STAMP" "$MODEL" "$PROVIDER" "$OUT_DIR" <<'PYEOF'
import json, sys, pathlib, datetime
meta_out, site_type, variant, stamp, model, provider, out_dir = sys.argv[1:8]
d = pathlib.Path(out_dir)
pages = sorted(str(p.relative_to(d)) for p in d.rglob('*.astro')) if d.exists() else []
pathlib.Path(meta_out).write_text(json.dumps({
    "site_type": site_type,
    "variant": variant,
    "stamp": stamp,
    "route": f"/sites/{site_type}/{variant}-{stamp}/",
    "model": model,
    "provider": provider,
    "pages_created": pages,
    "has_site_config": (d / "_site.ts").exists(),
    "tokens": {"note": "hermes -z oneshot; per-session token rows not captured"},
    "implemented_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"  作成ページ: {len(pages)} 件 {pages}")
print(f"  _site.ts: {'あり' if (d / '_site.ts').exists() else '**なし（要修正）**'}")
PYEOF

echo "==> 生ログ: $LOG"
echo "==> meta: $META_OUT"
