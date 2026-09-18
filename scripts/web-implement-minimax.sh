#!/usr/bin/env bash
# 実装（Fix段）を minimax-m3 の実セッションで行う。
#
# 呼び出しは opencode CLI を**直接**使う。hermes 経由にしていたが、
# hermes の opencode-go プロバイダは x-opencode-session ヘッダを送らず、
# 必ず HTTP 400 になる（実測 2026-09-15。--pass-session-id でも解消しない）。
# opencode CLI 自体は正常で、直接叩けば応答もファイル作成もできる。
# hermes はモデルルーティングのために挟んでいただけなので、外して直接呼ぶ。
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
# 第3引数があれば「たたき台の採点結果」。提出版はこれを直す作業になる。
DRAFT_SCORE="${3:-}"

# opencode の -m は "provider/model" 形式
MODEL="${WEB_DESIGNER_IMPL_MODEL:-opencode-go/minimax-m3}"
IMPL_CMD="${WEB_DESIGNER_IMPL_CMD:-opencode}"

JOB="$RUN_DIR/job.json"
[[ -f "$JOB" ]] || { echo "job.json がありません: $JOB" >&2; exit 1; }
SITE_TYPE="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type'])")"
STAMP="$(python3 -c "import json;print(json.load(open('$JOB'))['stamp'])")"

# ディレクションはラン1本。提出版は、たたき台と同じディレクションを
# 採点の指摘で直したものであって、別案ではない。
DIRECTION="$RUN_DIR/direction-${VARIANT}.html"
[[ -f "$DIRECTION" ]] || DIRECTION="$RUN_DIR/direction-a.html"
[[ -f "$DIRECTION" ]] || { echo "ディレクションがありません: $RUN_DIR/direction-a.html" >&2; exit 1; }

# 画像もラン1本。提出版はたたき台と同じ写真を使う（撮り直すと比較にならない）。
MANIFEST="$RUN_DIR/image-manifest-${VARIANT}.json"
[[ -f "$MANIFEST" ]] || MANIFEST="$RUN_DIR/image-manifest-a.json"
MANIFEST_LINE="画像は使わない（image-manifest なし）。写真枠は CSS のプレースホルダで作る。"
[[ -f "$MANIFEST" ]] && MANIFEST_LINE="画像: ${MANIFEST} の placement→path 対応表どおりに配置する。パスは書き換えない。"

OUT_DIR="src/pages/sites/${SITE_TYPE}/${VARIANT}-${STAMP}"
LOG="$RUN_DIR/implement-${VARIANT}.raw.log"
META_OUT="$RUN_DIR/meta/${VARIANT}.json"
mkdir -p "$RUN_DIR/meta"

# --- 改善モード（提出版）の指示 ------------------------------------------
REVISION_BLOCK=""
if [[ -n "$DRAFT_SCORE" && -f "$DRAFT_SCORE" ]]; then
  DRAFT_DIR="src/pages/sites/${SITE_TYPE}/a-${STAMP}"
  DRAFT_ISSUES="$(python3 -c "
import json
d = json.load(open('$DRAFT_SCORE'))
m = (d.get('models') or {}).get('a', {})
print('総合', m.get('total'), '/ 内訳', json.dumps(m.get('layers', {}), ensure_ascii=False))
print()
print('### 直す指摘')
for i, s in enumerate(m.get('issues', []), 1):
    print(f'{i}. {s}')
notes = m.get('page_notes') or {}
if notes:
    print()
    print('### ページ別の指摘')
    for k, v in notes.items():
        print(f'- {k}: {v}')
st = m.get('strengths') or []
if st:
    print()
    print('### 残す（壊さない）良かった点')
    for s in st:
        print(f'- {s}')
")"
  REVISION_BLOCK="
## これは「提出版」の実装である（最重要）

同じディレクションで先に**たたき台**を作り、独立の審査員に採点させた。
その指摘を直したものが提出版であり、**別案ではない**。

- たたき台の実装: \`${DRAFT_DIR}/\`（読んでよい。丸ごとコピーしない）
- たたき台で良かった点は引き継ぐ。指摘された箇所だけを作り直す。
- 提出版の出力先は \`${OUT_DIR}/\` で、たたき台は書き換えない。

### たたき台の採点結果

${DRAFT_ISSUES}

**上の指摘は1件ずつ潰すこと。** 直せない指摘があるなら、最後の報告に
「どれを・なぜ直せなかったか」を書く。黙って落とさない。
"
fi

PROMPT=$(cat <<EOF
あなたは website-designer リポジトリ (${ROOT}) で Astro の website を実装するエンジニア。
ファイル作成・ビルド・品質チェックまで自分で行ってよい。ただし
**main ブランチのまま作業し、git add / commit / push は一切しない**。

${REVISION_BLOCK}
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

- \`grid-cols-12\` のような**分割数だけのグリッド**を切って、子に \`col-span-*\` を付け忘れること
  （子が1カラム = 幅55px ほどに潰れ、本文が1文字ずつ縦に折り返される。
  実測 2026-09-16: これ1件でトップとサービスの2ページが読めなくなり、採点が38点まで落ちた。
  ビルドも静的チェックも通ってしまうので、書いた直後に自分で確かめること。
  \`arch-grid-span-missing\` が検出する）
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

echo "==> ${IMPL_CMD} (${MODEL}) で実装中（時間がかかります）"
# --agent build … ファイル作成・編集ができるエージェント
"$IMPL_CMD" run --agent build -m "$MODEL" "$PROMPT" > "$LOG" 2>&1 || true

python3 - "$META_OUT" "$SITE_TYPE" "$VARIANT" "$STAMP" "$MODEL" "$OUT_DIR" <<'PYEOF'
import json, sys, pathlib, datetime
meta_out, site_type, variant, stamp, model, out_dir = sys.argv[1:7]
d = pathlib.Path(out_dir)
pages = sorted(str(p.relative_to(d)) for p in d.rglob('*.astro')) if d.exists() else []
pathlib.Path(meta_out).write_text(json.dumps({
    "site_type": site_type,
    "variant": variant,
    "stamp": stamp,
    "route": f"/sites/{site_type}/{variant}-{stamp}/",
    "model": model,
    "provider": "opencode-cli",
    "pages_created": pages,
    "has_site_config": (d / "_site.ts").exists(),
    "tokens": {"note": "opencode run; per-session token rows not captured"},
    "implemented_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"  作成ページ: {len(pages)} 件 {pages}")
print(f"  _site.ts: {'あり' if (d / '_site.ts').exists() else '**なし（要修正）**'}")
PYEOF

# 成果物の検証。ここを飛ばすと、ページが 1 枚も出来ていないのに採点段へ進み、
# 存在しないURLを撮影した "not found" 画像を judge に渡して 0 点が返る。
# さらにその無意味な講評が SKILL の自動更新ログへ蓄積される（実測 2026-09-14）。
PAGES="$(find "$OUT_DIR" -name '*.astro' 2>/dev/null | wc -l | tr -d ' ')"
if [ ! -f "$OUT_DIR/_site.ts" ] || [ "${PAGES:-0}" -lt 3 ]; then
  echo "  x 実装が不十分です（_site.ts=$([ -f "$OUT_DIR/_site.ts" ] && echo あり || echo なし) / ページ ${PAGES} 枚）" >&2
  echo "    生ログ: $LOG" >&2
  if grep -q "x-opencode-session\|Error from provider" "$LOG" 2>/dev/null; then
    echo "    プロバイダ経路のエラーが出ています。" >&2
  fi
  exit 1
fi

echo "==> 生ログ: $LOG"
echo "==> meta: $META_OUT"
