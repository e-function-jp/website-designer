#!/usr/bin/env bash
# ディレクション生成。既定のディレクターは grok-4.5（hermes / xai-oauth）。
#
# 使い方:
#   bash scripts/web-direction.sh <run_dir> <variant> [<brand_hint>]
#     variant: a=堅実路線 / b=冒険路線
# 出力: <run_dir>/direction-{variant}.html
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN_DIR="${1:?run_dir required}"
VARIANT="${2:?variant required (a|b)}"
BRAND_HINT="${3:-}"

DIRECTOR="${WEB_DESIGNER_DIRECTOR:-grok}"
DIRECTOR_MODEL="${WEB_DESIGNER_DIRECTOR_MODEL:-grok-4.5}"
DIRECTOR_PROVIDER="${WEB_DESIGNER_DIRECTOR_PROVIDER:-xai-oauth}"

JOB="$RUN_DIR/job.json"
[[ -f "$JOB" ]] || { echo "job.json がありません: $JOB" >&2; exit 1; }

OUT="$RUN_DIR/direction-${VARIANT}.html"
RAW_LOG="$RUN_DIR/direction-${VARIANT}.raw.log"
TEMPLATE="scripts/web-direction-prompt-template.txt"

# job.json から値を取り出す。tone_hint に空白が入るので1項目ずつ読む。
SITE_TYPE="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type'])")"
SITE_TYPE_LABEL="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type_label'])")"
RUN_ID="$(python3 -c "import json;print(json.load(open('$JOB'))['run_id'])")"
STAMP="$(python3 -c "import json;print(json.load(open('$JOB'))['stamp'])")"
TONE_HINT="$(python3 -c "import json;print(json.load(open('$JOB')).get('tone_hint') or '')")"
REQUIRED="$(python3 -c "import json;print(', '.join(json.load(open('$JOB')).get('required_pages',[])))")"
RECOMMENDED="$(python3 -c "import json;print(', '.join(json.load(open('$JOB')).get('recommended_pages',[])))")"
SITE_BASE="/sites/${SITE_TYPE}/${VARIANT}-${STAMP}/"

case "$VARIANT" in
  a) VARIANT_HINT="この案は**堅実路線**。参照サイトの情報設計を素直に踏襲し、網羅性と可読性を優先する。奇をてらわず、迷ったら参照に寄せる。モーションも参照の実測値どおりに。" ;;
  b) VARIANT_HINT="この案は**冒険路線**。参照サイトの世界観と情報設計の骨格は保ちつつ、トップの構図・余白の取り方・写真の見せ方・モーションの組み立てで踏み込む。ただし必須ページ・a11y・reduced-motion 対応は崩さない。" ;;
  *) echo "variant は a か b" >&2; exit 2 ;;
esac

# ブランドはラン単位で1つに固定する。2案が別会社になると設計の比較にならない
# （ラン1回目で a=商社 / b=酒蔵 になった）。
if [[ -z "$BRAND_HINT" ]]; then
  if [[ -f "$RUN_DIR/brand.json" ]]; then
    BRAND_HINT="$(python3 -c "
