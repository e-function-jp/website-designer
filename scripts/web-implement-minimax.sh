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

# 実装 CLI は2系統を持つ。呼び出し方が違うので driver で分ける。
#   copilot  … copilot -p "<prompt>" --model <model> --allow-all-tools
#   opencode … opencode run --agent build -m <provider/model> "<prompt>"
#
# 既定は copilot / gpt-5.6-terra（2026-09-18〜）。opencode が利用上限に達したため
# 切り替えた。同一ディレクション・同一素材でトップページを5モデルに実装させた比較
#（docs/quality/runs/corporate-20260916-0500/compare/ と /compare/20260916-0500/）で、
# gpt-5.6-terra は minimax-m3 と並んでディレクションの記述どおりに実装できていた。
# opencode が復活したら WEB_DESIGNER_IMPL_DRIVER=opencode で戻す。
#
# 2026-11-24〜 既定は claude。copilot / opencode のモデルは参照キャプチャも
# 自分の描画結果も見ずにテキストだけで実装しており、余白・写真の枚数・
# ナビの形がディレクションの文章から落ちていた。claude は Read で画像を開け、
# 撮影スクリプトで自分の描画を見て直せる。
IMPL_DRIVER="${WEB_DESIGNER_IMPL_DRIVER:-claude}"
case "$IMPL_DRIVER" in
  claude)
    MODEL="${WEB_DESIGNER_IMPL_MODEL:-opus}"
    IMPL_CMD="${WEB_DESIGNER_IMPL_CMD:-claude}"
    ;;
  codex)
    MODEL="${WEB_DESIGNER_IMPL_MODEL:-}"
    IMPL_CMD="${WEB_DESIGNER_IMPL_CMD:-codex}"
    ;;
  copilot)
    MODEL="${WEB_DESIGNER_IMPL_MODEL:-gpt-5.6-terra}"
    IMPL_CMD="${WEB_DESIGNER_IMPL_CMD:-copilot}"
    ;;
  opencode)
    # opencode の -m は "provider/model" 形式
    MODEL="${WEB_DESIGNER_IMPL_MODEL:-opencode-go/minimax-m3}"
    IMPL_CMD="${WEB_DESIGNER_IMPL_CMD:-opencode}"
    ;;
  *) echo "WEB_DESIGNER_IMPL_DRIVER は claude / codex / copilot / opencode" >&2; exit 2 ;;
esac

JOB="$RUN_DIR/job.json"
[[ -f "$JOB" ]] || { echo "job.json がありません: $JOB" >&2; exit 1; }
SITE_TYPE="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type'])")"
STAMP="$(python3 -c "import json;print(json.load(open('$JOB'))['stamp'])")"
MODE="$(python3 -c "import json;print(json.load(open('$JOB')).get('mode') or 'adapt')")"

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

python3 scripts/web-reference-fidelity.py "$RUN_DIR" direction
FIDELITY_BLOCK=""
if [[ -f "$RUN_DIR/reference-fidelity.json" ]]; then
  FIDELITY_BLOCK="参照再現契約: $RUN_DIR/reference-fidelity.json を読む。観察・条件・採否を ID ごとに照合する。契約にない説明、画像、装飾カードを汎用ルールだけで足さず、矛盾・未実装は ID ごとに報告する。"
fi