import json
d = json.load(open('$RUN_DIR/brand.json'))
lines = [f\"**この企業設定を両案で共有する。変更・創作しない。**\"]
for k, label in [('name','商号'),('reading','よみ'),('industry','業種'),('business','事業内容'),
                 ('founded','設立'),('employees','従業員数'),('location','所在地'),
                 ('tagline','キャッチ'),('target','主な訪問者'),('cta','主要CTA')]:
    if d.get(k): lines.append(f'- {label}: {d[k]}')
if d.get('proof_points'): lines.append('- 実績: ' + ' / '.join(d['proof_points']))
print('\\n'.join(lines))
")"
  else
    BRAND_HINT="架空企業。参照サイトの固有名詞・実在企業名は使わない。"
  fi
fi

LOOK_ANALYSIS="(look-analysis.md なし)"
[[ -f "$RUN_DIR/look-analysis.md" ]] && LOOK_ANALYSIS="$(cat "$RUN_DIR/look-analysis.md")"

MOTION_SUMMARY="(モーション実測なし)"
if [[ -f "$RUN_DIR/motion/summary.json" ]]; then
  MOTION_SUMMARY="$(python3 -c "
import json
d = json.load(open('$RUN_DIR/motion/summary.json'))
print(json.dumps({k: d.get(k) for k in ('direction_hints','cross_page','reduced_motion','page_transition')}, ensure_ascii=False, indent=2))
")"
fi

PROMPT="$(cat "$TEMPLATE")"
PROMPT="${PROMPT//\{\{VARIANT_HINT\}\}/$VARIANT_HINT}"
PROMPT="${PROMPT//\{\{SITE_TYPE\}\}/$SITE_TYPE}"
PROMPT="${PROMPT//\{\{SITE_TYPE_LABEL\}\}/$SITE_TYPE_LABEL}"
PROMPT="${PROMPT//\{\{RUN_ID\}\}/$RUN_ID}"
PROMPT="${PROMPT//\{\{BRAND_HINT\}\}/$BRAND_HINT}"
PROMPT="${PROMPT//\{\{TONE_HINT\}\}/$TONE_HINT}"
PROMPT="${PROMPT//\{\{REQUIRED_PAGES\}\}/$REQUIRED}"
PROMPT="${PROMPT//\{\{RECOMMENDED_PAGES\}\}/$RECOMMENDED}"
PROMPT="${PROMPT//\{\{SITE_BASE\}\}/$SITE_BASE}"
PROMPT="${PROMPT//\{\{LOOK_ANALYSIS\}\}/$LOOK_ANALYSIS}"
PROMPT="${PROMPT//\{\{MOTION_SUMMARY\}\}/$MOTION_SUMMARY}"

REF_IMG=""
[[ -f "$RUN_DIR/motion/top-full.jpg" ]] && REF_IMG="$RUN_DIR/motion/top-full.jpg"

# hermes 経由の grok は「エージェント」であってテキスト補完ではない。
# 自分でファイルを書けるので、書かせたうえで stdout からの抽出は
# **フォールバック** に降格する。初回はエージェントが書いたファイルを
# 後処理が上書きして壊していた（実測: direction-a.html が講評文になった）。
rm -f "$OUT"

echo "==> [${DIRECTOR}/${VARIANT}] ディレクション生成中"
case "$DIRECTOR" in
  grok)
    # hermes -z は画像添付に対応していないので、キャプチャのパスを渡して自分で読ませる
    GROK_PROMPT="$PROMPT

## 出力方法（重要）

チャットに HTML を貼り付けず、**次のファイルに直接書き出すこと**:
  ${ROOT}/${OUT}

書き終えたら、ページ数・セクション数・各 data-role の件数だけを短く報告する。
HTML 本文をチャットに再掲しない（長すぎて途中で切れるため）。"
    [[ -n "$REF_IMG" ]] && GROK_PROMPT="$GROK_PROMPT

## 参照キャプチャ

次のファイルを読んで実際の見た目を確認すること（リポジトリ ${ROOT} 内）:
- ${REF_IMG}"
    hermes -z "$GROK_PROMPT" -m "$DIRECTOR_MODEL" --provider "$DIRECTOR_PROVIDER" > "$RAW_LOG" 2>&1 || true
    ;;
  codex)
    IMG_ARGS=(); [[ -n "$REF_IMG" ]] && IMG_ARGS+=(-i "$REF_IMG")
    echo "$PROMPT" | codex exec --skip-git-repo-check "${IMG_ARGS[@]}" > "$RAW_LOG" 2>&1 || true
    ;;
  *) echo "未知のディレクター: $DIRECTOR (grok|codex)" >&2; exit 2 ;;
esac

python3 - "$RAW_LOG" "$OUT" <<'PYEOF'
import sys, re, os
raw_path, out_path = sys.argv[1], sys.argv[2]