# --- 参照再現モードの指示 ----------------------------------------------
# 汎用ルール（既存部品の最低数・定型 CTA・均一な演出量）が参照の意匠を
# 一般的な会社サイトへ均していた。reproduce では参照を正とする。
REPRODUCE_BLOCK=""
COMPONENT_RULE="\`src/components/\` の既存コンポーネントを使う。**各ページ最低2件、サイト全体で6種類以上。**
   ベタ書きHTMLで済ませない。既存にない構造はコンポーネントとして
   \`src/components/sections/\` に切り出してから使う（これが本プロジェクトの目的）。"
if [[ "$MODE" == "reproduce" ]]; then
  REF_CAPS="$(find "$RUN_DIR/motion" -maxdepth 1 -name '*.jpg' 2>/dev/null | sort | sed 's/^/  - /')"
  REPRODUCE_BLOCK="
## このランは「参照の意匠の高再現」である（最重要）

- 参照サイト: $(python3 -c "import json;print(json.load(open('$JOB'))['reference'].get('url',''))")
- 参照キャプチャ（**実装前に必ず全部 Read で開いて見る**）:
${REF_CAPS:-  (なし)}
- ディレクションの \`data-role=\"reference\"\` が、そのセクションが写す参照の箇所。迷ったら参照キャプチャを正とする。
- **足さない**: ディレクションと参照のどちらにも無いセクション・説明文・実績数値・CTA帯・装飾カードを、
  一般的なサイトに必要だからという理由で足さない。
- **均さない**: 写真のサイズ差・余白の広狭・ページごとに違う演出量・英語の短いラベルを、整える目的で揃えない。
- ヘッダー/ナビが既定の \`SiteHeader\` と違う形・挙動なら（ディレクションの #shell が custom）、
  サイト専用ヘッダーを \`src/components/site/\` に新規部品として作り、各ページで
  \`<Fragment slot=\"header\">\` として \`SiteLayout\` に差し込む（フッターも \`slot=\"footer\"\`）。
  状態（PC初期/PCスクロール後/PCメニュー展開/SP初期/SP展開）ごとの見た目と遷移を #shell どおりに実装する。
  ナビ項目は \`_site.ts\` の \`nav\` から描画し（全ページで同じ集合）、現在地に \`aria-current=\"page\"\` を付ける。
  キーボード操作・aria-expanded・Esc で閉じる・reduced-motion を崩さない。
- パンくずを画面に出さない指定なら \`_site.ts\` に \`shell: { breadcrumbs: 'hidden' }\`。
- 実装後に \`npm run build\` → \`npx astro preview\` を起動し、
  \`node scripts/web-shoot-sample.mjs <route> <outfile> --width 1280\`（SP は 390）で自分のページを撮って Read で開き、
  参照キャプチャと**同じ幅で見比べて**差を直す（最低1往復）。
"
  COMPONENT_RULE="部品は「見た目が参照と一致するときだけ」既存の \`src/components/\` を使う。
   一致しない構造は、参照の見た目どおりの新規コンポーネントとして \`src/components/sections/\`
   （ヘッダー等は \`src/components/site/\`）に切り出してから使う。既存部品の既定の見た目に
   引きずられて参照から離れるのは不可。サイト全体で到達できる部品が6種類以上・各ページ2件以上になること
   （新規に切り出した部品も数える）。"
fi

PROMPT=$(cat <<EOF
あなたは website-designer リポジトリ (${ROOT}) で Astro の website を実装するエンジニア。
ファイル作成・ビルド・品質チェックまで自分で行ってよい。ただし
**main ブランチのまま作業し、git add / commit / push は一切しない**。

${REVISION_BLOCK}
${REPRODUCE_BLOCK}
## 実装対象

- 出力ディレクトリ: ${OUT_DIR}/
- ディレクション: ${DIRECTION}
${FIDELITY_BLOCK}
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
4. ${COMPONENT_RULE}
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

\`node scripts/web-quality-check.mjs\` を実行し、**対象サイトのページについて**
次の3つを満たすこと。high だけを見て終わらせない。

1. high の指摘が無いこと
2. \`arch-animation-missing\` が無いこと
   （ディレクションの \`data-role="animation"\` を全ページ実装する。medium だが、
   実測 2026-09-18/19 の2ラン連続で下層ページの演出が丸ごと抜け、
   後から手作業で付け直している。トップだけ演出があって下層が静止しているのは
   ページ間の一貫性の欠落として judge にも減点されている）
3. \`arch-component-reuse\` が無いこと（各ページ最低2件、サイト全体で6種類以上）

終わったら、作成したファイル一覧と最終スコア、上の3点それぞれの件数を報告すること。
EOF
)

echo "==> ${IMPL_CMD} (${MODEL}) で実装中（時間がかかります）"
run_codex_impl() {
  # 参照キャプチャを画像として添付する（codex は -i で画像を見られる）。
  local img_args=() m_args=()
  while IFS= read -r f; do img_args+=(-i "$f"); done < <(find "$RUN_DIR/motion" -maxdepth 1 -name '*-full.jpg' 2>/dev/null | sort)
  [[ -n "$MODEL" && "$IMPL_DRIVER" == "codex" ]] && m_args+=(-m "$MODEL")
  echo "$PROMPT" | codex exec --skip-git-repo-check -s workspace-write -C "$ROOT" \
    ${m_args[@]+"${m_args[@]}"} ${img_args[@]+"${img_args[@]}"} > "$LOG" 2>&1 || true
}

if [[ "$IMPL_DRIVER" == "claude" ]]; then
  # 非対話実行。編集・ビルド・撮影まで自分で回せるよう Bash を許可する。
  # git 操作はプロンプトで禁止している。
  echo "$PROMPT" | "$IMPL_CMD" -p --model "$MODEL" \
    --permission-mode acceptEdits \
    --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
    --add-dir "$ROOT" > "$LOG" 2>&1 || true
  # claude の CLI 認証が切れていたら codex で実装する（画像を見られる実装者を優先）。
  if grep -qi "Failed to authenticate\|access_token\|Re-authenticate\|Not logged in" "$LOG" 2>/dev/null; then
    echo "  claude の認証が切れているため codex で実装します" >&2
    IMPL_DRIVER=codex; MODEL=""
    run_codex_impl
  fi
elif [[ "$IMPL_DRIVER" == "codex" ]]; then
  run_codex_impl
elif [[ "$IMPL_DRIVER" == "copilot" ]]; then
  # --allow-all-tools は非対話実行に必須。-s で応答本文だけを拾う。
  # -C でリポジトリを作業ディレクトリに固定する。
  "$IMPL_CMD" -p "$PROMPT" --model "$MODEL" --allow-all-tools -s -C "$ROOT" > "$LOG" 2>&1 || true
else
  # --agent build … ファイル作成・編集ができるエージェント
  "$IMPL_CMD" run --agent build -m "$MODEL" "$PROMPT" > "$LOG" 2>&1 || true
fi

python3 - "$META_OUT" "$SITE_TYPE" "$VARIANT" "$STAMP" "$MODEL" "$OUT_DIR" "${IMPL_DRIVER}-cli" <<'PYEOF'
import json, sys, pathlib, datetime
meta_out, site_type, variant, stamp, model, out_dir, provider = sys.argv[1:8]
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
    "tokens": {"note": f"{provider}; per-session token rows not captured"},
    "implemented_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"  作成ページ: {len(pages)} 件 {pages}")
print(f"  _site.ts: {'あり' if (d / '_site.ts').exists() else '**なし（要修正）**'}")
PYEOF

if grep -qi "Failed to authenticate\|Re-authenticate\|Not logged in" "$LOG" 2>/dev/null; then
  echo "  x ${IMPL_CMD} の認証が切れています: $(head -c 200 "$LOG")" >&2
  exit 4
fi

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