# エージェントが自分で書いたファイルが既にあり、機械可読な構造を
# 持っているなら、それが正。stdout からの抽出で上書きしない。
if os.path.exists(out_path):
    existing = open(out_path, encoding='utf-8').read()
    if 'data-page=' in existing and 'data-role="animation"' in existing:
        print('  （エージェントが直接書き出したファイルを採用）')
        sys.exit(0)

text = open(raw_path, encoding='utf-8').read()
codex_pos = [m.start() for m in re.finditer(r'^codex$', text, re.M)]
tok_pos = [m.start() for m in re.finditer(r'^tokens used', text, re.M)]
if codex_pos:
    last = codex_pos[-1]
    end = next((t for t in tok_pos if t > last), len(text))
    body = text[last + len('codex'):end].strip()
else:
    body = text.strip()
m = re.search(r'```html\s*\n(.*?)\n```', body, re.S)
if m:
    body = m.group(1).strip()
# hermes(grok) 経由は前置きの散文が混ざることがある。HTML が取れるならそこだけ採用。
m = re.search(r'(<!doctype html.*?</html>)', body, re.S | re.I)
if m:
    body = m.group(1).strip()
open(out_path, 'w', encoding='utf-8').write(body + '\n')
PYEOF

# 充足チェック。空欄を放置すると実装者が意匠を自分で決めてしまい、
# 参照との差が縮まらない（lp-designer で実測済み）。
python3 - "$OUT" <<'PYEOF'
import re, sys
html = open(sys.argv[1], encoding='utf-8').read()
pages = re.findall(r'<article[^>]*data-page="([^"]+)"', html)
sections = re.findall(r'<section[^>]*data-section=', html)
roles = {r: len(re.findall(r'data-role="%s"' % r, html)) for r in
         ('purpose', 'layout', 'copy', 'components', 'animation', 'image')}
print(f"  ページ: {len(pages)} 件 {pages}")
print(f"  セクション: {len(sections)} 件")
print(f"  role 充足: {roles}")
# ディレクション内の整合: #pages が参照する画像 placement が
# #images に全部載っているか。実測(corporate-20260903-1448)では
# 本文が hub-01〜05 の5枚を指示しているのに #images には3枚しか無く、
# 実装が3行に落として番号が 01→02→04 と飛んだ。
import re as _re
images_sec = _re.search(r'<section id="images">([\s\S]*?)</section>', html)
declared = set(_re.findall(r'data-placement="([^"]+)"', images_sec.group(1) if images_sec else ''))
referenced = set()
# data-role の中身は <code> 等で入れ子になることがある。[^<]* だと空で拾ってしまう
# （実測でこれに引っかかり、欠落を検出できていなかった）。閉じタグまで取ってから剥がす。
for body in _re.findall(r'data-role="image"[^>]*>([\s\S]*?)</(?:p|td|li|div|span)>', html):
    text = _re.sub(r'<[^>]+>', ' ', body)
    referenced |= set(_re.findall(r'\b([a-z][\w-]*:[\w-]+)\b', text))
missing_images = sorted(referenced - declared - {'none'})

problems = []
if missing_images:
    problems.append(f"本文が参照している画像が #images に無い: {', '.join(missing_images[:8])}")
if len(pages) < 4:
    problems.append(f"ページが {len(pages)} 件しかない（website として不足）")
if sections and roles['animation'] < len(sections):
    problems.append(f"animation 指示が {roles['animation']}/{len(sections)} セクション（全セクションに必要。無い場合も none と書く）")
if sections and roles['copy'] < len(sections) * 0.8:
    problems.append(f"copy が {roles['copy']}/{len(sections)} セクション（実装者が文章を考えることになる）")
if problems:
    print("\n  ⚠ ディレクションが不十分:")
    for p in problems:
        print(f"    - {p}")
    sys.exit(1)
print("  ✓ ディレクション充足")
PYEOF

echo "==> 出力: $OUT"
